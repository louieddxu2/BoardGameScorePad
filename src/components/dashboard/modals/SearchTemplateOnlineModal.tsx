import React from 'react';
import { X, Sparkles, Play, Search } from 'lucide-react';
import { useSearchTemplateOnlineTranslation } from '../../../i18n/search_template_online';
import { useCloudTemplateSuggestion, CloudSuggestionItem } from '../../../features/game-selector/hooks/useCloudTemplateSuggestion';
import { FetchResponse } from '../../../services/cloudClient';
import { classifyColumnFormula } from '../../../utils/templateUtils';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

export interface SearchTemplateOnlineModalProps {
    isOpen: boolean;
    gameName: string;
    bggId?: string;
    onClose: () => void;
    onDirectStart: () => void;
    onAiClick: () => void;
    onSelectTemplate?: (template: CloudSuggestionItem) => void;
}

const SearchTemplateOnlineModal: React.FC<SearchTemplateOnlineModalProps> = ({
    isOpen,
    gameName,
    bggId,
    onClose,
    onDirectStart,
    onAiClick,
    onSelectTemplate
}) => {
    const { t } = useSearchTemplateOnlineTranslation();
    const { loading, suggestions, error } = useCloudTemplateSuggestion(gameName, bggId, isOpen);
    
    const { zIndex } = useModalBackHandler(isOpen, onClose, 'search-template-online');

    // 預覽與網格模式切換：'detail' (詳細預覽最佳範本) | 'grid' (2x2 目錄網格)
    const [viewMode, setViewMode] = React.useState<'detail' | 'grid'>('detail');
    const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

    React.useEffect(() => {
        if (isOpen) {
            setViewMode('detail');
            setSelectedIdx(0);
        }
    }, [isOpen]);

    const currentSuggestion = suggestions[selectedIdx] || suggestions[0];

    // 緩存選中預覽的 payload
    const payload = React.useMemo(() => {
        if (!currentSuggestion) return null;
        try {
            return typeof currentSuggestion.payload === 'string'
                ? JSON.parse(currentSuggestion.payload)
                : currentSuggestion.payload;
        } catch (e) {
            return null;
        }
    }, [currentSuggestion]);

    const cols = payload?.columns || [];

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
            style={{ zIndex }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="modal-container w-[92vw] max-w-sm bg-app-bg shadow-2xl relative overflow-hidden p-0 border border-modal-border max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 頂部裝飾色條 */}
                <div className="h-1 w-full bg-gradient-to-r from-brand-primary to-brand-secondary" />

                <div className="p-5 flex flex-col max-h-[calc(92vh-4px)]">
                    {/* Header & Subtitle */}
                    <div className="flex justify-between items-start mb-4 shrink-0">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 text-brand-primary">
                                <Search size={20} className="text-brand-primary" />
                                <h3 className="font-black text-xl tracking-tight text-txt-title">
                                    {t('search_online_title')}
                                </h3>
                            </div>
                            <span className="text-xs font-bold text-txt-secondary pl-7 flex items-center gap-1">
                                🎮 {gameName}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-txt-muted hover:text-txt-primary bg-surface-bg-alt rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* 中段建議與預覽核心區域 */}
                    <div className="flex-1 overflow-y-auto scrollbar-none pr-0.5">
                        {loading ? (
                            /* 骨架屏：脈搏亮滅閃爍與漸變流光 */
                            <div className="bg-surface-bg-alt/60 border border-surface-border rounded-xl p-4 mb-4 animate-pulse flex flex-col gap-3 min-h-[120px]">
                                <div className="flex justify-between items-center">
                                    <div className="h-4 w-2/3 bg-txt-muted/20 rounded-md" />
                                    <div className="h-3 w-1/4 bg-txt-muted/20 rounded-md" />
                                </div>
                                <div className="space-y-2 mt-1">
                                    <div className="h-3 w-full bg-txt-muted/15 rounded-md" />
                                    <div className="h-3 w-5/6 bg-txt-muted/15 rounded-md" />
                                </div>
                            </div>
                        ) : error ? (
                            /* 真正的連線或 API 錯誤 */
                            <div className="bg-status-danger/5 border border-dashed border-status-danger/20 rounded-xl p-5 mb-4 flex flex-col items-center justify-center text-center gap-2">
                                <span className="text-xl">⚠️</span>
                                <span className="text-xs font-bold text-status-danger">
                                    {t('search_online_error_title')}
                                </span>
                                <span className="text-[10px] text-txt-muted max-w-[240px]">
                                    {t('search_online_error_desc')}
                                </span>
                            </div>
                        ) : suggestions.length > 0 ? (
                            viewMode === 'detail' ? (
                                /* 最佳推薦卡片預覽 */
                                <div className="bg-surface-bg-alt/80 border border-brand-primary/20 rounded-xl p-4 mb-1 flex flex-col shadow-sm hover:border-brand-primary/40 transition-all duration-300 relative overflow-hidden group">
                                    {/* 熱門標籤 */}
                                    {selectedIdx === 0 && (
                                        <div className="absolute top-0 right-0 bg-gradient-to-l from-brand-primary to-brand-secondary text-[9px] font-black text-white px-2 py-0.5 rounded-bl-lg uppercase tracking-wider animate-pulse">
                                            HOT
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-start pr-8 mb-3">
                                        <span className="font-bold text-txt-primary text-[15px] truncate max-w-[200px]">
                                            {currentSuggestion.name}
                                        </span>
                                        <span className="text-[10px] text-txt-muted font-bold whitespace-nowrap bg-surface-bg border border-surface-border px-1.5 py-0.5 rounded">
                                            {"\u2b07\ufe0f"} {currentSuggestion.downloadCount || 0}
                                        </span>
                                    </div>
                                    
                                    {/* 一列一個項目之縱向平滑滑動瀏覽區 */}
                                    <div className="relative mb-2 flex flex-col">
                                        <div className="max-h-[140px] overflow-y-auto scrollbar-thin pr-1 pb-1 flex flex-col gap-1">
                                            {cols.map((col: any, idx: number) => {
                                                const { formulaKey, bgClass, textClass } = classifyColumnFormula(col);
                                                return (
                                                    <div 
                                                        key={col.id || idx} 
                                                        className="flex justify-between items-center py-1 border-b border-surface-border/30 last:border-0"
                                                    >
                                                        <span className="text-xs font-bold text-txt-primary flex items-center gap-1.5">
                                                            <span className="opacity-40 text-[10px]">{idx + 1}.</span>
                                                            {col.name}
                                                        </span>
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black ${bgClass} ${textClass} shrink-0`}>
                                                            {t(formulaKey as any)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* 漸層遮罩提示 */}
                                        {cols.length > 3 && (
                                            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-app-bg to-transparent pointer-events-none" />
                                        )}
                                    </div>
                                    
                                    {/* 下載啟用按鈕 */}
                                    <button
                                        onClick={() => onSelectTemplate && onSelectTemplate(currentSuggestion)}
                                        className="w-full py-2 bg-brand-primary text-white hover:brightness-110 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-primary/10 active:scale-98"
                                    >
                                        <span>
                                            {currentSuggestion.isDownloaded 
                                                ? t('search_online_btn_downloaded') 
                                                : t('search_online_btn_download')}
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                /* 2x2 縱向滑動網格目錄 */
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto scrollbar-thin pr-1 pb-2">
                                        {suggestions.map((tpl, idx) => {
                                            let colCount = 0;
                                            try {
                                                const p = typeof tpl.payload === 'string' ? JSON.parse(tpl.payload) : tpl.payload;
                                                colCount = p?.columns?.length || 0;
                                            } catch (e) {}

                                            const isSelected = selectedIdx === idx;

                                            return (
                                                <div 
                                                    key={tpl.id || idx}
                                                    onClick={() => {
                                                        setSelectedIdx(idx);
                                                        setViewMode('detail');
                                                    }}
                                                    className={`bg-surface-bg-alt/50 border rounded-xl p-3 flex flex-col justify-between hover:border-brand-primary/40 hover:shadow-sm hover:scale-[1.01] cursor-pointer active:scale-98 transition-all duration-300 relative group min-h-[105px] ${
                                                        isSelected ? 'border-brand-primary bg-brand-primary/5' : 'border-surface-border'
                                                    }`}
                                                >
                                                    {/* 熱門標籤 */}
                                                    {idx === 0 && (
                                                        <div className="absolute top-0 right-0 bg-gradient-to-l from-brand-primary to-brand-secondary text-[8px] font-black text-white px-1.5 py-0.5 rounded-bl-lg uppercase tracking-wider">
                                                            HOT
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-txt-primary text-xs line-clamp-1 group-hover:text-brand-primary transition-colors flex items-center gap-1">
                                                            {tpl.name}
                                                            {tpl.isDownloaded && (
                                                                <span className="inline-flex items-center bg-status-success/10 text-status-success border border-status-success/20 px-1 py-0.25 rounded text-[8px] font-black shrink-0">
                                                                    {t('search_online_badge_owned')}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-[9px] text-txt-muted flex items-center gap-1 font-medium">
                                                            📊 {colCount} {t('search_online_columns_suffix')}
                                                        </span>
                                                        <span className="text-[9px] text-txt-muted flex items-center gap-1 font-medium">
                                                            {"\u2b07\ufe0f"} {tpl.downloadCount || 0}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="w-full mt-2 py-1 bg-surface-bg-alt border border-surface-border/50 group-hover:bg-brand-primary/10 group-hover:text-brand-primary group-hover:border-brand-primary/20 text-txt-muted rounded-lg font-bold text-[9px] transition-all flex items-center justify-center gap-1">
                                                        <span>{t('search_online_btn_view_detail')}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* 返回按鈕 */}
                                    <button
                                        onClick={() => setViewMode('detail')}
                                        className="w-full py-2 bg-surface-bg-alt border border-surface-border text-txt-secondary hover:text-txt-primary rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1"
                                    >
                                        <span>{t('search_online_btn_back')}</span>
                                    </button>
                                </div>
                            )
                        ) : (
                            /* 查無在線範本 */
                            <div className="bg-surface-bg-alt/30 border border-dashed border-surface-border rounded-xl p-5 mb-4 flex flex-col items-center justify-center text-center gap-2">
                                <span className="text-xl">✨</span>
                                <span className="text-xs font-bold text-txt-secondary">
                                    {t('search_online_empty_title')}
                                </span>
                                <span className="text-[10px] text-txt-muted max-w-[240px]">
                                    {t('search_online_empty_desc')}
                                </span>
                            </div>
                        )}

                        {/* 如果有多版本，顯示虛線看更多版本按鈕 */}
                        {suggestions.length >= 2 && viewMode === 'detail' && !loading && !error && (
                            <button
                                onClick={() => setViewMode('grid')}
                                className="w-full mt-3 py-2 border border-dashed border-brand-primary/30 hover:border-brand-primary/60 text-brand-primary rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 bg-brand-primary/5 hover:bg-brand-primary/10 active:scale-98"
                            >
                                <span>{t('search_online_more_versions', { count: suggestions.length - 1 })}</span>
                            </button>
                        )}
                    </div>

                    {/* Action Buttons 合併 */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-surface-border/30 shrink-0">
                        {/* Option 1: AI Scanner */}
                        <button
                            onClick={onAiClick}
                            className="flex items-center justify-center gap-1.5 py-3 px-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-bold text-xs shadow-md shadow-brand-primary/10 active:scale-95 hover:brightness-110 transition-all"
                        >
                            <Sparkles size={13} className="animate-pulse" />
                            <span>{t('search_online_btn_ai')}</span>
                        </button>

                        {/* Option 2: Direct Simple Launch */}
                        <button
                            onClick={onDirectStart}
                            className="flex items-center justify-center gap-1.5 py-3 px-2 text-txt-secondary font-bold rounded-xl bg-surface-bg-alt hover:bg-surface-bg border border-surface-border active:scale-95 transition-all"
                        >
                            <Play size={11} className="fill-current text-txt-secondary" />
                            <span>{t('search_online_btn_direct')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchTemplateOnlineModal;
