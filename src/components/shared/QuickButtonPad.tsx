
import React from 'react';
import { QuickAction, ScoreColumn } from '../../types';
import { isColorTooLight } from '../../utils/ui';
import { Check } from 'lucide-react';

interface QuickButtonPadProps {
  column: ScoreColumn;
  onAction: (action: QuickAction) => void;
  currentOptionId?: string; // New prop for highlighting
}

const QuickButtonPad: React.FC<QuickButtonPadProps> = ({ column, onAction, currentOptionId }) => {
  const actions = column.quickActions || [];

  const handleAction = (action: QuickAction) => {
    if (navigator.vibrate) navigator.vibrate(10);
    onAction(action);
  };

  if (actions.length === 0) {
      return (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
              尚未設定快速按鈕
          </div>
      );
  }

  const cols = column.buttonGridColumns || 1;
  const isListMode = cols <= 2;
  const minRowHeight = isListMode ? '3.5rem' : '4.5rem';

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-2">
        <div 
            className="grid gap-2 relative"
            style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridAutoRows: `minmax(${minRowHeight}, auto)`
            }}
        >
        <div className="absolute inset-0 bg-black/15 pointer-events-none z-0"></div>

        {actions.map(action => {
            const bg = action.color || column.color || '#ffffff';
            const isLightBg = isColorTooLight(bg);
            const isStandardSumParts = column.formula.includes('+next') && !column.formula.includes('×a2');
            const isModifier = isStandardSumParts && action.isModifier;
            
            const isSelected = currentOptionId === action.id;

            // --- New Dynamic Style Logic ---
            
            // 1. Text Color (for both label and badge number)
            const textColor = isLightBg ? '#0f172a' : 'white';

            // 2. Modifier Border Style
            const borderClass = isModifier
              ? `border-dashed border-2 ${isLightBg ? 'border-black/40' : 'border-white/50'}`
              : 'border border-black/10';
            
            // 3. Badge Background Style
            const badgeBgClass = isModifier 
              ? (isLightBg ? 'bg-black/30' : 'bg-white/30')
              : 'bg-black/20';

            return (
            <button
                key={action.id}
                onClick={() => handleAction(action)}
                className={`
                    rounded-xl flex items-center p-2 shadow-sm transition-all relative h-full 
                    ${isListMode ? 'flex-row justify-between px-4' : 'flex-col justify-center'} 
                    ${borderClass}
                    ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10 scale-[1.02]' : 'active:scale-95 z-10'}
                `}
                style={{ backgroundColor: bg }}
            >
                {/* Selection Indicator Icon */}
                {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-white text-emerald-600 rounded-full p-0.5 shadow-md animate-in zoom-in duration-200 z-20">
                        <Check strokeWidth={4} size={12} />
                    </div>
                )}

                <span 
                    className={`font-bold leading-tight break-words whitespace-pre-wrap pointer-events-none ${isListMode ? 'text-[20px] text-left flex-1 min-w-0' : 'text-[16px] text-center w-full mb-1'}`} 
                    style={{ color: textColor }}
                >
                    {action.label}
                </span>
                <span 
                    className={`font-mono font-bold rounded-full flex items-center justify-center shrink-0 pointer-events-none ${isListMode ? 'text-[16px] px-3 py-1 ml-2' : 'text-[14px] px-2 py-0.5'} ${badgeBgClass}`}
                    style={{ color: textColor }}
                >
                    {isStandardSumParts && action.value > 0 ? '+' : ''}{action.value}
                </span>
            </button>
            );
        })}
        </div>
    </div>
  );
};

export default QuickButtonPad;
