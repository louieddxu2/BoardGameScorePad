
import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Play, Loader2, AlertCircle, X, Sparkles } from 'lucide-react';
import { useAiGenerator } from '../hooks/useAiGenerator';
import { useAiGeneratorTranslation } from '../../../i18n/aiGenerator';
import { GameTemplate } from '../../../types';

export interface AiPromptModalProps {
    isOpen: boolean;
    gameName: string;
    onClose: () => void;
    onDirectStart: () => void;
    onAiSuccess: (result: Partial<GameTemplate>) => void;
}

const AiPromptModal: React.FC<AiPromptModalProps> = ({
    isOpen,
    gameName,
    onClose,
    onDirectStart,
    onAiSuccess
}) => {
    const { t } = useAiGeneratorTranslation();
    const { status, errorMessage, processAndGenerate, reset } = useAiGenerator();
    
    // Refs 用於觸發隱藏的 <input type="file">
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // 處理圖片選取事件
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // 轉為陣列
        const fileList = Array.from(files);
        
        const result = await processAndGenerate(fileList, gameName);
        
        if (result) {
            // 成功！延遲一下讓使用者看到成功打勾的狀態再進入下一步
            setTimeout(() => {
                onAiSuccess(result);
                reset();
            }, 600);
        }
        
        // 重置 input 以便下次選取相同檔案
        e.target.value = '';
    };

    // 渲染進度指示器
    const renderLoadingStatus = () => {
        let text = '';
        if (status === 'compressing') text = t('status_compressing');
        else if (status === 'generating') text = t('status_generating');
        else if (status === 'success') text = t('status_success');
        
        return (
            <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="relative mb-4">
                    <div className="absolute inset-0 bg-brand-primary/20 rounded-full animate-ping scale-150"></div>
                    <div className="relative bg-brand-primary/10 p-4 rounded-full text-brand-primary">
                        {status === 'success' ? (
                            <Sparkles size={32} className="animate-bounce" />
                        ) : (
                            <Loader2 size={32} className="animate-spin" />
                        )}
                    </div>
                </div>
                <p className="text-txt-primary font-bold text-lg animate-pulse">{text}</p>
            </div>
        );
    };

    // 渲染錯誤狀態
    const renderError = () => {
        // 將 API 回傳的 error key 對應到 i18n
        let displayError = t('error_generic');
        if (errorMessage === 'ai_error_rate_limit') displayError = t('error_rate_limit');
        if (errorMessage === 'ai_error_invalid_json') displayError = t('error_invalid_json');

        return (
            <div className="bg-status-danger/10 border border-status-danger/20 rounded-xl p-4 mb-6 flex gap-3 items-start animate-in slide-in-from-top-2">
                <AlertCircle size={20} className="text-status-danger shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-status-danger leading-relaxed">{displayError}</p>
                </div>
                <button onClick={reset} className="text-txt-muted hover:text-txt-primary p-1">
                    <X size={16} />
                </button>
            </div>
        );
    };

    const isProcessing = status === 'compressing' || status === 'generating' || status === 'success';

    return (
        <div 
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={(e) => {
                // 處理中不可關閉
                if (e.target === e.currentTarget && !isProcessing) onClose();
            }}
        >
            {/* 隱藏的 inputs */}
            <input 
                type="file" 
                ref={cameraInputRef} 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={handleFileChange} 
            />
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={handleFileChange} 
            />

            <div 
                className="modal-container w-full max-w-sm bg-app-bg shadow-2xl relative overflow-hidden p-0 border border-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* 頂部裝飾色條 */}
                <div className="h-1 w-full bg-brand-primary" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-brand-primary">
                            <Sparkles size={20} />
                            <h3 className="font-black text-xl tracking-tight">{t('title')}</h3>
                        </div>
                        {!isProcessing && (
                            <button onClick={onClose} className="p-1 text-txt-muted hover:text-txt-primary bg-surface-bg-alt rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Content Container */}
                    {isProcessing ? (
                        renderLoadingStatus()
                    ) : (
                        <>
                            {/* Game Name Badge */}
                            <div className="inline-flex items-center px-3 py-1 bg-surface-bg border border-surface-border rounded-full mb-4">
                                <span className="text-xs font-bold text-txt-secondary truncate max-w-[240px]">
                                    {gameName}
                                </span>
                            </div>

                            <p className="text-txt-primary font-medium mb-6 text-[15px]">
                                {t('prompt_question')}
                            </p>

                            {/* 隱私警告區塊 */}
                            <div className="flex gap-2 p-3 bg-surface-bg-alt rounded-lg border border-surface-border mb-6">
                                <AlertCircle size={16} className="text-status-warning shrink-0 mt-0.5" />
                                <p className="text-xs text-txt-muted leading-relaxed">
                                    {t('privacy_warning')}
                                </p>
                            </div>

                            {/* 錯誤提示 */}
                            {status === 'error' && renderError()}

                            {/* 按鈕群組 */}
                            <div className="space-y-3">
                                {/* 主要 AI 操作區 (橫向排列) */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center gap-2 py-4 bg-brand-primary text-white rounded-xl font-bold shadow-md active:scale-95 transition-all hover:brightness-110"
                                    >
                                        <Camera size={24} />
                                        <span className="text-sm">{t('btn_take_photo')}</span>
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center gap-2 py-4 bg-surface-bg text-brand-primary border border-brand-primary/30 rounded-xl font-bold active:scale-95 transition-all hover:bg-brand-primary/10"
                                    >
                                        <ImageIcon size={24} />
                                        <span className="text-sm">{t('btn_upload_image')}</span>
                                    </button>
                                </div>

                                {/* 次要直接開始操作 */}
                                <button
                                    onClick={onDirectStart}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-txt-secondary font-medium rounded-xl bg-surface-bg-alt hover:bg-surface-bg border border-surface-border active:scale-95 transition-all mt-2"
                                >
                                    <Play size={16} className="fill-current" />
                                    <span className="text-sm">{t('btn_start_direct')}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiPromptModal;
