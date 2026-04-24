
import React from 'react';
import { Plus, Briefcase } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

interface GridFooterProps {
    isEditMode: boolean;
    onAddColumn: () => void;
    itemColStyle: React.CSSProperties;
    // Toolbox Props
    showToolboxButton: boolean;
    isToolboxOpen: boolean;
    onToggleToolbox: () => void;
}

const GridFooter: React.FC<GridFooterProps> = ({
    isEditMode,
    onAddColumn,
    itemColStyle,
    showToolboxButton,
    isToolboxOpen,
    onToggleToolbox,
}) => {
    const { t } = useSessionTranslation();
    // 顯示條件：編輯模式開啟 OR 需要顯示工具箱按鈕
    // 如果兩者皆否，則整列隱藏，節省空間
    if (!isEditMode && !showToolboxButton) return null;

    return (
        <div className="flex relative z-10 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Left Side: Add Column OR Placeholder */}
            <div
                className="sticky left-0 border-r border-b border-[rgb(var(--c-grid-cell-border))] flex items-center justify-center p-2 z-20 shrink-0"
                style={{ ...itemColStyle, backgroundColor: 'rgb(var(--c-grid-cell-bg))' }}
            >
                {isEditMode ? (
                    <button
                        onClick={onAddColumn}
                        className="w-8 h-8 rounded-full hover:bg-surface-hover text-status-success border border-[rgb(var(--c-grid-cell-border))] hover:border-status-success/50 flex items-center justify-center transition-all active:scale-95 shadow-sm group"
                        style={{ backgroundColor: 'rgb(var(--c-grid-cell-bg-alt))' }}
                        title={t('grid_add_column')}
                    >
                        <Plus size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                ) : (
                    // Placeholder to keep the grid aligned when not in edit mode
                    <div className="w-8 h-8" />
                )}
            </div>

            {/* Middle Spacer */}
            <div 
                className="flex-1 border-b border-[rgb(var(--c-grid-cell-border)/0.5)] min-h-[3rem]" 
                style={{ backgroundColor: 'rgb(var(--c-grid-cell-bg))' }}
            />

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
                                ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20'
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
