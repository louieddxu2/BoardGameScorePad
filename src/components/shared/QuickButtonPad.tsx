
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
  const rows = Math.ceil(actions.length / cols);
  
  // Layout Logic:
  // If 1 column (List view), use Row layout (Label left, Value right).
  // If > 1 column (Grid view), use Col layout (Label top, Value bottom).
  const isListMode = cols === 1;

  // Minimum height per button to ensure usability.
  // Grid mode needs slightly more height for stacked text+number.
  const minRowHeight = isListMode ? '3.5rem' : '4.5rem';

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-2">
        <div 
            className="grid gap-2"
            style={{
                // Use minHeight: 100% so if there are few items, they stretch to fill the scroll container.
                // If there are many items, they will exceed 100% and trigger the parent's scroll.
                minHeight: '100%', 
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                // minmax ensures buttons never get too small, but expand (1fr) to fill space if available.
                gridTemplateRows: `repeat(${rows}, minmax(${minRowHeight}, 1fr))`
            }}
        >
        {actions.map(action => {
            const bg = action.color || column.color || '#3b82f6';
            const isDark = isColorDark(bg);
            const isModifier = action.isModifier;
            const textColor = isDark ? 'white' : '#0f172a';

            return (
            <button
                key={action.id}
                onClick={() => handleAction(action)}
                className={`rounded-xl flex items-center p-2 shadow-sm active:scale-95 transition-all relative h-full ${isListMode ? 'flex-row justify-between px-4' : 'flex-col justify-center'} ${isModifier ? 'border-dashed border-2 border-white/40' : 'border border-white/10'}`}
                style={{ backgroundColor: bg }}
            >
                {action.label && (
                    <span 
                        className={`font-bold leading-tight break-words pointer-events-none ${isListMode ? 'text-lg text-left' : 'text-sm text-center w-full mb-1'}`} 
                        style={{ color: textColor }}
                    >
                        {action.label}
                    </span>
                )}
                <span 
                    className={`font-mono font-bold rounded-full text-white flex items-center justify-center shrink-0 pointer-events-none ${isListMode ? 'text-sm px-3 py-1 ml-2' : 'text-xs px-2 py-0.5'} ${isModifier ? 'bg-white/30' : 'bg-black/20'}`}
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
