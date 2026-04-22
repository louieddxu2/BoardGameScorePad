
import React, { useState } from 'react';
import { UploadCloud, DownloadCloud, AlertTriangle, CheckCircle, XCircle, ArrowRight, Loader2, Database, LayoutGrid, History, Activity } from 'lucide-react';
import { useCloudTranslation } from '../../../i18n/cloud';

interface SyncDashboardProps {
    onClose: () => void;
    onUpload: () => void;
    onDownload: () => void;
    isSyncing: boolean;
    isScanning?: boolean; // New Prop
    syncStatus: 'idle' | 'scanning' | 'processing' | 'done';
    syncResult: {
        success: number;
        skipped: number;
        failed: string[];
        errors: string[];
        total: number;
        current: number;
        currentItem?: string;
        type: 'upload' | 'download' | null;
    };
    scanStats?: {
        upload: { templates: number; sessions: number; history: number };
        download: { templates: number; sessions: number; history: number };
    };
}

const SyncDashboard: React.FC<SyncDashboardProps> = ({
    onClose,
    onUpload,
    onDownload,
    isSyncing,
    isScanning,
    syncStatus,
    syncResult,
    scanStats
}) => {
    const { t: tCloud } = useCloudTranslation();
    const [confirmMode, setConfirmMode] = useState<'upload' | 'download' | null>(null);

    // --- Render Logic ---

    if (syncStatus === 'processing') {
        return (
            <div className="modal-body absolute inset-0 z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-status-success/20 blur-xl rounded-full animate-pulse"></div>
                    <Loader2 size={64} className="text-status-success animate-spin relative z-10" />
                </div>
                <h3 className="text-xl font-bold text-txt-primary mb-2">
                    {syncResult.type === 'upload' ? tCloud('sync_backup_processing') : tCloud('sync_restore_processing')}
                </h3>
                <p className="text-txt-secondary text-sm font-mono mb-4">
                    {syncResult.current} / {syncResult.total}
                </p>
                <div className="w-full max-w-xs h-2 modal-bg-elevated rounded-full overflow-hidden border border-surface-border mb-2">
                    <div
                        className="h-full bg-status-success transition-all duration-300 ease-out"
                        style={{ width: `${syncResult.total > 0 ? (syncResult.current / syncResult.total) * 100 : 0}%` }}
                    />
                </div>
                <p className="text-xs text-txt-muted h-4 truncate max-w-xs text-center">
                    {syncResult.currentItem || tCloud('sync_preparing')}
                </p>
            </div>
        );
    }

    if (syncStatus === 'done') {
        return (
            <div className="absolute inset-0 z-50 bg-modal-bg flex flex-col animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl ${syncResult.errors.length > 0 ? 'bg-status-warning/20 text-status-warning' : 'bg-status-success/20 text-status-success'}`}>
                        {syncResult.errors.length > 0 ? <AlertTriangle size={40} /> : <CheckCircle size={40} />}
                    </div>

                    <h3 className="text-2xl font-bold text-txt-primary mb-6">
                        {syncResult.type === 'upload' ? tCloud('sync_backup_done') : tCloud('sync_restore_done')}
                    </h3>

                    <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8">
                        <div className="modal-bg-elevated p-4 rounded-xl text-center border border-surface-border">
                            <div className="text-2xl font-black text-status-success">{syncResult.success}</div>
                            <div className="text-xs text-txt-muted font-bold uppercase mt-1">{tCloud('sync_status_success')}</div>
                        </div>
                        <div className="modal-bg-elevated p-4 rounded-xl text-center border border-surface-border">
                            <div className="text-2xl font-black text-status-info">{syncResult.skipped}</div>
                            <div className="text-xs text-txt-muted font-bold uppercase mt-1">{tCloud('sync_status_skipped')}</div>
                        </div>
                        <div className="modal-bg-elevated p-4 rounded-xl text-center border border-surface-border">
                            <div className={`text-2xl font-black ${syncResult.failed.length > 0 ? 'text-status-danger' : 'text-txt-muted'}`}>{syncResult.failed.length}</div>
                            <div className="text-xs text-txt-muted font-bold uppercase mt-1">{tCloud('sync_status_failed')}</div>
                        </div>
                    </div>

                    {syncResult.errors.length > 0 && (
                        <div className="w-full max-w-sm bg-status-danger/10 border border-status-danger/30 rounded-xl p-4 mb-4">
                            <h4 className="text-status-danger font-bold text-sm mb-2 flex items-center gap-2"><XCircle size={14} /> {tCloud('sync_error_details')}</h4>
                            <div className="text-xs text-status-danger/80 space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                                {syncResult.errors.map((err, i) => <div key={i}>• {err}</div>)}
                            </div>
                        </div>
                    )}

                    <div className="flex-1"></div>

                    <button onClick={onClose} className="w-full max-w-sm py-4 btn-modal-secondary transition-all active:scale-95 border border-surface-border">
                        {tCloud('sync_btn_close')}
                    </button>
                </div>
            </div>
        );
    }

    // --- Stats Block Helper ---
    const renderStats = (type: 'upload' | 'download') => {
        if (!scanStats || isScanning) return <div className="h-24 flex items-center justify-center text-txt-muted text-xs gap-2 modal-bg-recessed/30 rounded-xl border border-surface-border/50 mt-4"><Loader2 size={16} className="animate-spin" /> {tCloud('sync_scanning')}</div>;

        const data = type === 'upload' ? scanStats.upload : scanStats.download;
        const includeSessions = type === 'upload';
        const total = data.templates + (includeSessions ? data.sessions : 0) + data.history;
        const hasData = total > 0;

        const boxClass = `p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${hasData ? 'modal-bg-elevated border-surface-border' : 'bg-modal-bg border-surface-border opacity-60'}`;
        const numberClass = `text-2xl font-black ${hasData ? 'text-txt-primary' : 'text-txt-muted/50'}`;
        const labelClass = "text-xs text-txt-muted uppercase flex justify-center items-center gap-1.5 font-bold";

        return (
            <div className="grid grid-cols-3 gap-3 mt-4">
                <div className={boxClass}>
                    <div className={numberClass}>{data.templates}</div>
                    <div className={labelClass}><LayoutGrid size={12} /> {tCloud('sync_stat_games')}</div>
                </div>

                {/* Only show session count for Upload */}
                {includeSessions ? (
                    <div className={boxClass}>
                        <div className={numberClass}>{data.sessions}</div>
                        <div className={labelClass}><Activity size={12} /> {tCloud('sync_stat_active')}</div>
                    </div>
                ) : (
                    // For Download, show a placeholder or empty
                    <div className="p-3 rounded-xl border bg-modal-bg border-surface-border opacity-40 flex flex-col items-center justify-center gap-1">
                        <div className="text-2xl font-black text-txt-muted/50">-</div>
                        <div className="text-xs text-txt-muted uppercase flex justify-center items-center gap-1.5 font-bold"><Activity size={12} /> {tCloud('sync_stat_active')}</div>
                    </div>
                )}

                <div className={boxClass}>
                    <div className={numberClass}>{data.history}</div>
                    <div className={labelClass}><History size={12} /> {tCloud('sync_stat_history')}</div>
                </div>
            </div>
        );
    };

    // --- Main Action Selection UI ---

    return (
        <div className="absolute inset-0 z-50 bg-modal-bg/95 flex flex-col animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex-none p-4 border-b border-surface-border flex items-center justify-between modal-bg-elevated">
                <h2 className="text-lg font-bold text-txt-primary flex items-center gap-2">
                    <Database size={20} className="text-brand-secondary" />
                    {tCloud('sync_title')}
                </h2>
                <button onClick={onClose} className="text-txt-muted hover:text-txt-primary p-2 rounded-full hover:bg-surface-bg transition-colors">
                    <ArrowRight size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Upload Section */}
                <div className={`rounded-2xl border transition-all duration-300 overflow-hidden active:scale-[0.98] ${confirmMode === 'upload' ? 'bg-brand-secondary/5 border-brand-secondary ring-1 ring-brand-secondary/20 shadow-lg' : 'bg-modal-bg border-surface-border hover:border-surface-border-hover shadow-sm'}`}>
                    <div
                        className="p-5 cursor-pointer flex flex-col"
                        onClick={() => setConfirmMode(confirmMode === 'upload' ? null : 'upload')}
                    >
                        {/* Header Row */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-brand-secondary/10 text-brand-secondary shrink-0 border border-brand-secondary/20">
                                <UploadCloud size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-txt-primary">{tCloud('sync_backup_title')}</h3>
                                <p className="text-xs text-txt-secondary">{tCloud('sync_backup_desc')}</p>
                            </div>
                        </div>

                        {/* Stats Row (Full Width) */}
                        {renderStats('upload')}
                    </div>

                    {confirmMode === 'upload' && (
                        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200 border-t border-surface-border/50 pt-4 mt-2">
                            <div className="modal-bg-recessed/50 rounded-xl p-3 text-xs text-txt-muted mb-4 space-y-2 border border-surface-border">
                                <div className="flex items-start gap-2">
                                    <span className="text-status-success shrink-0 mt-0.5">●</span>
                                    <span>{tCloud('sync_msg_limit')}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-status-success shrink-0 mt-0.5">●</span>
                                    <span>{tCloud('sync_msg_newer')}</span>
                                </div>
                            </div>
                            <button
                                onClick={onUpload}
                                className="w-full py-3 bg-brand-secondary hover:filter hover:brightness-110 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <UploadCloud size={18} /> {tCloud('sync_btn_upload')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Download Section */}
                <div className={`rounded-2xl border transition-all duration-300 overflow-hidden active:scale-[0.98] ${confirmMode === 'download' ? 'bg-status-info/5 border-status-info ring-1 ring-status-info/20 shadow-lg' : 'bg-modal-bg border-surface-border hover:border-surface-border-hover shadow-sm'}`}>
                    <div
                        className="p-5 cursor-pointer flex flex-col"
                        onClick={() => setConfirmMode(confirmMode === 'download' ? null : 'download')}
                    >
                        {/* Header Row */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-status-info/10 text-status-info shrink-0 border border-status-info/20">
                                <DownloadCloud size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-txt-primary">{tCloud('sync_restore_title')}</h3>
                                <p className="text-xs text-txt-secondary">{tCloud('sync_restore_desc')}</p>
                            </div>
                        </div>

                        {/* Stats Row (Full Width) */}
                        {renderStats('download')}
                    </div>

                    {confirmMode === 'download' && (
                        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200 border-t border-surface-border/50 pt-4 mt-2">
                            <div className="bg-status-warning/10 rounded-xl p-3 text-xs text-status-warning/80 mb-4 space-y-2 border border-status-warning/30">
                                <p className="font-bold flex items-center gap-2"><AlertTriangle size={12} /> {tCloud('sync_restore_notice')}</p>
                                <p>{tCloud('sync_msg_restore_warn')}</p>
                            </div>
                            <button
                                onClick={onDownload}
                                className="w-full py-3 bg-status-info hover:filter hover:brightness-110 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <DownloadCloud size={18} /> {tCloud('sync_btn_download')}
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default SyncDashboard;
