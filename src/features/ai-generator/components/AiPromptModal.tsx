
import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Play, Loader2, AlertCircle, X, Sparkles, Plus, Trash2 } from 'lucide-react';
import { useAiGenerator } from '../hooks/useAiGenerator';
import { useAiGeneratorTranslation } from '../../../i18n/aiGenerator';
import { GameTemplate } from '../../../types';
import { useEffect } from 'react';
import CameraView from '../../../components/scanner/CameraView';

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
    const { status, errorMessage, tokenUsage, processAndGenerate, reset } = useAiGenerator();
    
    // 引擎切換狀態，預設選取穩定主力 gemini-2.5-flash-lite
    type ModelType = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3-flash-preview';
    const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.5-flash-lite');
    
    // 🌟 核心升級：檔案緩衝池與預覽 URL 緩存
    const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    
    // 🌟 新增：控制沉浸式 WebRTC 相機遮罩的啟閉
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Refs 用於觸發隱藏的 <input type="file">
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🔄 自動維護預覽圖 URL 的生命週期，避免記憶體洩漏
    useEffect(() => {
        const objectUrls = queuedFiles.map(file => URL.createObjectURL(file));
        setPreviews(objectUrls);
        
        // 清理函數：當檔案變更或元件卸載時釋放 URL
        return () => objectUrls.forEach(url => URL.revokeObjectURL(url));
    }, [queuedFiles]);

    if (!isOpen) return null;

    // 處理圖片加入事件 (來自相簿多選)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        // 向下追加，保留之前選好的照片
        setQueuedFiles(prev => [...prev, ...fileList]);
        
        // 重置 input value 確保下次選取同一個檔名還能觸發 onChange
        e.target.value = '';
    };

    // 🌟 核心對接：接收來自沉浸式相機連拍的 Blob 陣列
    const handleCameraCapture = (blobs: Blob[]) => {
        if (!blobs || blobs.length === 0) return;

        // 將二進位 Blob 轉化為標準 File 物件以對接既有流程
        const newFiles = blobs.map((blob, index) => 
            new File(
                [blob], 
                `ai_scan_${Date.now()}_${index}.jpg`, 
                { type: 'image/jpeg', lastModified: Date.now() }
            )
        );

        setQueuedFiles(prev => [...prev, ...newFiles]);
        setIsScannerOpen(false); // 拍完收工，關閉相機畫面
    };

    // 移除佇列中的特定照片
    const handleRemoveFile = (indexToRemove: number) => {
        setQueuedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // 台幣費率計算器 (基於 Gemini 2.5 官方牌價)
    const calculateCost = (usage: { promptTokenCount: number; candidatesTokenCount: number }) => {
        // 輸入 $0.30 / 1M, 輸出 $2.50 / 1M, 匯率 31.5 NTD
        const usd = (usage.promptTokenCount * 0.3 + usage.candidatesTokenCount * 2.5) / 1000000;
        const ntd = usd * 31.5;
        return ntd < 0.0001 ? "0.0001" : ntd.toFixed(4);
    };

    // 🏁 最終集中提交大典禮
    const handleSubmit = async () => {
        if (queuedFiles.length === 0) return;

        const result = await processAndGenerate(queuedFiles, gameName, selectedModel);
        
        if (result) {
            // 成功！延長停頓時間 (2200ms) 讓使用者有空看清台幣與 Token 結算面板
            setTimeout(() => {
                onAiSuccess(result);
                reset();
                setQueuedFiles([]);
            }, 2200);
        }
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
                
                {/* 🌟 新增：高尊榮感 Token 與台幣結算微光儀 */}
                {status === 'success' && tokenUsage && (
                    <div className="mt-5 px-4 py-2.5 bg-surface-bg-alt border border-brand-primary/20 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-brand-primary/5 animate-in slide-in-from-bottom-3 duration-500">
                        <span className="text-xs font-black text-brand-primary tracking-wide flex items-center gap-1">
                            {t('status_token_cost').replace('{cost}', calculateCost(tokenUsage))}
                        </span>
                        <span className="text-[10px] font-mono text-txt-muted">
                            {t('status_token_count').replace('{count}', tokenUsage.totalTokenCount.toLocaleString())}
                        </span>
                    </div>
                )}
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
            {/* 隱藏的 inputs - 拍照機制已遷往 CameraView，此處只需保留相簿 input */}
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

                            <p className="text-txt-primary font-medium mb-4 text-[15px]">
                                {t('prompt_question')}
                            </p>
                             {/* 引擎效能控制台 (2x2 高科技 Grid) */}
                             <div className="grid grid-cols-2 gap-2 mb-5 p-1.5 bg-surface-bg-alt/50 rounded-xl border border-surface-border/60">
                                 {(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview'] as const).map((model) => {
                                     const isSelected = selectedModel === model;
                                     return (
                                         <button
                                             key={model}
                                             type="button"
                                             onClick={() => setSelectedModel(model)}
                                             className={`py-2 px-1 rounded-lg border font-mono transition-all duration-200 text-[10px] tracking-tighter active:scale-95 flex items-center justify-center ${
                                                 isSelected 
                                                     ? 'bg-brand-primary/10 text-brand-primary border-brand-primary font-black shadow-sm shadow-brand-primary/5' 
                                                     : 'bg-surface-bg border-surface-border/70 text-txt-muted hover:text-txt-primary hover:border-surface-border-hover'
                                             }`}
                                         >
                                             {model}
                                         </button>
                                     );
                                 })}
                             </div>

                            {/* 隱私警告區塊 */}
                            <div className="flex gap-2 p-3 bg-surface-bg-alt rounded-lg border border-surface-border mb-6">
                                <AlertCircle size={16} className="text-status-warning shrink-0 mt-0.5" />
                                <p className="text-xs text-txt-muted leading-relaxed">
                                    {t('privacy_warning')}
                                </p>
                            </div>

                            {/* 錯誤提示 */}
                            {status === 'error' && renderError()}

                            {/* 🌟 圖片預覽與新增區域 */}
                            {queuedFiles.length > 0 && (
                                <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-brand-primary flex items-center gap-1">
                                            <Sparkles size={12} />
                                            {t('status_selected_count').replace('{count}', queuedFiles.length.toString())}
                                        </span>
                                        <button 
                                            onClick={() => setQueuedFiles([])}
                                            className="text-xs text-txt-muted hover:text-status-danger transition-colors font-medium"
                                        >
                                            {t('btn_clear_all')}
                                        </button>
                                    </div>
                                    
                                    {/* 水平滑動輸送帶 */}
                                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none snap-x">
                                        {previews.map((url, index) => (
                                            <div key={index} className="relative group flex-shrink-0 snap-start">
                                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-surface-bg-alt shadow-md">
                                                    <img 
                                                        src={url} 
                                                        alt={`Preview ${index}`} 
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                </div>
                                                {/* 懸浮 X 按鈕 */}
                                                <button 
                                                    onClick={() => handleRemoveFile(index)}
                                                    className="absolute -top-1.5 -right-1.5 bg-black/80 hover:bg-status-danger text-white p-1 rounded-full shadow-lg border border-white/20 transition-all duration-200 hover:scale-110 active:scale-90"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {/* 加號佔位符，觸發專用相機繼續拍 */}
                                        <button 
                                            onClick={() => setIsScannerOpen(true)}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-primary/20 hover:border-brand-primary/50 bg-brand-primary/5 hover:bg-brand-primary/10 flex flex-col items-center justify-center gap-1 text-brand-primary transition-all flex-shrink-0 group active:scale-95 snap-start"
                                        >
                                            <Camera size={20} className="group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold">{t('btn_add_photo')}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 按鈕群組 */}
                            <div className="space-y-3">
                                {queuedFiles.length === 0 ? (
                                    /* 狀況 A: 還沒選照片，顯示核心入口 */
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setIsScannerOpen(true)}
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
                                ) : (
                                    /* 狀況 B: 已有緩衝照片，顯示閃閃發亮的「分析大決戰」按鈕 */
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleSubmit}
                                            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-black text-base shadow-lg shadow-brand-primary/20 active:scale-98 hover:brightness-110 transition-all animate-in zoom-in-95 duration-300"
                                        >
                                            <Sparkles size={20} className="animate-pulse" />
                                            <span>{t('btn_analyze_count').replace('{count}', queuedFiles.length.toString())}</span>
                                        </button>
                                        
                                        {/* 小型輔助按鈕，方便追加相簿照片 */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-brand-primary bg-surface-bg hover:bg-brand-primary/5 border border-brand-primary/20 rounded-lg active:scale-95 transition-all"
                                            >
                                                <ImageIcon size={14} />
                                                <span>{t('btn_add_from_album')}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

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
            
            {/* 🌟 全螢幕沉浸式相機遮罩 (Camera View) */}
            {isScannerOpen && (
                <CameraView 
                    onCapture={handleCameraCapture}
                    onClose={() => setIsScannerOpen(false)}
                    singleShot={false} // 多選模式
                    modalId="ai-scoreboard-camera"
                />
            )}
        </div>
    );
};

export default AiPromptModal;
