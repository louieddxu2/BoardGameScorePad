
import React from 'react';
import { Briefcase, CopyPlus, Plus } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface GridFooterProps {
    isEditMode: boolean;
    onAddColumn: () => void;
    onOpenBatchAdd?: () => void;
    itemColStyle: React.CSSProperties;
    // Toolbox Props
    showToolboxButton: boolean;
    isToolboxOpen: boolean;
    onToggleToolbox: () => void;
    isGenerating?: boolean;
    /** Shown at the right of the middle area, beside the toolbox button (the game-rules entry). */
    middleEnd?: React.ReactNode;
}

const GridFooter: React.FC<GridFooterProps> = ({
    isEditMode,
    onAddColumn,
    onOpenBatchAdd,
    itemColStyle,
    showToolboxButton,
    isToolboxOpen,
    onToggleToolbox,
    isGenerating,
    middleEnd,
}) => {
    const { t } = useSessionTranslation();
    // 顯示條件：編輯模式開啟、需要顯示工具箱按鈕，或有規則入口
    // 三者皆否時整列隱藏，節省空間
    if (!isEditMode && !showToolboxButton && !middleEnd) return null;

    return (
        <div className="flex relative z-10 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Left Side: Batch add and blank add controls OR Placeholder */}
            <div
                className={`sticky left-0 border-r border-b border-[rgb(var(--c-grid-cell-border))] flex items-center justify-center z-20 shrink-0 ${isGenerating ? 'pointer-events-none opacity-50 filter grayscale' : ''}`}
                style={{ ...itemColStyle, backgroundColor: 'rgb(var(--c-grid-cell-bg))' }}
            >
                {isEditMode ? (
                    <div
                        className="grid h-8 w-full"
                        style={{ gridTemplateColumns: 'minmax(28px, 4fr) minmax(42px, 6fr)' }}
                    >
                        <button
                            onClick={onOpenBatchAdd}
                            className="flex h-8 w-full items-center justify-center text-txt-muted transition-colors hover:bg-surface-hover hover:text-brand-primary active:scale-95"
                            title={t('modal_copy_existing')}
                            aria-label={t('modal_copy_existing')}
                        >
                            <CopyPlus size={15} />
                        </button>
                        <button
                            onClick={onAddColumn}
                            className="flex h-8 w-full items-center justify-center border-l border-[rgb(var(--c-grid-cell-border))] text-status-success transition-colors hover:bg-surface-hover hover:text-status-success active:scale-95"
                            title={t('modal_add_blank')}
                            aria-label={t('modal_add_blank')}
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                ) : (
                    // Placeholder to keep the grid aligned when not in edit mode
                    <div className="w-8 h-8" />
                )}
            </div>

            {/* Middle Spacer; its end item stays beside the toolbox while the players scroll */}
            <div
                className="flex-1 flex items-center justify-end border-b border-[rgb(var(--c-grid-cell-border)/0.5)] min-h-[3rem]"
                style={{ backgroundColor: 'rgb(var(--c-grid-cell-bg))' }}
            >
                {middleEnd && (
                    <div className={`sticky px-2 ${showToolboxButton ? 'right-[54px]' : 'right-0'}`}>{middleEnd}</div>
                )}
            </div>

            {/* Right Side: Toolbox Toggle */}
            {showToolboxButton && (
                <div
                    className="sticky right-0 border-l border-b border-[rgb(var(--c-grid-cell-border))] flex items-center justify-center p-2 z-20 shrink-0"
                    style={{ width: '54px', backgroundColor: 'rgb(var(--c-grid-cell-bg))' }}
                >
                    <button
                        onClick={onToggleToolbox}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm group border
                        ${isToolboxOpen
                                ? 'bg-brand-primary text-txt-on-color border-brand-primary shadow-lg shadow-brand-primary/20'
                                : 'text-txt-muted border-[rgb(var(--c-grid-cell-border))] hover:text-txt-primary hover:border-txt-muted'
                            }
                    `}
                        style={!isToolboxOpen ? { backgroundColor: 'rgb(var(--c-grid-cell-bg-alt))' } : {}}
                        title={t('grid_toggle_toolbox')}
                    >
                        <Briefcase size={16} className={isToolboxOpen ? "fill-current" : ""} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default GridFooter;
