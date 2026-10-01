
import React from 'react';
import { QuickAction, ScoreColumn } from '../../types';
import { isColorTooLight } from '../../utils/ui';
import { Check } from 'lucide-react';
import { useSessionTranslation } from '../../i18n/session';
import { useTouchAction } from './useTouchAction';

import { injectSoftHyphens } from '../../utils/text';

interface QuickButtonPadProps {
    column: ScoreColumn;
    onAction: (action: QuickAction) => void;
    currentOptionId?: string; // New prop for highlighting
    currentMultiOptionIds?: string[];
}

interface QuickActionButtonProps {
    action: QuickAction;
    isSelected: boolean;
    isListMode: boolean;
    showActionValue: boolean;
    isStandardSumParts: boolean;
    backgroundColor: string;
    textColor: string;
    borderClass: string;
    badgeBackgroundClass: string;
    onAction: (action: QuickAction) => void;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
    action,
    isSelected,
    isListMode,
    showActionValue,
    isStandardSumParts,
    backgroundColor,
    textColor,
    borderClass,
    badgeBackgroundClass,
    onAction,
}) => {
    const touchHandlers = useTouchAction<HTMLButtonElement>(() => {
        if (navigator.vibrate) navigator.vibrate(10);
        onAction(action);
    }, { moveThreshold: 10 });

    // Use the planned row height, never the height produced by wrapping text.
    // Only text and nominal row height scale: fixed padding/gaps must not
    // consume the label's width during zoom. A stacked badge reserves its
    // root-relative line height plus 8px of fixed padding and label gap.
    return (
        <button
            {...touchHandlers}
            className={`
                    rounded-xl flex items-center p-[8px] shadow-sm transition-all relative h-full
                    ${isListMode ? 'flex-row justify-between px-[16px]' : 'flex-col justify-center'}
                    ${borderClass}
                    ${isSelected ? 'ring-2 ring-[rgb(var(--c-txt-primary))] ring-offset-2 ring-offset-[rgb(var(--c-surface-bg))] z-10 scale-[1.02]' : 'active:scale-95 z-10'}
                `}
            style={{
                backgroundColor,
                '--quick-button-border-height': borderClass.includes('border-2') ? '4px' : '2px',
                '--quick-button-value-reserve': !isListMode && showActionValue ? 'calc(1.3125rem + 8px)' : '0rem',
                '--quick-button-label-height': 'calc(var(--quick-button-row-height) - 16px - var(--quick-button-border-height) - var(--quick-button-value-reserve))',
            } as React.CSSProperties}
        >
            {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 bg-white text-status-success rounded-full p-[2px] shadow-md animate-in zoom-in duration-200 z-20">
                    <Check strokeWidth={4} size={12} />
                </div>
            )}

            <span
                className={`quick-button-label pointer-events-none ${!showActionValue ? 'quick-button-label-only' : ''} ${isListMode ? 'text-left flex-1 min-w-0' : 'text-center w-full'} ${!isListMode && showActionValue ? 'mb-[4px]' : ''}`}
            >
                <span
                    className={`quick-button-label-text block font-bold leading-tight break-words whitespace-pre-wrap pointer-events-none hyphenate ${isListMode ? 'text-[1.25rem]' : 'text-[1rem]'}`}
                    style={{ color: textColor }}
                >
                    {injectSoftHyphens(action.label)}
                </span>
            </span>
            {showActionValue && (
                <span
                    className={`font-mono font-bold leading-normal rounded-full flex items-center justify-center shrink-0 pointer-events-none ${isListMode ? 'text-[1rem] px-[12px] py-[4px] ml-[8px]' : 'text-[0.875rem] px-[8px] py-[2px]'} ${badgeBackgroundClass}`}
                    style={{ color: textColor }}
                >
                    {isStandardSumParts && action.value > 0 ? '+' : ''}{action.value}
                </span>
            )}
        </button>
    );
};

const QuickButtonPad: React.FC<QuickButtonPadProps> = ({ column, onAction, currentOptionId, currentMultiOptionIds }) => {
    const { t } = useSessionTranslation();
    const actions = column.quickActions || [];

    if (actions.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex items-center justify-center text-txt-muted text-sm italic">
                {t('quick_button_empty')}
            </div>
        );
    }

    const cols = column.buttonGridColumns || 1;
    const isListMode = cols <= 1;
    const showActionValue = column.renderMode !== 'label_only';
    const minRowHeight = isListMode ? '3.5rem' : '4.5rem';

    return (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-[8px]">
            <div
                className="grid gap-[8px] relative"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridAutoRows: `minmax(${minRowHeight}, auto)`,
                    '--quick-button-row-height': minRowHeight,
                } as React.CSSProperties}
            >
                <div className="absolute inset-0 bg-[rgb(var(--c-black)_/_0.05)] dark:bg-[rgb(var(--c-black)_/_0.15)] pointer-events-none z-0"></div>

                {actions.map(action => {
                    const bg = action.color || column.color || 'rgb(var(--c-white))';
                    const isLightBg = isColorTooLight(bg);
                    const isStandardSumParts = column.formula.includes('+next') && !column.formula.includes('×a2');
                    const isModifier = isStandardSumParts && action.isModifier;

                    const isSelected = currentOptionId === action.id || (currentMultiOptionIds || []).includes(action.id);

                    // --- New Dynamic Style Logic ---

                    // Contrast is against a game-selected background, not the app surface.
                    // Keep fixed palette tokens here: semantic UI colors change with theme.
                    const textColor = isLightBg ? 'rgb(var(--c-slate-900))' : 'rgb(var(--c-slate-50))';

                    // 2. Modifier Border Style
                    const borderClass = isModifier
                        ? `border-dashed border-2 ${isLightBg ? 'border-[rgb(var(--c-black)_/_0.4)]' : 'border-[rgb(var(--c-white)_/_0.5)]'}`
                        : 'border border-[rgb(var(--c-black)_/_0.1)]';

                    // 3. Badge Background Style
                    const badgeBgClass = isModifier
                        ? (isLightBg ? 'bg-[rgb(var(--c-black)_/_0.3)]' : 'bg-[rgb(var(--c-white)_/_0.3)]')
                        : 'bg-[rgb(var(--c-black)_/_0.2)]';

                    return (
                        <QuickActionButton
                            key={action.id}
                            action={action}
                            isSelected={isSelected}
                            isListMode={isListMode}
                            showActionValue={showActionValue}
                            isStandardSumParts={isStandardSumParts}
                            backgroundColor={bg}
                            textColor={textColor}
                            borderClass={borderClass}
                            badgeBackgroundClass={badgeBgClass}
                            onAction={onAction}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default QuickButtonPad;
