
import React from 'react';
import { QuickAction, ScoreColumn } from '../../types';
import { isColorDark } from '../../utils/ui';

interface QuickButtonPadProps {
  column: ScoreColumn;
  onAction: (action: QuickAction) => void;
}

const QuickButtonPad: React.FC<QuickButtonPadProps> = ({ column, onAction }) => {
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
  
  // Layout Logic:
  // If 1 or 2 columns, use Row layout (Label left, Value right).
  // If > 2 columns (Grid view), use Col layout (Label top, Value bottom).
  const isListMode = cols <= 2;

  // Minimum height per button to ensure usability.
  // Grid mode needs slightly more height for stacked text+number.
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
        {/* Brightness reduction mask */}
        <div className="absolute inset-0 bg-black/15 pointer-events-none z-10"></div>

        {actions.map(action => {
            const bg = action.color || column.color || '#ffffff';
            const isDark = isColorDark(bg);
            // FIX: Only show modifier style if it's actually in sum-parts mode
            const isModifier = column.formula.includes('+next') && action.isModifier;
            const textColor = isDark ? 'white' : '#0f172a';

            return (
            <button
                key={action.id}
                onClick={() => handleAction(action)}
                className={`rounded-xl flex items-center p-2 shadow-sm active:scale-95 transition-all relative h-full ${isListMode ? 'flex-row justify-between px-4' : 'flex-col justify-center'} ${isModifier ? 'border-dashed border-2 border-white/40' : 'border border-black/10'}`}
                style={{ backgroundColor: bg }}
            >
                <span 
                    className={`font-bold leading-tight break-words pointer-events-none ${isListMode ? 'text-[20px] text-left flex-1 min-w-0' : 'text-[16px] text-center w-full mb-1'}`} 
                    style={{ color: textColor }}
                >
                    {action.label}
                </span>
                <span 
                    className={`font-mono font-bold rounded-full text-white flex items-center justify-center shrink-0 pointer-events-none ${isListMode ? 'text-[16px] px-3 py-1 ml-2' : 'text-[14px] px-2 py-0.5'} ${isModifier ? 'bg-white/30' : 'bg-black/20'}`}
                >
                    {action.value > 0 ? '+' : ''}{action.value}
                </span>
            </button>
            );
        })}
        </div>
    </div>
  );
};

export default QuickButtonPad;
