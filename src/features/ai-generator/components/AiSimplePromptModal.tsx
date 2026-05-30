import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Play, Loader2, AlertCircle, X, Sparkles, Terminal } from 'lucide-react';
import { useAiSimpleGenerator, ModelRunStatus } from '../hooks/useAiSimpleGenerator';
import { useAiGeneratorTranslation } from '../../../i18n/aiGenerator';
import { GameTemplate } from '../../../types';
import CameraView from '../../../components/scanner/CameraView';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { getContrastTextStyles } from '../../../utils/ui';
import { AiGenerationResult } from '../services/aiApiService';
interface TerminalWindowProps {
    title: string;
    streamText: string;
    result: AiGenerationResult | null;
    statusStr: ModelRunStatus;
    errStr: string | null;
    t: (key: any) => string;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({
    title, streamText, result, statusStr, errStr, t
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
        terminalContent = diagnostic ? diagnostic.raw : (errStr === 'ai_error_rate_limit' ? t('error_rate_limit') : t('error_generic'));
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
        <div className={`flex flex-col bg-modal-bg-recessed border ${isError ? 'border-status-danger/30' : 'border-surface-border'} rounded-xl p-2.5 text-left overflow-hidden shadow-inner flex-1 min-w-0 min-h-[160px] max-h-[160px]`}>
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
        flashStreamText, gemmaStreamText,
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

                            {/* 雙軌實時預覽板 (雙 Terminal 賽馬) */}
                            <div className="grid grid-cols-2 gap-2 mt-1 mb-4 p-1 rounded-xl shadow-inner min-h-[160px]">
                                <TerminalWindow
                                    title={flashStatus === 'success' ? '⚡ Gemini 3.0' : t('label_flash_version')}
                                    streamText={flashStreamText}
                                    result={flashResult}
                                    statusStr={flashStatus}
                                    errStr={flashError}
                                    t={t}
                                />
                                <TerminalWindow
                                    title={gemmaStatus === 'success' ? '🏆 Gemma 4' : t('label_gemma_version')}
                                    streamText={gemmaStreamText}
                                    result={gemmaResult}
                                    statusStr={gemmaStatus}
                                    errStr={gemmaError}
                                    t={t}
                                />
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
