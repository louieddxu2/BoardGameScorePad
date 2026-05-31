
import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Play, Loader2, AlertCircle, X, Sparkles, Plus, Trash2, Terminal, ChevronDown } from 'lucide-react';
import { useAiGenerator, UseAiGeneratorResult } from '../hooks/useAiGenerator';
import { useAiGeneratorTranslation } from '../../../i18n/aiGenerator';
import { GameTemplate } from '../../../types';
import { AiGenerationResult } from '../services/aiApiService';
import { useEffect } from 'react';
import CameraView from '../../../components/scanner/CameraView';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

export interface AiPromptModalProps {
    isOpen: boolean;
    gameName: string;
    onClose: () => void;
    onDirectStart: () => void;
    onAiSuccess: (result: Partial<GameTemplate>) => void;
    aiGenerator: UseAiGeneratorResult;
    elapsedTime: number;
    initialFiles?: File[];
    onInitialFilesConsumed?: () => void;
}

const AiPromptModal: React.FC<AiPromptModalProps> = ({
    isOpen,
    gameName,
    onClose,
    onAiSuccess,
    aiGenerator,
    elapsedTime,
    initialFiles,
    onInitialFilesConsumed
}) => {
    const { t } = useAiGeneratorTranslation();
    const { status, errorMessage, tokenUsage, streamText, processAndGenerate, reset, generatedResult } = aiGenerator;

    const { zIndex } = useModalBackHandler(isOpen, onClose, 'ai-prompt-modal');

    // 引擎切換狀態，預設選取穩定主力 gemini-2.5-flash-lite
    type ModelType = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-3-flash-preview' | 'gemini-3.1-flash-lite' | 'gemma-4-26b-a4b-it' | 'gemma-4-31b-it';
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

    useEffect(() => {
        if (!isOpen || !initialFiles?.length) return;
        setQueuedFiles(prev => [...prev, ...initialFiles]);
        onInitialFilesConsumed?.();
    }, [isOpen, initialFiles, onInitialFilesConsumed]);

    const [showDebug, setShowDebug] = useState<boolean>(false);

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
        } else if (model.includes('3.0')) {
            inputCostPer1M = 0.10; // 3.0 系列中階牌價
            outputCostPer1M = 0.40;
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

        await processAndGenerate(queuedFiles, gameName, selectedModel);
    };

    // 🌟 獨立的成功狀態統計區塊
    const renderSuccessStats = (result: AiGenerationResult) => {
        const columns = result.template.columns || [];
        const columnCount = columns.length;

        const stats = {
            plain: 0, rate: 0, accum: 0, product: 0, prodAccum: 0, lookup: 0, list: 0,
        };

        columns.forEach((col: any) => {
            const formula = col.formula || 'a1';
            const inputType = col.inputType || 'keypad';

            if (inputType === 'clicker') stats.list++;
            else if (formula === 'a1×c1') stats.rate++;
            else if (formula === 'a1+next') stats.accum++;
            else if (formula === 'a1×a2') stats.product++;
            else if (formula === '(a1×a2)+next') stats.prodAccum++;
            else if (formula.includes('f1') || col.functions) stats.lookup++;
            else stats.plain++;
        });

        const renderSchemeRow = (label: string, count: number, dotColorClass: string) => (
            <div className="flex justify-between items-center py-1 text-[11px] border-b border-white/5 last:border-0 last:pb-0">
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
            <div className="bg-surface-bg-alt border border-surface-border rounded-xl p-4 mb-2 flex flex-col gap-2 shadow-sm">
                <div className="flex justify-between items-center py-1 text-sm border-b border-surface-border/40 pb-2.5">
                    <span className="text-txt-muted flex items-center gap-1.5 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                        {t('label_column_count')}
                    </span>
                    <span className="text-txt-primary font-black flex items-center gap-1">
                        <span className="text-brand-primary text-base mr-0.5">{columnCount}</span>
                    </span>
                </div>
                <div className="py-1 space-y-0.5">
                    {stats.plain > 0 && renderSchemeRow(t('scheme_plain'), stats.plain, 'bg-txt-muted/40')}
                    {stats.rate > 0 && renderSchemeRow(t('scheme_rate'), stats.rate, 'bg-status-info')}
                    {stats.accum > 0 && renderSchemeRow(t('scheme_accum'), stats.accum, 'bg-brand-secondary')}
                    {stats.product > 0 && renderSchemeRow(t('scheme_product'), stats.product, 'bg-brand-primary')}
                    {stats.prodAccum > 0 && renderSchemeRow(t('scheme_prod_accum'), stats.prodAccum, 'bg-brand-primary/60')}
                    {stats.lookup > 0 && renderSchemeRow(t('scheme_lookup'), stats.lookup, 'bg-status-warning')}
                    {stats.list > 0 && renderSchemeRow(t('scheme_list'), stats.list, 'bg-status-success')}
                </div>
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
        );
    };

    // 🌟 核心統一視圖：處理中、成功、失敗皆使用此視圖
    const renderActiveState = () => {
        const isError = !!errorMessage;
        const isSuccess = !!generatedResult;
        const isWaiting = (status === 'compressing' || status === 'generating') && !isError && !isSuccess;

        let headerIcon = <Loader2 size={40} className="animate-spin" />;
        let headerColor = "brand-primary";
        let headerTitle = t('status_generating');
        let headerSubtitle = "";

        if (status === 'compressing') {
            headerTitle = t('status_compressing');
        } else if (isSuccess || status === 'success') {
            headerIcon = <Sparkles size={36} className="animate-pulse" />;
            headerColor = "status-success";
            headerTitle = t('status_success');
            headerSubtitle = t('label_ai_ready');
        } else if (isError) {
            headerIcon = <AlertCircle size={36} className="animate-pulse" />;
            headerColor = "status-danger";

            headerTitle = t('error_generic');
            if (errorMessage === 'ai_error_rate_limit') headerTitle = t('error_rate_limit');
            else if (errorMessage === 'ai_error_invalid_json') headerTitle = t('error_invalid_json');
            else if (errorMessage?.startsWith('ai_error_json_parse_failed|')) headerTitle = t('error_json_parse_failed');

            headerSubtitle = t('error_retry_suggest');
        }

        let diagnostic: { raw: string; error: string } | null = null;
        if (isError && errorMessage?.startsWith('ai_error_json_parse_failed|')) {
            try {
                const jsonStr = errorMessage.split('|')[1];
                diagnostic = JSON.parse(jsonStr);
            } catch (e) { }
        }

        let terminalContent = "";
        if (isError) {
            terminalContent = diagnostic ? diagnostic.raw : "";
        } else if (isSuccess && generatedResult) {
            terminalContent = generatedResult.rawText;
        } else {
            terminalContent = streamText;
        }

        return (
            <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300 w-full">
                {isWaiting && (
                    <div className="flex justify-between items-center mb-4 w-full">
                        <span className="text-[11px] font-bold text-txt-secondary truncate max-w-[180px] px-2 py-0.5 bg-surface-bg border border-surface-border rounded-full">
                            {gameName}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-txt-muted bg-surface-bg-alt px-1.5 py-0.5 rounded border border-surface-border">
                            {selectedModel}
                        </span>
                    </div>
                )}
                
                <div className="flex flex-col items-center justify-center py-2">
                    <div className="relative mb-3 flex items-center justify-center">
                        <div className={`absolute inset-0 bg-${headerColor}/20 rounded-full animate-ping scale-110`}></div>
                        <div className={`relative bg-${headerColor}/10 rounded-full text-${headerColor} border border-${headerColor}/30 shadow-md flex items-center justify-center w-16 h-16`}>
                            {/* Spinner or Icon */}
                            <div className={isWaiting ? "opacity-20" : ""}>
                                {headerIcon}
                            </div>
                            
                            {/* Centered Timer */}
                            {isWaiting && (
                                <span className="absolute text-sm font-black font-mono tracking-tighter">
                                    {elapsedTime}s
                                </span>
                            )}
                        </div>
                    </div>
                    <h4 className="text-txt-primary font-black text-base tracking-wide mb-1 text-center">
                        {headerTitle}
                    </h4>
                    {isWaiting && (
                        <p className="mt-1 text-[11px] text-status-warning font-semibold text-center px-4 leading-relaxed">
                            {t('processing_keep_awake_hint')}
                        </p>
                    )}
                    {headerSubtitle && (
                        <p className="text-xs text-txt-muted font-medium text-center px-4 leading-relaxed">
                            {headerSubtitle}
                        </p>
                    )}

                </div>

                {(terminalContent || isError) && (
                    <div className={`w-full bg-modal-bg-recessed border ${isError ? 'border-status-danger/30' : 'border-surface-border'} rounded-xl p-3 text-left overflow-hidden shadow-inner flex flex-col mb-2`}>
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-surface-border/50 shrink-0">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className={isError ? "text-status-danger" : "text-brand-primary"} />
                                <span className="text-[10px] font-mono tracking-wider text-txt-muted uppercase">
                                    {isError ? t('error_raw_report') : t('label_stream_output')}
                                </span>
                            </div>
                            {(!isError && !isSuccess) && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />}
                        </div>
                        <div className="font-mono text-[11px] text-txt-primary leading-relaxed max-h-[45vh] overflow-y-auto whitespace-pre-wrap scrollbar-thin scrollbar-thumb-surface-border flex flex-col select-text cursor-text">
                            <p className="break-all selection:bg-brand-primary/30 selection:text-txt-title">
                                {terminalContent}
                                {(!isError && !isSuccess) && <span className="inline-block w-1 h-3 ml-0.5 align-middle bg-brand-primary animate-pulse" />}
                            </p>
                            {isError && diagnostic?.error && (
                                <div className="mt-2 p-2 bg-status-danger/10 text-status-danger/90 rounded border border-status-danger/20">
                                    {diagnostic.error}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isSuccess && generatedResult && renderSuccessStats(generatedResult)}

                <div className="space-y-3 mt-2">
                    {isSuccess && generatedResult ? (
                        <>
                            <button
                                onClick={() => {
                                    onAiSuccess(generatedResult.template);
                                    reset();
                                    setQueuedFiles([]);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-black text-[15px] shadow-lg shadow-brand-primary/20 active:scale-98 transition-all hover:brightness-105"
                            >
                                <Play size={18} className="fill-current" />
                                <span>{t('btn_use_this_template')}</span>
                            </button>
                            <button
                                onClick={() => {
                                    reset();
                                }}
                                className="w-full py-2.5 text-txt-muted hover:text-txt-secondary font-bold rounded-xl bg-surface-bg hover:bg-surface-bg-alt border border-surface-border active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
                            >
                                {t('btn_reanalyze')}
                            </button>
                        </>
                    ) : isError ? (
                        <button
                            onClick={reset}
                            className="w-full py-3.5 text-txt-primary hover:text-white font-bold rounded-xl bg-surface-bg border border-surface-border hover:bg-surface-border active:scale-95 transition-all text-sm flex items-center justify-center gap-2 shadow-sm"
                        >
                            <X size={16} />
                            {t('btn_return_retry')}
                        </button>
                    ) : null}
                </div>
            </div>
        );
    };

    const isProcessing = status === 'compressing' || status === 'generating' || status === 'success';

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
            style={{ zIndex }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
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
                className="modal-container w-[95vw] max-w-md bg-app-bg shadow-2xl relative overflow-hidden p-0 border border-modal-border max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 頂部裝飾色條 */}
                <div className="h-1 w-full bg-brand-primary" />

                <div className="p-3.5 overflow-y-auto scrollbar-thin max-h-[calc(90vh-4px)] flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 text-brand-primary">
                            <Sparkles size={20} />
                            <h3 className="font-black text-xl tracking-tight">{t('title')}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 text-txt-muted hover:text-txt-primary bg-surface-bg-alt rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content Container: 獨佔式渲染判斷邏輯 */}
                    {errorMessage || generatedResult || isProcessing ? (
                        renderActiveState()
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
                                {(['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemma-4-26b-a4b-it', 'gemma-4-31b-it'] as const).map((model) => {
                                    const isSelected = selectedModel === model;
                                    return (
                                        <button
                                            key={model}
                                            type="button"
                                            onClick={() => setSelectedModel(model)}
                                            className={`py-2 px-1 rounded-lg border font-mono transition-all duration-200 text-[10px] tracking-tighter active:scale-95 flex items-center justify-center ${isSelected
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
