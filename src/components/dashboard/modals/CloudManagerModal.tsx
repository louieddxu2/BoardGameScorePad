
import React, { useState, useEffect } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { DownloadCloud, X, FolderOpen, Trash2, RefreshCw, UploadCloud, Download, Clock, RefreshCcw, Activity, LayoutGrid, History, Loader2, AlertTriangle, CloudOff, Cloud, ArrowRightLeft, Database } from 'lucide-react';
import { CloudFile, CloudResourceType } from '../../../services/googleDrive';
import ConfirmationModal from '../../shared/ConfirmationModal';
import { useToast } from '../../../hooks/useToast';
import SyncDashboard from './SyncDashboard';
import { db } from '../../../db';
import { useCommonTranslation } from '../../../i18n/common';
import { cloudOnboardingTranslations, CloudOnboardingKey } from '../../../i18n/cloud_onboarding';

interface CloudManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCategory?: 'templates' | 'sessions' | 'history';
    isConnected: boolean;
    isMockMode: boolean;
    fetchFileList: (mode: 'active' | 'trash', source: 'templates' | 'sessions' | 'history') => Promise<CloudFile[]>;
    restoreBackup: (id: string) => Promise<GameTemplate>;
    restoreSessionBackup: (id: string) => Promise<GameSession>;
    restoreHistoryBackup?: (id: string) => Promise<HistoryRecord>;
    restoreFromTrash: (id: string, type: CloudResourceType) => Promise<boolean>;
    deleteCloudFile: (id: string) => Promise<boolean>;
    emptyTrash: (type?: CloudResourceType) => Promise<boolean>;
    connectToCloud: () => Promise<boolean>;
    disconnectFromCloud: () => Promise<void>;
    onRestoreSuccess: (template: GameTemplate) => void;
    onSessionRestoreSuccess: (session: GameSession) => void;
    onHistoryRestoreSuccess?: (record: HistoryRecord) => void;
    onSystemBackup?: (onProgress: (count: number, total: number) => void, onError: (failedItems: string[]) => void) => Promise<{ success: number, skipped: number, failed: number }>;
    onSystemRestore?: (localMeta: any, onProgress: (count: number, total: number) => void, onError: (failedItems: string[]) => void, onItemRestored: any, onSettingsRestored: any) => Promise<{ success: number, skipped: number, failed: number }>;
    onGetLocalData?: () => Promise<any>;
}

