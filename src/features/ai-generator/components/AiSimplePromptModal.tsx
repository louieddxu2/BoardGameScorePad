import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Play, Loader2, AlertCircle, X, Sparkles, Terminal } from 'lucide-react';
import { useAiSimpleGenerator, ModelRunStatus, UseAiSimpleGeneratorResult } from '../hooks/useAiSimpleGenerator';
import { useAiGeneratorTranslation } from '../../../i18n/aiGenerator';
import { GameTemplate } from '../../../types';
import CameraView from '../../../components/scanner/CameraView';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { getContrastTextStyles } from '../../../utils/ui';
import { AiGenerationResult } from '../services/aiApiService';
import { classifyColumnFormula } from '../../../utils/templateUtils';
import { useSearchTemplateOnlineTranslation } from '../../../i18n/search_template_online';

const MAX_AI_IMAGE_COUNT = 5;

interface TerminalWindowProps {
    title: string;
    streamText: string;
    result: AiGenerationResult | null;
    statusStr: ModelRunStatus;
    errStr: string | null;
    elapsedTime: number;
    t: (key: any) => string;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({
    title, streamText, result, statusStr, errStr, elapsedTime, t
}) => {
    const isError = statusStr === 'error';
    const isSuccess = statusStr === 'success';
    const isGenerating = statusStr === 'generating';

    let diagnostic: { raw: string; error: string } | null = null;
    if (isError && errStr?.startsWith('ai_error_json_parse_failed|')) {
        try {
            const jsonStr = errStr.split('|')[1];
            diagnostic = JSON.parse(jsonStr);
        } catch (e) { }
    }

    let terminalContent = "";
    if (isError) {
        terminalContent = diagnostic
            ? diagnostic.raw
            : errStr === 'ai_error_rate_limit'
                ? t('error_rate_limit')
                : errStr === 'ai_error_local_rate_limit'
                    ? t('error_local_rate_limit')
                    : errStr === 'ai_error_human_verification'
                        ? t('error_human_verification')
                        : errStr === 'ai_error_safety_blocked'
                            ? t('error_safety_blocked')
                            : t('error_generic');
    } else if (isSuccess && result) {
        terminalContent = result.rawText;
    } else {
        terminalContent = streamText;
    }

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [terminalContent]);

    return (
        <div className={`flex flex-col bg-modal-bg-recessed border ${isError ? 'border-status-danger/30' : 'border-surface-border'} rounded-xl p-2 text-left overflow-hidden shadow-inner flex-1 min-w-0 min-h-[320px] max-h-[42vh]`}>
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-surface-border/50 shrink-0 select-none">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Terminal size={12} className={isError ? "text-status-danger" : (isSuccess ? "text-status-success" : "text-brand-primary")} />
                    <span className="text-[9px] font-mono tracking-wider text-txt-muted uppercase truncate">
                        {title}
                    </span>
                </div>
                {isGenerating && <span className="w-1 h-1 rounded-full bg-brand-primary animate-pulse" />}
            </div>
            <div 
                ref={containerRef}
                className="font-mono text-[9px] text-txt-primary leading-normal overflow-y-auto whitespace-pre-wrap scrollbar-thin scrollbar-thumb-surface-border flex-1 pr-1"
            >
                <p className="break-all selection:bg-brand-primary/30 selection:text-txt-title select-text">
                    {terminalContent}
                    {isGenerating && <span className="inline-block w-1 h-2.5 ml-0.5 align-middle bg-brand-primary animate-pulse" />}
                </p>
                {isError && diagnostic?.error && (
                    <div className="mt-1 p-1 bg-status-danger/10 text-status-danger/90 rounded border border-status-danger/20 text-[8px] leading-tight select-text">
                        {diagnostic.error}
                    </div>
                )}
            </div>
        </div>
    );
};

