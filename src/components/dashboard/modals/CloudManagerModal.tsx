
import React, { useState, useEffect } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { DownloadCloud, X, FolderOpen, Trash2, RefreshCw, UploadCloud, Download, Clock, RefreshCcw, Activity, LayoutGrid, History, Loader2, AlertTriangle, CloudOff, Cloud, ArrowRightLeft, Database } from 'lucide-react';
import { CloudFile, CloudResourceType } from '../../../services/googleDrive';
import { useToast } from '../../../hooks/useToast';
import { useConfirm } from '../../../hooks/useConfirm';
import SyncDashboard from './SyncDashboard';
import { db } from '../../../db';
import { useCommonTranslation } from '../../../i18n/common';
import { useCloudTranslation } from '../../../i18n/cloud';

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
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { t: tCommon, language } = useCommonTranslation();

    const { t: tCloud } = useCloudTranslation();

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

    // [Migrated] 歷史堆疊由 useDashboardModals.ts 的 useModalBackHandler('cloud-manager') 統一管理
    // 移除原本的手動 pushState/popstate 處理

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
                    showToast({ message: tCloud('cloud_image_note'), type: 'info' });
                }
            } else if (category === 'sessions') {
                const uuid = extractId(file.name);
                if (uuid) {
                    const historyRecord = await db.history.get(uuid);
                    if (historyRecord) {
                        const dateStr = new Date(historyRecord.endTime).toLocaleString();
                        await confirm({
                            title: tCommon('info'),
                            message: tCloud('cloud_alert_session_in_history', { date: dateStr }),
                            confirmText: tCommon('confirm'),
                            hideCancel: true
                        });
                        setIsLoading(false);
                        return;
                    }
                }
                const session = await restoreSessionBackup(file.id);
                const localTemplate = await db.templates.get(session.templateId) || await db.builtins.get(session.templateId);

                if (localTemplate) {
                    onSessionRestoreSuccess(session);
                } else {
                    showToast({ message: tCloud('cloud_toast_find_linked_template'), type: 'info' });
                    const templatesList = await fetchFileList('active', 'templates');
                    const targetFile = templatesList.find(t => extractId(t.name) === session.templateId);

                    if (targetFile) {
                        const templateWithExtra = await restoreBackup(targetFile.id);
                        const { _tempImageBase64, ...cleanTemplate } = templateWithExtra as any;
                        onRestoreSuccess(cleanTemplate);
                        onSessionRestoreSuccess(session);
                        showToast({ message: tCloud('cloud_toast_restore_all_success'), type: 'success' });
                    } else {
                        await confirm({
                            title: tCommon('info'),
                            message: tCloud('cloud_alert_template_missing'),
                            confirmText: tCommon('confirm'),
                            hideCancel: true
                        });
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

    const handleFileDelete = async (file: CloudFile) => {
        const ok = await confirm({
            title: tCloud('cloud_confirm_delete_title'),
            message: tCloud('cloud_confirm_delete_msg', { name: cleanName(file.name) }),
            confirmText: tCloud('cloud_delete_perm'),
            isDangerous: true
        });

        if (ok) {
            const success = await deleteCloudFile(file.id);
            if (success) await refreshList();
        }
    };

    const handleRestoreFromTrash = async (file: CloudFile) => {
        const success = await restoreFromTrash(file.id, getResourceType(category));
        if (success) await refreshList();
    };

    const handleEmptyTrash = async () => {
        const ok = await confirm({
            title: tCloud('cloud_confirm_empty_title'),
            message: tCloud('cloud_confirm_empty_msg'),
            confirmText: tCommon('confirm'),
            isDangerous: true
        });

        if (ok) {
            const success = await emptyTrash(getResourceType(category));
            if (success) await refreshList();
        }
    };

    const handleConnect = async () => {
        setIsLoading(true);
        await connectToCloud();
        setIsLoading(false);
    };

    const handleDisconnect = async () => {
        const ok = await confirm({
            title: tCloud('cloud_confirm_logout_title'),
            message: tCloud('cloud_confirm_logout_msg'),
            confirmText: tCommon('confirm')
        });

        if (ok) {
            await disconnectFromCloud();
            setCloudFiles([]);
        }
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
            className="modal-backdrop z-50 animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget && (syncStatus === 'idle' || syncStatus === 'scanning')) onClose();
            }}
        >

            <div className="modal-container w-full max-w-md flex flex-col h-[600px] max-h-[85vh] relative overflow-hidden animate-in zoom-in-95 duration-200">

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

                <div className="flex-none modal-bg-elevated rounded-t-2xl px-4 py-3 border-b border-surface-border space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isConnected && (
                                <button
                                    onClick={handleDisconnect}
                                    className="p-1.5 bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 rounded-lg text-status-danger transition-colors"
                                    title={tCloud('cloud_disconnect')}
                                >
                                    <CloudOff size={16} />
                                </button>
                            )}
                            <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
                                <DownloadCloud size={20} className="text-status-info" /> {tCloud('cloud_title')}
                                {isMockMode && <span className="text-[10px] bg-status-warning/10 text-status-warning px-2 py-0.5 rounded border border-status-warning/30 font-black">{tCloud('cloud_mock_badge')}</span>}
                            </h3>
                        </div>

                        <div className="flex items-center gap-2">
                            {isConnected && viewMode === 'active' && (
                                <button
                                    onClick={() => setShowSyncDashboard(true)}
                                    className="bg-brand-primary hover:filter hover:brightness-110 text-white p-1.5 px-3 rounded-lg transition-all flex items-center gap-2 shadow-sm font-bold text-xs active:scale-95"
                                    title={tCloud('sync_title')}
                                >
                                    <ArrowRightLeft size={16} /> {tCloud('cloud_open_sync')}
                                </button>
                            )}
                            <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors"><X size={24} /></button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSwitchCategory('templates')}
                            disabled={!isConnected}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${category === 'templates' ? 'bg-brand-primary text-white shadow-md' : 'modal-bg-elevated border border-surface-border text-txt-muted hover:text-txt-secondary'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <LayoutGrid size={14} /> {tCloud('cloud_tab_templates')}
                        </button>
                        <button
                            onClick={() => handleSwitchCategory('sessions')}
                            disabled={!isConnected}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${category === 'sessions' ? 'bg-brand-primary text-white shadow-md' : 'modal-bg-elevated border border-surface-border text-txt-muted hover:text-txt-secondary'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Activity size={14} /> {tCloud('cloud_tab_active')}
                        </button>
                        <button
                            onClick={() => handleSwitchCategory('history')}
                            disabled={!isConnected}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${category === 'history' ? 'bg-brand-primary text-white shadow-md' : 'modal-bg-elevated border border-surface-border text-txt-muted hover:text-txt-secondary'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <History size={14} /> {tCloud('cloud_tab_history')}
                        </button>
                    </div>

                    <div className="flex gap-2 modal-bg-recessed p-1 rounded-lg border border-surface-border">
                        <button onClick={() => handleSwitchMode('active')} disabled={!isConnected} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 ${viewMode === 'active' ? 'bg-status-info text-white shadow-sm' : 'text-txt-muted hover:text-txt-secondary hover:modal-bg-elevated'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><FolderOpen size={14} /> {tCloud('cloud_tab_files')}</button>
                        <button onClick={() => handleSwitchMode('trash')} disabled={!isConnected} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 ${viewMode === 'trash' ? 'bg-status-danger/20 text-status-danger shadow-sm border border-status-danger/30' : 'text-txt-muted hover:text-txt-secondary hover:modal-bg-elevated'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><Trash2 size={14} /> {tCloud('cloud_tab_trash')}</button>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-modal-bg relative transition-colors">

                    {!isConnected ? (
                        // Offline State with Letter-Style
                        <div className="flex flex-col items-center justify-between h-full gap-4 animate-in fade-in zoom-in-95 duration-300">

                            {/* Letter Container */}
                            <div className="w-full modal-bg-recessed p-6 rounded-2xl border border-surface-border text-txt-secondary text-sm leading-relaxed space-y-4 shadow-inner animate-in slide-in-from-bottom-4 duration-500">
                                <h4 className="text-txt-primary font-bold text-xl mb-1">{tCloud('greeting')}</h4>
                                <p>{tCloud('p1')}</p>
                                <p>{tCloud('p2')}</p>

                                <div className="w-full flex justify-end mt-6">
                                    <span className="font-hand font-bold text-txt-primary text-xl transform -rotate-2 origin-center opacity-80">
                                        {tCloud('signature')}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="w-full max-w-[200px] py-3 bg-status-info hover:filter hover:brightness-110 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}
                                <span>{tCloud('cloud_btn_connect')}</span>
                            </button>
                        </div>
                    ) : (
                        // Connected State
                        <>
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-txt-muted"><RefreshCw size={24} className="animate-spin" /><span className="text-xs">{tCommon('loading')}</span></div>
                            ) : cloudFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-txt-muted">{viewMode === 'trash' ? <Trash2 size={32} className="opacity-50" /> : <UploadCloud size={32} className="opacity-50" />}<span className="text-sm">{viewMode === 'trash' ? tCloud('cloud_empty_trash_list') : tCloud('cloud_empty_list')}</span></div>
                            ) : (
                                <div className="space-y-2">
                                    {cloudFiles.map(file => (
                                        <div key={file.id} className="w-full modal-bg-elevated border border-surface-border p-3 rounded-xl flex items-center justify-between group transition-all hover:bg-surface-bg-alt hover:border-surface-border-hover shadow-sm">

                                            <div className="shrink-0 mr-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleFileDelete(file); }}
                                                    className="p-2 text-txt-muted hover:text-status-danger hover:bg-status-danger/10 rounded-lg transition-colors"
                                                    title={viewMode === 'active' ? tCloud('cloud_tooltip_trash') : tCloud('cloud_delete_perm')}
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>

                                            <div className="flex flex-col text-left flex-1 min-w-0">
                                                <div className="font-bold text-txt-primary truncate">{cleanName(file.name)}</div>
                                                <div className="text-xs text-txt-muted flex items-center gap-1 mt-0.5">
                                                    <Clock size={10} /> {getDisplayDate(file)}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                {viewMode === 'active' ? (
                                                    <button
                                                        onClick={() => handleFileSelect(file)}
                                                        className="p-2 bg-status-info hover:filter hover:brightness-110 text-white rounded-lg shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                                                        title={tCloud('cloud_action_download')}
                                                    >
                                                        <Download size={18} />
                                                        <span className="text-xs font-bold hidden sm:inline">{tCommon('download')}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRestoreFromTrash(file); }}
                                                        className="p-2 text-status-success hover:text-white modal-bg-recessed hover:bg-status-success border border-surface-border hover:border-status-success rounded-lg transition-colors"
                                                        title={tCloud('cloud_restore')}
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
                {viewMode === 'trash' && cloudFiles.length > 0 && isConnected && (<div className="flex-none p-3 modal-bg-elevated border-t border-surface-border"><button onClick={handleEmptyTrash} className="w-full py-2 bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30 text-status-danger text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"><Trash2 size={16} /> {tCloud('cloud_empty_trash')}</button></div>)}
            </div>
        </div>
    );
};

export default CloudManagerModal;
