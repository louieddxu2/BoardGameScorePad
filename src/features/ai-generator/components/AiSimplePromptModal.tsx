import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Play, Loader2, AlertCircle, X, Sparkles } from 'lucide-react';
import { useAiSimpleGenerator } from '../hooks/useAiSimpleGenerator';
import { useAiGeneratorTranslation } from '../../../i18n/aiGenerator';
import { GameTemplate } from '../../../types';
import CameraView from '../../../components/scanner/CameraView';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { getContrastTextStyles } from '../../../utils/ui';

export interface AiSimplePromptModalProps {
    isOpen: boolean;
    gameName: string;
    onClose: () => void;
    onDirectStart: () => void;
    onAiSuccess: (result: Partial<GameTemplate>) => void;
    onSwitchToAdvanced: () => void;
}

const AiSimplePromptModal: React.FC<AiSimplePromptModalProps> = ({
    isOpen, gameName, onClose, onDirectStart, onAiSuccess, onSwitchToAdvanced
}) => {
    const { t } = useAiGeneratorTranslation();
    const isAdvanceUser = localStorage.getItem('advance_user') === 'true';

    const aiSimple = useAiSimpleGenerator();
    const {
        simpleStatus, gemmaStatus, flashStatus,
        gemmaResult, flashResult,
        gemmaElapsedTime, flashElapsedTime,
        gemmaError, flashError,
        processAndGenerateSimple, resetSimple, abortSimpleAll
    } = aiSimple;

    const { zIndex } = useModalBackHandler(isOpen, onClose, 'ai-simple-prompt-modal');
    const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const objectUrls = queuedFiles.map(file => URL.createObjectURL(file));
        setPreviews(objectUrls);
        return () => objectUrls.forEach(url => URL.revokeObjectURL(url));
    }, [queuedFiles]);

    useEffect(() => {
        if (!isOpen) { resetSimple(); setQueuedFiles([]); }
    }, [isOpen, resetSimple]);

    if (!isOpen) return null;

    const handleCameraCapture = (blobs: Blob[]) => {
        if (!blobs || blobs.length === 0) return;
        const newFiles = blobs.map((blob, idx) => new File([blob], `scan_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' }));
        setQueuedFiles(prev => [...prev, ...newFiles]);
        setIsScannerOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        setQueuedFiles(prev => [...prev, ...fileList]);

        e.target.value = '';
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setQueuedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async () => {
        if (queuedFiles.length === 0) return;
        await processAndGenerateSimple(queuedFiles, gameName);
    };

    const renderColumnList = (result: any, statusStr: string, errStr: string | null) => {
        if (statusStr === 'generating') {
            return (
                <div className="flex flex-col items-center justify-center py-8 text-txt-muted gap-2 select-none">
                    <Loader2 size={20} className="animate-spin text-brand-primary" />
                    <span className="text-[10px] font-medium">{t('status_analyzing')}</span>
                </div>
            );
        }
        if (statusStr === 'error') {
            return (
                <div className="flex flex-col items-center justify-center py-6 text-status-danger text-center px-2 gap-1.5 bg-status-danger/5 rounded-xl border border-status-danger/10 select-none">
                    <AlertCircle size={16} className="animate-pulse" />
                    <span className="text-[10px] font-bold">{t('status_failed')}</span>
                    <span className="text-[9px] text-txt-muted truncate max-w-full">
                        {errStr === 'ai_error_rate_limit' ? t('error_rate_limit') : t('error_generic')}
                    </span>
                </div>
            );
        }
        if (!result?.template?.columns) {
            return (
                <div className="flex flex-col items-center justify-center py-8 text-txt-muted text-center px-1 select-none">
                    <span className="text-[10px]">{t('no_columns')}</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-0.5 scrollbar-thin select-none">
                {result.template.columns.map((col: any, idx: number) => {
                    // 精簡對照表
                    const typeMap: Record<string, string> = {
                        'a1+next': t('type_accum'),
                        'a1×c1': t('type_rate'),
                        'a1×a2': t('type_product'),
                        '(a1×a2)+next': t('type_prod_accum')
                    };
                    let displayFormula = col.inputType === 'clicker' ? t('type_clicker') :
                                         (col.formula && col.formula.includes('f1') ? t('type_lookup') :
                                         (typeMap[col.formula || ''] || t('type_plain')));

                    return (
                        <div key={col.id || idx} className="flex flex-col py-1 border-b border-surface-border/20 last:border-0">
                            <span className="text-[11px] font-bold truncate max-w-full leading-tight" style={{ color: col.color || 'var(--c-txt-primary)', ...getContrastTextStyles(col.color || '') }}>
                                {col.name}
                            </span>
                            <span className="inline-flex text-[9px] font-bold px-1 py-0.2 border border-surface-border/40 bg-surface-bg-alt text-txt-secondary rounded-sm self-start mt-0.5 whitespace-nowrap">
                                {displayFormula}
                                {col.inputType === 'clicker' && ' [+]'}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const isBothDone = (flashStatus === 'success' || flashStatus === 'error') && (gemmaStatus === 'success' || gemmaStatus === 'error');
    const isProcessing = simpleStatus === 'compressing' || simpleStatus === 'generating' || simpleStatus === 'success';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ zIndex }} onClick={(e) => { if (e.target === e.currentTarget) { abortSimpleAll(); resetSimple(); onClose(); } }}>
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
            />

            <div className="modal-container w-[92vw] max-w-sm bg-app-bg shadow-2xl relative overflow-hidden p-0 border border-modal-border max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="h-1 w-full bg-brand-primary" />
                <div className="p-5 overflow-y-auto scrollbar-thin flex flex-col max-h-[calc(85vh-4px)]">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-3 shrink-0">
                        <div className="flex items-center gap-1 text-brand-primary">
                            <Sparkles size={18} />
                            <h3 className="font-black text-lg tracking-tight select-none">{t('simple_title')}</h3>
                        </div>
                        <div className="flex items-center shrink-0 select-none">
                            {isAdvanceUser && !isProcessing && (
                                <div className="flex bg-surface-bg-alt border border-surface-border rounded-lg p-0.5 mr-2">
                                    <button type="button" className="px-2 py-0.5 text-[10px] font-black rounded-md transition-all bg-brand-primary text-white shadow-sm">{t('tab_simple')}</button>
                                    <button type="button" onClick={() => { resetSimple(); onSwitchToAdvanced(); }} className="px-2 py-0.5 text-[10px] font-black rounded-md transition-all text-txt-muted hover:text-txt-primary">{t('tab_advanced')}</button>
                                </div>
                            )}
                            <button onClick={() => { abortSimpleAll(); resetSimple(); onClose(); }} className="p-1 text-txt-muted hover:text-txt-primary bg-surface-bg-alt rounded-lg transition-colors"><X size={18} /></button>
                        </div>
                    </div>

                    {/* Content Area */}
                    {simpleStatus !== 'idle' ? (
                        <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300 w-full select-none">
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                {/* 左軌極速 */}
                                <div className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${flashStatus === 'success' ? 'bg-status-success/5 border-status-success/30 text-status-success' : flashStatus === 'error' ? 'bg-status-danger/5 border-status-danger/30 text-status-danger' : 'bg-surface-bg-alt border-surface-border text-txt-muted animate-pulse'}`}>
                                    <span className="text-[10px] font-black tracking-tight">{t('label_flash_version')}</span>
                                    <span className="text-[9px] font-mono font-medium mt-0.5 flex items-center gap-1">
                                        {flashStatus === 'generating' ? <><Loader2 size={10} className="animate-spin text-brand-primary" /><span>{t('elapsed_seconds').replace('{count}', flashElapsedTime.toString())}</span></> : (flashStatus === 'success' ? t('status_done') : (flashStatus === 'error' ? t('status_failed') : t('status_queued')))}
                                    </span>
                                </div>
                                {/* 右軌大師 */}
                                <div className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${gemmaStatus === 'success' ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' : gemmaStatus === 'error' ? 'bg-status-danger/5 border-status-danger/30 text-status-danger' : 'bg-surface-bg-alt border-surface-border text-txt-muted animate-pulse'}`}>
                                    <span className="text-[10px] font-black tracking-tight">{t('label_gemma_version')}</span>
                                    <span className="text-[9px] font-mono font-medium mt-0.5 flex items-center gap-1">
                                        {gemmaStatus === 'generating' ? <><Loader2 size={10} className="animate-spin text-brand-secondary" /><span>{t('elapsed_seconds').replace('{count}', gemmaElapsedTime.toString())}</span></> : (gemmaStatus === 'success' ? t('status_done') : (gemmaStatus === 'error' ? t('status_failed') : t('status_queued')))}
                                    </span>
                                </div>
                            </div>

                            {/* 雙軌實時預覽板 */}
                            <div className="grid grid-cols-2 gap-2 mt-1 mb-4 p-2 bg-modal-bg-recessed border border-surface-border rounded-xl shadow-inner min-h-[140px]">
                                <div className="flex flex-col gap-1.5 p-1 border-r border-surface-border/40 pr-2">
                                    <span className="text-[9px] font-bold text-txt-muted pb-1 border-b border-surface-border/30 mb-1 truncate">{flashStatus === 'success' ? '⚡ Gemini 3.0' : t('label_flash_version')}</span>
                                    {renderColumnList(flashResult, flashStatus, flashError)}
                                </div>
                                <div className="flex flex-col gap-1.5 p-1 pl-2">
                                    <span className="text-[9px] font-bold text-txt-muted pb-1 border-b border-surface-border/30 mb-1 truncate">{gemmaStatus === 'success' ? '🏆 Gemma 4' : t('label_gemma_version')}</span>
                                    {renderColumnList(gemmaResult, gemmaStatus, gemmaError)}
                                </div>
                            </div>

                            {/* 雙版本套用按鈕 */}
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button onClick={() => { if (flashResult) { onAiSuccess(flashResult.template); resetSimple(); setQueuedFiles([]); onClose(); } }} disabled={!flashResult} className={`py-3 px-2 rounded-xl font-bold text-xs tracking-tight transition-all active:scale-97 shadow-sm border ${flashResult ? 'bg-surface-bg hover:bg-surface-bg-alt text-txt-primary border-surface-border' : 'bg-surface-bg/30 text-txt-muted/40 border-surface-border/20 cursor-not-allowed'}`}>{t('btn_apply_flash')}</button>
                                <button onClick={() => { if (gemmaResult) { onAiSuccess(gemmaResult.template); resetSimple(); setQueuedFiles([]); onClose(); } }} disabled={!gemmaResult} className={`py-3 px-2 rounded-xl font-black text-xs tracking-tight transition-all active:scale-97 shadow-md ${gemmaResult ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white hover:brightness-105' : 'bg-surface-bg/30 text-txt-muted/40 border border-surface-border/20 cursor-not-allowed'}`}>{t('btn_apply_gemma')}</button>
                            </div>

                            <div className="mt-3">
                                {!isBothDone ? (
                                    <button onClick={() => { abortSimpleAll(); resetSimple(); onClose(); }} className="w-full py-2.5 text-status-danger/80 hover:text-status-danger font-medium rounded-xl bg-status-danger/5 hover:bg-status-danger/10 border border-status-danger/10 active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"><X size={14} />{t('btn_cancel')}</button>
                                ) : (
                                    <button onClick={resetSimple} className="w-full py-2.5 text-txt-muted hover:text-txt-secondary font-bold rounded-xl bg-surface-bg hover:bg-surface-bg-alt border border-surface-border active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5">{t('btn_re_analyze')}</button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="inline-flex items-center px-3 py-1 bg-surface-bg border border-surface-border rounded-full mb-3 shrink-0 self-start select-none">
                                <span className="text-xs font-bold text-txt-secondary truncate max-w-[240px]">🎮 {gameName}</span>
                            </div>
                            <p className="text-txt-primary font-medium mb-3 text-[14px] leading-snug select-none">{t('simple_desc')}</p>

                            {/* 圖片選照佇列 */}
                            {queuedFiles.length > 0 && (
                                <div className="mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-brand-primary flex items-center gap-1"><Sparkles size={12} />{t('status_selected_count').replace('{count}', queuedFiles.length.toString())}</span>
                                        <button onClick={() => setQueuedFiles([])} className="text-xs text-txt-muted hover:text-status-danger transition-colors font-medium">{t('btn_clear_all')}</button>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none snap-x">
                                        {previews.map((url, idx) => (
                                            <div key={idx} className="relative group flex-shrink-0 snap-start">
                                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-surface-bg-alt shadow-md"><img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /></div>
                                                <button onClick={() => handleRemoveFile(idx)} className="absolute -top-1.5 -right-1.5 bg-black/80 hover:bg-status-danger text-white p-1 rounded-full shadow-lg border border-white/20 transition-all duration-200 hover:scale-110 active:scale-90"><X size={12} /></button>
                                            </div>
                                        ))}
                                        <button onClick={() => setIsScannerOpen(true)} className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-primary/20 hover:border-brand-primary/50 bg-brand-primary/5 hover:bg-brand-primary/10 flex flex-col items-center justify-center gap-1 text-brand-primary transition-all flex-shrink-0 group active:scale-95 snap-start"><Camera size={20} className="group-hover:scale-110 transition-transform" /><span className="text-[10px] font-bold">{t('btn_add_photo')}</span></button>
                                    </div>
                                </div>
                            )}

                            {/* 按鈕群 */}
                            <div className="space-y-3">
                                {queuedFiles.length === 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setIsScannerOpen(true)} className="flex flex-col items-center justify-center gap-2 py-4 bg-brand-primary text-white rounded-xl font-bold shadow-md active:scale-95 transition-all hover:brightness-110"><Camera size={24} /><span className="text-sm">{t('btn_take_photo')}</span></button>
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 py-4 bg-surface-bg text-brand-primary border border-brand-primary/30 rounded-xl font-bold active:scale-95 transition-all hover:bg-brand-primary/10"><ImageIcon size={24} /><span className="text-sm">{t('btn_upload_image')}</span></button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <button onClick={handleSubmit} className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-black text-base shadow-lg shadow-brand-primary/20 active:scale-98 hover:brightness-110 transition-all animate-in zoom-in-95 duration-300"><Sparkles size={20} className="animate-pulse" /><span>{t('btn_generate_simple').replace('{count}', queuedFiles.length.toString())}</span></button>
                                        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-brand-primary bg-surface-bg hover:bg-brand-primary/5 border border-brand-primary/20 rounded-lg active:scale-95 transition-all"><ImageIcon size={14} /><span>{t('btn_add_from_album')}</span></button>
                                    </div>
                                )}
                                <button onClick={onDirectStart} className="w-full flex items-center justify-center gap-2 py-3 text-txt-secondary font-medium rounded-xl bg-surface-bg-alt hover:bg-surface-bg border border-surface-border active:scale-95 transition-all mt-2"><Play size={16} className="fill-current" /><span className="text-sm">{t('btn_start_direct')}</span></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isScannerOpen && (
                <CameraView onCapture={handleCameraCapture} onClose={() => setIsScannerOpen(false)} singleShot={false} modalId="ai-scoreboard-camera-simple" />
            )}
        </div>
    );
};

export default AiSimplePromptModal;
