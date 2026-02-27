
import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Download, FileJson, Loader2, AlertTriangle, Share2 } from 'lucide-react';
import { BgStatsExport, ImportAnalysisReport, ImportManualLinks } from '../types';
import { bgStatsExportService } from '../services/bgStatsExportService';
import { bgStatsImportService } from '../services/bgStatsImportService';
import { useToast } from '../../../hooks/useToast';
import ImportStagingView from './ImportStagingView';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';

interface BgStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: BgStatsExport, links: ImportManualLinks) => Promise<boolean>;
}

type ExportState = 'idle' | 'processing' | 'ready';
type ImportState = 'file_selection' | 'analyzing' | 'staging' | 'importing';

const BgStatsModal: React.FC<BgStatsModalProps> = ({ isOpen, onClose, onImport }) => {
    // Import State Machine
    const [importState, setImportState] = useState<ImportState>('file_selection');
    const [analysisReport, setAnalysisReport] = useState<ImportAnalysisReport | null>(null);

    // Export State Machine
    const [exportState, setExportState] = useState<ExportState>('idle');
    const [exportUrl, setExportUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const { t } = useIntegrationTranslation();
    const { t: tCommon } = useCommonTranslation();

    useEffect(() => {
        if (!isOpen) {
            if (exportUrl) URL.revokeObjectURL(exportUrl);
            setExportUrl(null);
            setExportState('idle');
            setImportState('file_selection');
            setAnalysisReport(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportState('analyzing');
        const reader = new FileReader();

        reader.onload = async (ev) => {
            try {
                const jsonString = ev.target?.result as string;
                const parsed = JSON.parse(jsonString);

                if (!parsed.games && !parsed.plays && !parsed.locations) {
                    alert(t('bgstats_msg_invalid_format'));
                    setImportState('file_selection');
                    return;
                }

                const report = await bgStatsImportService.analyzeData(parsed);
                setAnalysisReport(report);
                setImportState('staging');

            } catch (error) {
                console.error(error);
                alert(t('bgstats_msg_read_failed'));
                setImportState('file_selection');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.onerror = () => {
            alert(t('bgstats_msg_read_error'));
            setImportState('file_selection');
        };

        reader.readAsText(file);
    };

    const handleStagingConfirm = async (links: ImportManualLinks) => {
        if (!analysisReport) return;

        setImportState('importing');
        try {
            const success = await onImport(analysisReport.sourceData, links);
            if (success) {
                onClose();
            } else {
                setImportState('staging');
            }
        } catch (e) {
            console.error(e);
            showToast({ message: t('bgstats_msg_import_error'), type: 'error' });
            setImportState('staging');
        }
    };

    const handleExportClick = async () => {
        if (exportState === 'idle') {
            setExportState('processing');

            try {
                await new Promise(r => setTimeout(r, 100));
                const exportData = await bgStatsExportService.exportData();
                const jsonString = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                setExportUrl(url);
                setExportState('ready');
            } catch (error) {
                console.error("Export Failed", error);
                showToast({ message: t('bgstats_msg_export_prep_fail'), type: 'error' });
                setExportState('idle');
            }
        }
        else if (exportState === 'ready' && exportUrl) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const filename = `BGStats_Export_${dateStr}.json`;

            try {
                const blob = await (await fetch(exportUrl)).blob();
                const file = new File([blob], filename, { type: 'application/json' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'BG Stats Export',
                        text: 'Board Game ScorePad Data'
                    });
                    showToast({ message: t('bgstats_msg_share_success'), type: 'success' });
                    return;
                }
            } catch (e) {
                console.log("Share API skipped or failed", e);
            }

            const a = document.createElement('a');
            a.href = exportUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast({ message: t('bgstats_msg_download_start'), type: 'success' });
        }
    };

    // [UX Improvement] If in staging mode, render full-screen
    if (importState === 'staging' && analysisReport) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col animate-in fade-in duration-200">
                <ImportStagingView
                    report={analysisReport}
                    onConfirm={handleStagingConfirm}
                    onCancel={() => setImportState('file_selection')}
                    isProcessing={false}
                />
            </div>
        );
    }

    // Default Modal Layout for other states
    return (
        <div
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden h-[600px] max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {importState === 'importing' ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 size={48} className="animate-spin text-emerald-500" />
                        <span className="text-white font-bold">{t('bgstats_state_importing')}</span>
                        <span className="text-xs text-slate-500">{t('bgstats_warn_keep_open')}</span>
                    </div>
                ) : (
                    <>
                        <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between flex-none">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FileJson size={20} className="text-indigo-400" />
                                {t('bgstats_title')}
                            </h3>
                            <button onClick={onClose} className="text-slate-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 text-sm text-indigo-200 leading-relaxed">
                                <p className="flex items-start gap-2">
                                    <AlertTriangle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                                    {t('bgstats_desc')}
                                </p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={importState === 'analyzing' || exportState === 'processing'}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {importState === 'analyzing' ? (
                                        <Loader2 size={24} className="animate-spin" />
                                    ) : (
                                        <Upload size={24} className="group-hover:scale-110 transition-transform" />
                                    )}
                                    <span>{importState === 'analyzing' ? t('bgstats_state_analyzing') : t('bgstats_btn_import')}</span>
                                    {importState !== 'analyzing' && <span className="text-[10px] font-normal opacity-80">{t('bgstats_btn_import_sub')}</span>}
                                </button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />

                                <button
                                    onClick={handleExportClick}
                                    disabled={importState === 'analyzing' || exportState === 'processing'}
                                    className={`
                                w-full py-4 rounded-xl font-bold border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group
                                ${exportState === 'ready'
                                            ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-900/50'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                        }
                            `}
                                >
                                    {exportState === 'processing' ? (
                                        <Loader2 size={24} className="animate-spin text-sky-400" />
                                    ) : exportState === 'ready' ? (
                                        <div className="flex items-center gap-2">
                                            <Share2 size={24} className="group-hover:scale-110 transition-transform" />
                                        </div>
                                    ) : (
                                        <Download size={24} className="text-sky-400 group-hover:scale-110 transition-transform" />
                                    )}

                                    <span>
                                        {exportState === 'idle' && t('bgstats_btn_export_idle')}
                                        {exportState === 'processing' && t('bgstats_btn_export_processing')}
                                        {exportState === 'ready' && t('bgstats_btn_export_ready')}
                                    </span>

                                    {exportState === 'idle' && <span className="text-[10px] font-normal text-slate-500">{t('bgstats_btn_export_sub')}</span>}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-800/50 border-t border-slate-800 text-center flex-none">
                            <p className="text-[10px] text-slate-500">
                                {t('bgstats_footer')}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BgStatsModal;