const CloudManagerModal: React.FC<CloudManagerModalProps> = ({
    isOpen, onClose, initialCategory = 'templates',
    isConnected, isMockMode,
    fetchFileList, restoreBackup, restoreSessionBackup, restoreHistoryBackup, restoreFromTrash, deleteCloudFile, emptyTrash,
    connectToCloud, disconnectFromCloud,
    onRestoreSuccess, onSessionRestoreSuccess, onHistoryRestoreSuccess, onSystemBackup, onSystemRestore, onGetLocalData
}) => {
    const [category, setCategory] = useState<'templates' | 'sessions' | 'history'>(initialCategory);
    const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

    const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<CloudFile | null>(null);
    const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const { showToast } = useToast();
    const { t: tCommon, language } = useCommonTranslation();

    // Helper for Cloud Onboarding Translation with Params support
    const tCloud = (key: CloudOnboardingKey, params?: Record<string, string | number>) => {
        const dict = cloudOnboardingTranslations[language] || cloudOnboardingTranslations['zh-TW'];
        let text = dict[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };

    // Sync Dashboard State
    const [showSyncDashboard, setShowSyncDashboard] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'scanning' | 'processing' | 'done'>('idle');
    const [syncResult, setSyncResult] = useState<{
        success: number; skipped: number; failed: string[]; errors: string[];
        total: number; current: number; currentItem?: string; type: 'upload' | 'download' | null;
    }>({
        success: 0, skipped: 0, failed: [], errors: [], total: 0, current: 0, type: null
    });

    // Scan Stats for Sync Dashboard
    const [scanStats, setScanStats] = useState<{
        upload: { templates: number; sessions: number; history: number };
        download: { templates: number; sessions: number; history: number };
    }>({
        upload: { templates: 0, sessions: 0, history: 0 },
        download: { templates: 0, sessions: 0, history: 0 }
    });

    // Helper to clean folder name (Parse by last underscore)
    const cleanName = (name: string) => {
        const lastUnderscoreIndex = name.lastIndexOf('_');
        if (lastUnderscoreIndex !== -1) {
            return name.substring(0, lastUnderscoreIndex);
        }
        return name;
    };

    // Helper to extract ID (Parse by last underscore)
    const extractId = (name: string) => {
        const lastUnderscoreIndex = name.lastIndexOf('_');
        if (lastUnderscoreIndex !== -1) {
            return name.substring(lastUnderscoreIndex + 1);
        }
        return null;
    };

    // Helper to format date preference (Original Updated > Created)
    const getDisplayDate = (file: CloudFile) => {
        if (file.appProperties && file.appProperties.originalUpdatedAt) {
            const ts = parseInt(file.appProperties.originalUpdatedAt, 10);
            if (!isNaN(ts)) {
                return new Date(ts).toLocaleString();
            }
        }
        return new Date(file.createdTime).toLocaleString();
    };

    const getResourceType = (cat: typeof category): CloudResourceType => {
        switch (cat) {
            case 'templates': return 'template';
            case 'sessions': return 'active';
            case 'history': return 'history';
        }
    };

    useEffect(() => {
        if (isOpen) {
            setCategory(initialCategory);
            setViewMode('active');
            setSyncStatus('idle');
        }
    }, [isOpen, initialCategory]);

    useEffect(() => {
        if (isOpen) {
            window.history.pushState({ modal: 'cloud' }, '');
            const handlePopState = (e: PopStateEvent) => {
                e.preventDefault();
                onClose();
            };
            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [isOpen, onClose]);

    // Automatic Scan on Sync Dashboard Open
    useEffect(() => {
        if (showSyncDashboard && isConnected && onGetLocalData) {
            const runScan = async () => {
                setSyncStatus('scanning');
                try {
                    const [localData, cTemplates, cSessions, cHistory] = await Promise.all([
                        onGetLocalData(),
                        fetchFileList('active', 'templates'),
                        fetchFileList('active', 'sessions'),
                        fetchFileList('active', 'history')
                    ]);

                    const stats = {
                        upload: { templates: 0, sessions: 0, history: 0 },
                        download: { templates: 0, sessions: 0, history: 0 }
                    };

                    const buildCloudMap = (files: CloudFile[]) => {
                        const map = new Map<string, CloudFile>();
                        files.forEach(f => {
                            const id = extractId(f.name);
                            if (id) map.set(id, f);
                        });
                        return map;
                    };

                    const mapT = buildCloudMap(cTemplates);
                    const mapS = buildCloudMap(cSessions);
                    const mapH = buildCloudMap(cHistory);

                    // 1. Compare Templates
                    const localTemplates = [...(localData.data.templates || []), ...(localData.data.overrides || [])];
                    localTemplates.forEach((t: GameTemplate) => {
                        const cFile = mapT.get(t.id);
                        if (!cFile) {
                            stats.upload.templates++;
                        } else {
                            const cTime = Number(cFile.appProperties?.originalUpdatedAt || 0);
                            if ((t.updatedAt || 0) > cTime) stats.upload.templates++;
                        }
                    });
                    cTemplates.forEach(f => {
                        const id = extractId(f.name);
                        if (id) {
                            const lTemp = localTemplates.find((t: any) => t.id === id);
                            const cTime = Number(f.appProperties?.originalUpdatedAt || 0);
                            if (!lTemp) {
                                stats.download.templates++;
                            } else {
                                if (cTime > (lTemp.updatedAt || 0)) stats.download.templates++;
                            }
                        }
                    });

                    // 2. Compare Sessions
                    const localSessions = localData.data.sessions || [];
                    localSessions.forEach((s: GameSession) => {
                        const cFile = mapS.get(s.id);
                        if (!cFile) {
                            stats.upload.sessions++;
                        } else {
                            const cTime = Number(cFile.appProperties?.originalUpdatedAt || 0);
                            const lTime = s.lastUpdatedAt || s.startTime || 0;
                            if (lTime > cTime) stats.upload.sessions++;
                        }
                    });
                    cSessions.forEach(f => {
                        const id = extractId(f.name);
                        if (id) {
                            const lSession = localSessions.find((s: any) => s.id === id);
                            const cTime = Number(f.appProperties?.originalUpdatedAt || 0);
                            if (!lSession) {
                                stats.download.sessions++;
                            } else {
                                const lTime = lSession.lastUpdatedAt || lSession.startTime || 0;
                                if (cTime > lTime) stats.download.sessions++;
                            }
                        }
                    });

                    // 3. Compare History
                    const localHistory = localData.data.history || [];
                    localHistory.forEach((h: HistoryRecord) => {
                        const cFile = mapH.get(h.id);
                        if (!cFile) {
                            stats.upload.history++;
                        } else {
                            const cTime = Number(cFile.appProperties?.originalUpdatedAt || 0);
                            const localTime = h.updatedAt || h.endTime;
                            if (localTime > cTime) stats.upload.history++;
                        }
                    });
                    cHistory.forEach(f => {
                        const id = extractId(f.name);
                        if (id) {
                            const lHistory = localHistory.find((h: any) => h.id === id);
                            const cTime = Number(f.appProperties?.originalUpdatedAt || 0);
                            if (!lHistory) {
                                stats.download.history++;
                            } else {
                                const lTime = lHistory.updatedAt || lHistory.endTime;
                                if (cTime > lTime) stats.download.history++;
                            }
                        }
                    });

                    setScanStats(stats);
                } catch (e) {
                    console.error("Scan failed", e);
                } finally {
                    setSyncStatus('idle');
                }
            };
            runScan();
        }
    }, [showSyncDashboard, isConnected]);

    const refreshList = async () => {
        if (!isConnected) return;
        setIsLoading(true);
        if (cloudFiles.length > 0) setCloudFiles([]);
        try {
            const files = await fetchFileList(viewMode, category);
            setCloudFiles(files);
        } catch (e) {
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && isConnected && !showSyncDashboard) refreshList();
    }, [isOpen, viewMode, category, isConnected, showSyncDashboard]);

    const handleSwitchCategory = (cat: 'templates' | 'sessions' | 'history') => {
        if (cat === category) return;
        setCloudFiles([]);
        setCategory(cat);
        setViewMode('active');
    };

    const handleSwitchMode = (mode: 'active' | 'trash') => {
        if (mode === viewMode) return;
        setCloudFiles([]);
        setViewMode(mode);
    };

    const handleFileSelect = async (file: CloudFile) => {
        if (viewMode === 'trash') return;
        setIsLoading(true);
        try {
            if (category === 'templates') {
                const templateWithExtra = await restoreBackup(file.id);
                const { _tempImageBase64, ...cleanTemplate } = templateWithExtra as any;
                onRestoreSuccess(cleanTemplate);
                if (_tempImageBase64) {
                    showToast({ message: "模板已還原。注意：背景圖片需在開啟遊戲時重新設定或由雲端載入。", type: 'info' });
                }
            } else if (category === 'sessions') {
                const uuid = extractId(file.name);
                if (uuid) {
                    const historyRecord = await db.history.get(uuid);
                    if (historyRecord) {
                        const dateStr = new Date(historyRecord.endTime).toLocaleString();
                        window.alert(`此進行中遊戲已結束並存放於歷史紀錄中，要下載請先手動刪除該歷史紀錄（時間：${dateStr}）`);
                        setIsLoading(false);
                        return;
                    }
                }
                const session = await restoreSessionBackup(file.id);
                const localTemplate = await db.templates.get(session.templateId) || await db.builtins.get(session.templateId);

                if (localTemplate) {
                    onSessionRestoreSuccess(session);
                } else {
                    showToast({ message: "本機找不到對應計分板，正在搜尋雲端備份...", type: 'info' });
                    const templatesList = await fetchFileList('active', 'templates');
                    const targetFile = templatesList.find(t => extractId(t.name) === session.templateId);

                    if (targetFile) {
                        const templateWithExtra = await restoreBackup(targetFile.id);
                        const { _tempImageBase64, ...cleanTemplate } = templateWithExtra as any;
                        onRestoreSuccess(cleanTemplate);
                        onSessionRestoreSuccess(session);
                        showToast({ message: "已自動還原關聯的計分板與紀錄", type: 'success' });
                    } else {
                        window.alert("對應計分板已遺失，無法還原此紀錄");
                    }
                }

            } else if (category === 'history' && restoreHistoryBackup && onHistoryRestoreSuccess) {
                const record = await restoreHistoryBackup(file.id);
                onHistoryRestoreSuccess(record);
            }
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileDelete = async () => {
        if (!fileToDelete) return;
        const success = await deleteCloudFile(fileToDelete.id);
        if (success) await refreshList();
        setFileToDelete(null);
    };

    const handleRestoreFromTrash = async (file: CloudFile) => {
        const success = await restoreFromTrash(file.id, getResourceType(category));
        if (success) await refreshList();
    };

    const handleEmptyTrash = async () => {
        const success = await emptyTrash(getResourceType(category));
        if (success) await refreshList();
        setShowEmptyTrashConfirm(false);
    };

    const handleConnect = async () => {
        setIsLoading(true);
        await connectToCloud();
        setIsLoading(false);
    };

    const handleDisconnect = async () => {
        await disconnectFromCloud();
        setCloudFiles([]);
        setShowDisconnectConfirm(false);
    };

    // --- SYNC ACTIONS ---

    const handleSyncUpload = async () => {
        if (!onSystemBackup) return;
        setSyncStatus('processing');
        setSyncResult({ success: 0, skipped: 0, failed: [], errors: [], total: 0, current: 0, type: 'upload' });

        try {
            const stats = await onSystemBackup(
                (count, total) => setSyncResult(prev => ({ ...prev, current: count, total })),
                (failed) => setSyncResult(prev => ({ ...prev, failed: [...prev.failed, ...failed] }))
            );
            setSyncResult(prev => ({ ...prev, success: stats.success, skipped: stats.skipped }));
        } catch (e: any) {
            setSyncResult(prev => ({ ...prev, errors: [e.message || "Unknown error"] }));
        } finally {
            setSyncStatus('done');
        }
    };

    const handleSyncDownload = async () => {
        if (!onSystemRestore || !onGetLocalData) return;
        setSyncStatus('processing');
        setSyncResult({ success: 0, skipped: 0, failed: [], errors: [], total: 0, current: 0, type: 'download' });

        try {
            const localData = await onGetLocalData();
            const templatesMap = new Map<string, number>();
            const historyMap = new Map<string, number>();
            const sessionsMap = new Map<string, number>();

            (localData.data.templates || []).forEach((t: any) => templatesMap.set(t.id, t.updatedAt || 0));
            (localData.data.overrides || []).forEach((t: any) => templatesMap.set(t.id, t.updatedAt || 0));
            (localData.data.history || []).forEach((h: any) => historyMap.set(h.id, h.updatedAt || h.endTime || 0));
            (localData.data.sessions || []).forEach((s: any) => sessionsMap.set(s.id, s.lastUpdatedAt || s.startTime || 0));

            const localMeta = { templates: templatesMap, history: historyMap, sessions: sessionsMap };

            const stats = await onSystemRestore(
                localMeta,
                (count, total) => setSyncResult(prev => ({ ...prev, current: count, total })),
                (failed) => setSyncResult(prev => ({ ...prev, failed: [...prev.failed, ...failed] })),
                undefined,
                undefined
            );
            setSyncResult(prev => ({ ...prev, success: stats.success, skipped: stats.skipped }));
        } catch (e: any) {
            setSyncResult(prev => ({ ...prev, errors: [e.message || "Unknown error"] }));
        } finally {
            setSyncStatus('done');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && (syncStatus === 'idle' || syncStatus === 'scanning')) onClose();
            }}
        >
            <ConfirmationModal
                isOpen={!!fileToDelete}
                title={tCloud('confirm_delete_title')}
                message={tCloud('confirm_delete_msg', { name: fileToDelete ? cleanName(fileToDelete.name) : '' })}
                confirmText={tCloud('btn_delete_perm')}
                isDangerous={true}
                onCancel={() => setFileToDelete(null)}
                onConfirm={handleFileDelete}
            />
            <ConfirmationModal
                isOpen={showEmptyTrashConfirm}
                title={tCloud('confirm_empty_title')}
                message={tCloud('confirm_empty_msg')}
                confirmText={tCommon('confirm')}
                isDangerous={true}
                onCancel={() => setShowEmptyTrashConfirm(false)}
                onConfirm={handleEmptyTrash}
            />
            <ConfirmationModal
                isOpen={showDisconnectConfirm}
                title={tCloud('confirm_logout_title')}
                message={tCloud('confirm_logout_msg')}
                confirmText={tCommon('confirm')}
                onCancel={() => setShowDisconnectConfirm(false)}
                onConfirm={handleDisconnect}
            />

            <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh] relative overflow-hidden">

                {showSyncDashboard && (
                    <SyncDashboard
                        onClose={() => { setShowSyncDashboard(false); setSyncStatus('idle'); }}
                        onUpload={handleSyncUpload}
                        onDownload={handleSyncDownload}
                        isSyncing={syncStatus === 'processing'}
                        isScanning={syncStatus === 'scanning'}
                        syncStatus={syncStatus}
                        syncResult={syncResult}
                        scanStats={scanStats}
                    />
                )}

                <div className="flex-none bg-slate-800 rounded-t-2xl px-4 py-3 border-b border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isConnected && (
                                <button
                                    onClick={() => setShowDisconnectConfirm(true)}
                                    className="p-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                                    title={tCloud('disconnect')}
                                >
                                    <CloudOff size={16} />
                                </button>
                            )}
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <DownloadCloud size={20} className="text-sky-400" /> {tCloud('title')}
                                {isMockMode && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">模擬</span>}
                            </h3>
                        </div>

                        <div className="flex items-center gap-2">
                            {isConnected && viewMode === 'active' && (
                                <button
                                    onClick={() => setShowSyncDashboard(true)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 px-3 rounded-lg transition-all flex items-center gap-2 shadow-sm font-bold text-xs"
                                    title={tCloud('sync_title')}
                                >
                                    <ArrowRightLeft size={16} /> {tCloud('open_sync')}
                                </button>
                            )}
                            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSwitchCategory('templates')}
                            disabled={!isConnected}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${category === 'templates' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <LayoutGrid size={14} /> {tCloud('tab_templates')}
                        </button>
                        <button
                            onClick={() => handleSwitchCategory('sessions')}
                            disabled={!isConnected}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${category === 'sessions' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Activity size={14} /> {tCloud('tab_active')}
                        </button>
                        <button
                            onClick={() => handleSwitchCategory('history')}
                            disabled={!isConnected}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${category === 'history' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <History size={14} /> {tCloud('tab_history')}
                        </button>
                    </div>

                    <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700/50">
                        <button onClick={() => handleSwitchMode('active')} disabled={!isConnected} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${viewMode === 'active' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><FolderOpen size={14} /> {tCloud('tab_files')}</button>
                        <button onClick={() => handleSwitchMode('trash')} disabled={!isConnected} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${viewMode === 'trash' ? 'bg-red-900/50 text-red-200 shadow-sm border border-red-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><Trash2 size={14} /> {tCloud('tab_trash')}</button>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-slate-900 relative">

                    {!isConnected ? (
                        // Offline State with Letter-Style
                        <div className="flex flex-col items-center justify-between h-full gap-4 animate-in fade-in zoom-in-95 duration-300">

                            {/* Letter Container */}
                            <div className="w-full bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60 text-slate-300 text-sm leading-relaxed space-y-3 shadow-inner">
                                <h4 className="text-white font-bold text-lg mb-1">{tCloud('greeting')}</h4>
                                <p>{tCloud('p1')}</p>
                                <p>{tCloud('p2')}</p>

                                <div className="w-full flex justify-end mt-4">
                                    <span className="font-hand font-bold text-white text-lg transform -rotate-2 origin-center">
                                        {tCloud('signature')}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="w-full max-w-[200px] py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-900/50 flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}
                                <span>{tCloud('btn_connect')}</span>
                            </button>
                        </div>
                    ) : (
                        // Connected State
                        <>
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500"><RefreshCw size={24} className="animate-spin" /><span className="text-xs">{tCommon('loading')}</span></div>
                            ) : cloudFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">{viewMode === 'trash' ? <Trash2 size={32} className="opacity-50" /> : <UploadCloud size={32} className="opacity-50" />}<span className="text-sm">{viewMode === 'trash' ? tCloud('empty_trash_list') : tCloud('empty_list')}</span></div>
                            ) : (
                                <div className="space-y-2">
                                    {cloudFiles.map(file => (
                                        <div key={file.id} className={`w-full bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center justify-between group transition-all`}>

                                            <div className="shrink-0 mr-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setFileToDelete(file); }}
                                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-900/50 rounded-lg transition-colors"
                                                    title={viewMode === 'active' ? "移至垃圾桶" : tCloud('btn_delete_perm')}
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>

                                            <div className="flex flex-col text-left flex-1 min-w-0">
                                                <div className="font-bold text-slate-200 truncate">{cleanName(file.name)}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Clock size={10} /> {getDisplayDate(file)}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                {viewMode === 'active' ? (
                                                    <button
                                                        onClick={() => handleFileSelect(file)}
                                                        className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                                                        title={tCloud('btn_download_restore')}
                                                    >
                                                        <Download size={18} />
                                                        <span className="text-xs font-bold hidden sm:inline">{tCommon('download')}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRestoreFromTrash(file); }}
                                                        className="p-2 text-emerald-400 hover:text-white bg-slate-900 hover:bg-emerald-600 border border-slate-600 hover:border-emerald-500 rounded-lg transition-colors"
                                                        title={tCloud('btn_restore')}
                                                    >
                                                        <RefreshCcw size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
                {viewMode === 'trash' && cloudFiles.length > 0 && isConnected && (<div className="flex-none p-3 bg-slate-800 border-t border-slate-700"><button onClick={() => setShowEmptyTrashConfirm(true)} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"><Trash2 size={16} /> {tCloud('btn_empty_trash')}</button></div>)}
            </div>
        </div>
    );
};

export default CloudManagerModal;
