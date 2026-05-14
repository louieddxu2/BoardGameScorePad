
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
    type ModelType = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-3.1-flash-lite' | 'gemma-4-26b-a4b-it';
    const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.5-flash-lite');
    
    // 🌟 核心升級：檔案緩衝池與預覽 URL 緩存
    const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [generatedTemplate, setGeneratedTemplate] = useState<Partial<GameTemplate> | null>(null);
    
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

    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [showDebug, setShowDebug] = useState<boolean>(false);

    // 🕒 計時器：在生成期間啟動，讓使用者感知進度
    useEffect(() => {
        let interval: any;
        if (status === 'generating') {
            const startTime = Date.now();
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [status]);

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

    // 台幣費率計算器 (精準對齊 Google AI Studio 官方 2026 牌價)
    const calculateCost = (model: string, usage: { promptTokenCount: number; candidatesTokenCount: number }) => {
        // 官方牌價 (每 100 萬個 Tokens 的美金價格)
        let inputCostPer1M = 0.075;  // 預設 1.5 / 3.1 Flash 系列
        let outputCostPer1M = 0.30;

        if (model.includes('2.5')) {
            if (model.includes('lite')) {
                inputCostPer1M = 0.15;  // Lite 版本官方通常為 50% 折扣
                outputCostPer1M = 1.25;
            } else {
                inputCostPer1M = 0.30;  // 2.5 推理主力
                outputCostPer1M = 2.50;
            }
        } else if (model.includes('gemma')) {
            inputCostPer1M = 0.06;  // Gemma 4 極致佛系開放架構
            outputCostPer1M = 0.30;
        } else if (model.includes('lite')) {
            // 其他系列的 Lite 版本折半精算
            inputCostPer1M = 0.0375;
            outputCostPer1M = 0.15;
        }

        const usd = (usage.promptTokenCount * inputCostPer1M + usage.candidatesTokenCount * outputCostPer1M) / 1000000;
        const ntd = usd * 31.5; // 美金台幣匯率
        return ntd < 0.0001 ? "0.0001" : ntd.toFixed(4);
    };

    // 🏁 最終集中提交大典禮
    const handleSubmit = async () => {
        if (queuedFiles.length === 0) return;
        setShowDebug(false); // 重置除錯狀態

        const result = await processAndGenerate(queuedFiles, gameName, selectedModel);
        
        if (result) {
            // 🚀 突破：直接緩存在 Modal 中，切換至「結算畫面」，不由系統自動關閉跳轉！
            setGeneratedTemplate(result);
        }
    };

    // 渲染進度指示器 (專注呈現壓縮中、分析中的旋轉流程)
    const renderLoadingStatus = () => {
        let text = '';
        if (status === 'compressing') text = t('status_compressing');
        else if (status === 'generating') text = t('status_generating');
        else if (status === 'success') text = t('status_success');
        
        return (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-300">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-brand-primary/20 rounded-full animate-ping scale-150"></div>
                    <div className="relative bg-brand-primary/10 p-5 rounded-full text-brand-primary border border-brand-primary/20">
                        {status === 'success' ? (
                            <Sparkles size={40} className="animate-bounce" />
                        ) : (
                            <Loader2 size={40} className="animate-spin" />
                        )}
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <p className="text-txt-primary font-black text-xl tracking-tight">{text}</p>
                    {status === 'generating' && (
                        <div className="space-y-1">
                            <p className="text-brand-primary font-mono text-sm font-bold bg-brand-primary/5 px-3 py-1 rounded-full border border-brand-primary/10 inline-block">
                                {elapsedTime}s
                            </p>
                            <p className="text-txt-muted text-[11px] font-medium opacity-60">
                                {selectedModel}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 🌟 核心升級：開箱大吉！渲染 AI 成功產出報告面板
    const renderSuccessResult = () => {
        if (!generatedTemplate) return null;
        
        const columns = generatedTemplate.columns || [];
        const columnCount = columns.length;
        
        // ⚙️ 7 大公式黃金分類精算引擎
        const stats = {
            plain: 0,
            rate: 0,
            accum: 0,
            product: 0,
            prodAccum: 0,
            lookup: 0,
            list: 0,
        };

        columns.forEach((col: any) => {
            const formula = col.formula || 'a1';
            const inputType = col.inputType || 'keypad';

            if (inputType === 'clicker') {
                stats.list++;
            } else if (formula === 'a1×c1') {
                stats.rate++;
            } else if (formula === 'a1+next') {
                stats.accum++;
            } else if (formula === 'a1×a2') {
                stats.product++;
            } else if (formula === '(a1×a2)+next') {
                stats.prodAccum++;
            } else if (formula.includes('f1') || col.functions) {
                stats.lookup++;
            } else {
                stats.plain++;
            }
        });

        // 輔助渲染小積木：一行流派分析項
        const renderSchemeRow = (label: string, count: number, dotColorClass: string) => (
            <div className="flex justify-between items-center py-1 text-[11px] border-b border-white/5 last:border-0 last:pb-0 animate-in fade-in duration-300">
                <span className="text-txt-secondary flex items-center gap-2 font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
                    {label}
                </span>
                <span className="text-txt-muted font-bold font-mono text-xs">
                    {t('scheme_count_suffix').replace('{count}', count.toString())}
                </span>
            </div>
        );
        
        return (
            <div className="animate-in fade-in zoom-in-95 duration-500">
                {/* 頂部慶祝打勾區 */}
                <div className="flex flex-col items-center justify-center py-4">
                    <div className="relative mb-3">
                        <div className="absolute inset-0 bg-status-success/20 rounded-full animate-ping scale-125"></div>
                        <div className="relative bg-status-success/10 p-3.5 rounded-full text-status-success border border-status-success/30 shadow-lg">
                            <Sparkles size={28} className="animate-pulse" />
                        </div>
                    </div>
                    <h4 className="text-txt-primary font-black text-lg tracking-wide mb-1">
                        {t('status_success')}
                    </h4>
                    <p className="text-xs text-txt-muted font-medium text-center px-4">
                        {t('label_ai_ready')}
                    </p>
                </div>

                {/* 📦 分析成果卡片 */}
                <div className="bg-surface-bg-alt border border-surface-border rounded-xl p-4 mb-5 flex flex-col gap-2 shadow-sm animate-in slide-in-from-bottom-2">
                    {/* 頂級摘要 */}
                    <div className="flex justify-between items-center py-1 text-sm border-b border-surface-border/40 pb-2.5">
                        <span className="text-txt-muted flex items-center gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                            {t('label_column_count')}
                        </span>
                        <span className="text-txt-primary font-black flex items-center gap-1">
                            <span className="text-brand-primary text-base mr-0.5">{columnCount}</span>
                        </span>
                    </div>

                    {/* 📊 7 大黃金流派大解構 */}
                    <div className="py-1 space-y-0.5">
                        {stats.plain > 0 && renderSchemeRow(t('scheme_plain'), stats.plain, 'bg-txt-muted/40')}
                        {stats.rate > 0 && renderSchemeRow(t('scheme_rate'), stats.rate, 'bg-status-info')}
                        {stats.accum > 0 && renderSchemeRow(t('scheme_accum'), stats.accum, 'bg-brand-secondary')}
                        {stats.product > 0 && renderSchemeRow(t('scheme_product'), stats.product, 'bg-brand-primary')}
                        {stats.prodAccum > 0 && renderSchemeRow(t('scheme_prod_accum'), stats.prodAccum, 'bg-brand-primary/60')}
                        {stats.lookup > 0 && renderSchemeRow(t('scheme_lookup'), stats.lookup, 'bg-status-warning')}
                        {stats.list > 0 && renderSchemeRow(t('scheme_list'), stats.list, 'bg-status-success')}
                    </div>

                    {/* Token 精密即時消耗表 (對齊 Google 官方 2026 牌價) */}
                    {tokenUsage && (
                        <div className="mt-2 pt-3 border-t border-surface-border/60 flex flex-col gap-1 bg-black/20 -mx-4 px-4 py-2.5 rounded-b-xl border-t border-white/5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-txt-muted font-mono text-[10px] tracking-tight">
                                    🚀 {selectedModel}
                                </span>
                                <span className="text-brand-primary font-black tracking-wider">
                                    NT$ {calculateCost(selectedModel, tokenUsage)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-mono text-txt-muted/70">
                                <span>
                                    In: {tokenUsage.promptTokenCount.toLocaleString()} / Out: {tokenUsage.candidatesTokenCount.toLocaleString()}
                                </span>
                                <span>
                                    {tokenUsage.totalTokenCount.toLocaleString()} Tokens
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🎬 使用者主導操作區 */}
                <div className="space-y-3">
                    <button
                        onClick={() => {
                            onAiSuccess(generatedTemplate);
                            reset();
                            setQueuedFiles([]);
                            setGeneratedTemplate(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-black text-[15px] shadow-lg shadow-brand-primary/20 active:scale-98 transition-all hover:brightness-105"
                    >
                        <Play size={18} className="fill-current" />
                        <span>{t('btn_use_this_template')}</span>
                    </button>

                    <button
                        onClick={() => {
                            reset();
                            setGeneratedTemplate(null);
                        }}
                        className="w-full py-2.5 text-txt-muted hover:text-txt-secondary font-bold rounded-xl bg-surface-bg hover:bg-surface-bg-alt border border-surface-border active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
                    >
                        {t('btn_reanalyze')}
                    </button>
                </div>
            </div>
        );
    };

    // 渲染錯誤狀態 (包含診斷模式)
    const renderError = () => {
        let displayError = t('error_generic');
        let diagnostic: { raw: string; error: string } | null = null;

        if (errorMessage === 'ai_error_rate_limit') displayError = t('error_rate_limit');
        else if (errorMessage === 'ai_error_invalid_json') displayError = t('error_invalid_json');
        else if (errorMessage?.startsWith('ai_error_json_parse_failed|')) {
            displayError = "AI 回傳格式解析失敗 (JSON Parse Error)";
            try {
                const jsonStr = errorMessage.split('|')[1];
                diagnostic = JSON.parse(jsonStr);
            } catch (e) {
                console.error('Failed to parse diagnostic info');
            }
        }

        return (
            <div className="space-y-3 mb-6 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-status-danger/10 border border-status-danger/20 rounded-xl p-4 flex gap-3 items-start shadow-sm">
                    <AlertCircle size={20} className="text-status-danger shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-status-danger leading-relaxed">{displayError}</p>
                        <p className="text-[11px] text-status-danger/70 mt-1">請嘗試再次生成，或更換模型測試。</p>
                    </div>
                    <button onClick={reset} className="text-txt-muted hover:text-txt-primary p-1 bg-white/5 rounded-full">
                        <X size={16} />
                    </button>
                </div>

                {/* 🔍 診斷報告區域：僅在解析失敗時顯示 */}
                {diagnostic && (
                    <div className="bg-surface-bg-alt border border-surface-border rounded-xl overflow-hidden shadow-sm">
                        <button 
                            onClick={() => setShowDebug(!showDebug)}
                            className="w-full flex justify-between items-center px-4 py-2.5 text-[11px] font-bold text-txt-secondary hover:bg-black/10 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Terminal size={14} />
                                檢視 AI 原始回傳報告
                            </span>
                            <span className={`transition-transform duration-300 ${showDebug ? 'rotate-180' : ''}`}>
                                <ChevronDown size={14} />
                            </span>
                        </button>
                        
                        {showDebug && (
                            <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-1 duration-200">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase tracking-wider text-txt-muted font-black">Error Trace</span>
                                    <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[10px] text-status-danger/90 break-all leading-tight">
                                        {diagnostic.error}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase tracking-wider text-txt-muted font-black">Raw Response (AI 原始輸出)</span>
                                    <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[10px] text-txt-primary/80 max-h-48 overflow-y-auto whitespace-pre-wrap leading-normal scrollbar-thin">
                                        {diagnostic.raw}
                                    </div>
                                </div>
                                <p className="text-[10px] text-txt-muted italic">
                                    * 提示：這通常是提示詞不夠嚴謹，導致模型輸出了非 JSON 的贅詞。
                                </p>
                            </div>
                        )}
                    </div>
                )}
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
                    {generatedTemplate ? (
                        renderSuccessResult()
                    ) : isProcessing ? (
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
                                 {(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemma-4-26b-a4b-it'] as const).map((model) => {
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