export interface AiSimplePromptModalProps {
    isOpen: boolean;
    gameName: string;
    onClose: () => void;
    onDirectStart: () => void;
    onAiSuccess: (result: Partial<GameTemplate>) => void;
    onSwitchToAdvanced: (files: File[]) => void;
    aiSimpleGenerator: UseAiSimpleGeneratorResult;
}

const AiSimplePromptModal: React.FC<AiSimplePromptModalProps> = ({
    isOpen, gameName, onClose, onAiSuccess, onSwitchToAdvanced, aiSimpleGenerator
}) => {
    const { t } = useAiGeneratorTranslation();
    const { t: tOnline } = useSearchTemplateOnlineTranslation();
    const isAdvanceUser = localStorage.getItem('advance_user') === 'true';

    const aiSimple = aiSimpleGenerator;
    const {
        simpleStatus, gemmaStatus, flashStatus,
        gemmaResult, flashResult,
        flashStreamText, gemmaStreamText,
        flashTryCount, gemmaTryCount,
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

    // 當彈窗關閉（隱藏）時，防禦性地重設相機，釋放硬體鏡頭資源
    useEffect(() => {
        if (!isOpen) {
            setIsScannerOpen(false);
        }
    }, [isOpen]);

    // 既提升 AI 狀態，又不銷毀組件的關閉行為協調函數
    const handleCloseWithBackgroundKeep = () => {
        const isGenerating = simpleStatus === 'compressing' || simpleStatus === 'generating';
        const isSuccess = simpleStatus === 'success';
        if (isGenerating || isSuccess) {
            onClose();
        } else {
            // 只有在閒置或失敗時，關閉彈窗才進行徹底 reset 釋放
            abortSimpleAll();
            resetSimple();
            setQueuedFiles([]);
            onClose();
        }
    };

    const handleCameraCapture = (blobs: Blob[]) => {
        if (!blobs || blobs.length === 0) return;
        const newFiles = blobs.map((blob, idx) => new File([blob], `scan_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' }));
        setQueuedFiles(prev => {
            const remainingSlots = Math.max(0, MAX_AI_IMAGE_COUNT - prev.length);
            return [...prev, ...newFiles.slice(0, remainingSlots)];
        });
        setIsScannerOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        setQueuedFiles(prev => [...prev, ...fileList].slice(0, MAX_AI_IMAGE_COUNT));

        e.target.value = '';
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setQueuedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async () => {
        if (queuedFiles.length === 0) return;
        await processAndGenerateSimple(queuedFiles, gameName);
    };
    const renderColumnList = (result: any) => {
        if (!result?.template?.columns) {
            return (
                <div className="flex flex-col items-center justify-center py-6 text-txt-muted text-center px-1 select-none flex-1 min-h-[320px] max-h-[42vh]">
                    <span className="text-[10px]">{t('no_columns')}</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-1 min-h-[320px] max-h-[42vh] overflow-y-auto pr-0.5 scrollbar-thin select-none flex-1 min-w-0 bg-surface-bg border border-surface-border rounded-xl p-2">
                {result.template.columns.map((col: any, idx: number) => {
                    const { formulaKey, bgClass, textClass } = classifyColumnFormula(col);
                    return (
                        <div key={col.id || idx} className="flex justify-between items-center py-1 border-b border-surface-border/20 last:border-0 text-left">
                            <span 
                                className="text-[11px] font-bold truncate pr-1 leading-tight" 
                                style={{ 
                                    color: col.color || 'var(--c-txt-primary)', 
                                    ...getContrastTextStyles(col.color || '') 
                                }}
                            >
                                {col.name}
                            </span>
                            <span className={`inline-flex px-1.5 py-0.2 rounded-full border text-[8px] font-black ${bgClass} ${textClass} shrink-0 whitespace-nowrap`}>
                                {tOnline(formulaKey as any)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };
    const isBothDone = (flashStatus === 'success' || flashStatus === 'error') && (gemmaStatus === 'success' || gemmaStatus === 'error');
    const isProcessing = simpleStatus === 'compressing' || simpleStatus === 'generating' || simpleStatus === 'success';
    const canAddMoreImages = queuedFiles.length < MAX_AI_IMAGE_COUNT;

    return (
        <div 
            className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300 ${
                isOpen ? 'opacity-100 pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'
            }`} 
            style={{ zIndex }} 
            onClick={(e) => { if (e.target === e.currentTarget) { handleCloseWithBackgroundKeep(); } }}
        >
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
            />

            <div className="modal-container w-[95vw] max-w-md bg-app-bg shadow-2xl relative overflow-hidden p-0 border border-modal-border max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="h-1 w-full bg-brand-primary" />
                <div className="p-3.5 overflow-y-auto scrollbar-thin flex flex-col max-h-[calc(90vh-4px)]">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-3 shrink-0">
                        <div className="flex items-center gap-1 text-brand-primary">
                            <Sparkles size={18} />
                            <h3 className="font-black text-lg tracking-tight select-none">{t('simple_title')}</h3>
                        </div>
                        <div className="flex items-center shrink-0 select-none">
                            {isAdvanceUser && !isProcessing && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const filesToTransfer = [...queuedFiles];
                                        resetSimple();
                                        setQueuedFiles([]);
                                        onSwitchToAdvanced(filesToTransfer);
                                    }} 
                                    className="px-2.5 py-1 text-[10px] font-black rounded-lg transition-all border border-brand-primary/20 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 active:scale-95 mr-2 shrink-0 select-none"
                                >
                                    {t('tab_advanced')} ➔
                                </button>
                            )}
                            <button onClick={handleCloseWithBackgroundKeep} className="p-1 text-txt-muted hover:text-txt-primary bg-surface-bg-alt rounded-lg transition-colors"><X size={18} /></button>
                        </div>
                    </div>

                    {/* Content Area */}
                    {simpleStatus !== 'idle' ? (
                        <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300 w-full select-none">
                            {/* 雙軌 Header (完整模型名稱與跑秒標示) */}
                            <div className="grid grid-cols-2 gap-2 mt-1 mb-2 select-none text-left">
                                {/* 左軌 Header */}
                                <div className="flex flex-col gap-0.5 px-2 py-1.5 bg-surface-bg-alt/60 border border-surface-border rounded-xl">
                                    <div className="flex items-center justify-between min-w-0">
                                        <span className="text-[11px] font-black text-brand-primary truncate">
                                            {t('label_flash_version')}
                                        </span>
                                        {flashStatus === 'generating' && (
                                            <span className="text-[9px] font-mono font-bold text-brand-primary shrink-0 animate-pulse">
                                                ({flashElapsedTime}s)
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[8px] font-mono text-txt-muted truncate leading-tight select-all">
                                        {flashTryCount === 2 ? 'gemini-3.1-flash-lite' : 'gemini-3-flash-preview'}
                                    </div>
                                </div>

                                {/* 右軌 Header */}
                                <div className="flex flex-col gap-0.5 px-2 py-1.5 bg-surface-bg-alt/60 border border-surface-border rounded-xl">
                                    <div className="flex items-center justify-between min-w-0">
                                        <span className="text-[11px] font-black text-brand-secondary truncate">
                                            {t('label_gemma_version')}
                                        </span>
                                        {gemmaStatus === 'generating' && (
                                            <span className="text-[9px] font-mono font-bold text-brand-secondary shrink-0 animate-pulse">
                                                ({gemmaElapsedTime}s)
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[8px] font-mono text-txt-muted truncate leading-tight select-all">
                                        {gemmaTryCount === 2 ? 'gemma-4-26b-a4b-it' : 'gemma-4-31b-it'}
                                    </div>
                                </div>
                            </div>

                            {!isBothDone && (
                                <div className="mb-3 px-3 py-2 rounded-xl bg-status-warning/10 border border-status-warning/20 text-status-warning text-[10px] font-semibold leading-relaxed">
                                    {t('processing_keep_awake_hint')}
                                </div>
                            )}

                            {/* 雙軌實時預覽板 (雙 Terminal 賽馬，成功時跳出結果) */}
                            <div className="grid grid-cols-2 gap-2 mb-4 p-1 rounded-xl shadow-inner min-h-[320px]">
                                {flashStatus === 'success' ? (
                                    renderColumnList(flashResult)
                                ) : (
                                    <TerminalWindow
                                        title="STREAM LOG"
                                        streamText={flashStreamText}
                                        result={flashResult}
                                        statusStr={flashStatus}
                                        errStr={flashError}
                                        elapsedTime={flashElapsedTime}
                                        t={t}
                                    />
                                )}
                                {gemmaStatus === 'success' ? (
                                    renderColumnList(gemmaResult)
                                ) : (
                                    <TerminalWindow
                                        title="STREAM LOG"
                                        streamText={gemmaStreamText}
                                        result={gemmaResult}
                                        statusStr={gemmaStatus}
                                        errStr={gemmaError}
                                        elapsedTime={gemmaElapsedTime}
                                        t={t}
                                    />
                                )}
                            </div>

                            {/* 雙版本套用按鈕 */}
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button onClick={() => { if (flashResult) { onAiSuccess(flashResult.template); resetSimple(); setQueuedFiles([]); onClose(); } }} disabled={!flashResult} className={`py-3 px-2 rounded-xl font-black text-xs tracking-tight transition-all active:scale-97 shadow-sm border ${flashResult ? 'bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary border-brand-primary/30' : 'bg-surface-bg/30 text-txt-muted/40 border-surface-border/20 cursor-not-allowed'}`}>{t('btn_apply_flash')}</button>
                                <button onClick={() => { if (gemmaResult) { onAiSuccess(gemmaResult.template); resetSimple(); setQueuedFiles([]); onClose(); } }} disabled={!gemmaResult} className={`py-3 px-2 rounded-xl font-black text-xs tracking-tight transition-all active:scale-97 shadow-sm border ${gemmaResult ? 'bg-brand-secondary/10 hover:bg-brand-secondary/15 text-brand-secondary border-brand-secondary/30' : 'bg-surface-bg/30 text-txt-muted/40 border-surface-border/20 cursor-not-allowed'}`}>{t('btn_apply_gemma')}</button>
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
                            <p className="text-txt-primary font-medium mb-3 text-[14px] leading-snug whitespace-pre-line select-none">{t('simple_desc')}</p>

                            {/* 隱私警告區塊 */}
                            <div className="flex gap-2 p-3 bg-surface-bg-alt rounded-lg border border-surface-border mb-4 select-none">
                                <AlertCircle size={16} className="text-status-warning shrink-0 mt-0.5" />
                                <p className="text-[11px] text-txt-muted leading-relaxed">
                                    {t('privacy_warning')}
                                </p>
                            </div>

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
                                        {canAddMoreImages && (
                                            <button onClick={() => setIsScannerOpen(true)} className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-primary/20 hover:border-brand-primary/50 bg-brand-primary/5 hover:bg-brand-primary/10 flex flex-col items-center justify-center gap-1 text-brand-primary transition-all flex-shrink-0 group active:scale-95 snap-start"><Camera size={20} className="group-hover:scale-110 transition-transform" /><span className="text-[10px] font-bold">{t('btn_add_photo')}</span></button>
                                        )}
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
                                        {canAddMoreImages && (
                                            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-brand-primary bg-surface-bg hover:bg-brand-primary/5 border border-brand-primary/20 rounded-lg active:scale-95 transition-all"><ImageIcon size={14} /><span>{t('btn_add_from_album')}</span></button>
                                        )}
                                    </div>
                                )}
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
