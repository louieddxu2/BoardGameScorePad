
import React from 'react';
import { Player, ScoreColumn } from '../../types';
import { calculateColumnScore, getRawValue, getScoreHistory } from '../../utils/scoring';
import { Check } from 'lucide-react';

interface ScoreCellProps {
  player: Player;
  column: ScoreColumn;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const ScoreCell: React.FC<ScoreCellProps> = ({ player, column, isActive, onClick }) => {
  const rawData = player.scores[column.id];

  // Boolean Render
  if (column.type === 'boolean') {
    return (
      <div onClick={onClick} className={`min-w-[54px] flex-1 min-h-[4rem] border-r border-b border-slate-800 flex items-center justify-center cursor-pointer transition-colors ${isActive ? 'bg-emerald-900/30 ring-1 ring-inset ring-emerald-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
        {rawData ? <Check size={24} className="text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
      </div>
    );
  }

  // Determine display value (prefer string if user is typing "5.")
  let displayValue: string | number | undefined = undefined;
  if (rawData !== undefined && rawData !== null) {
      if (typeof rawData === 'object' && 'value' in rawData) {
          displayValue = rawData.value;
      } else {
          displayValue = rawData;
      }
  }

  const rawVal = getRawValue(rawData); // Numeric value for calculation
  const history = getScoreHistory(rawData);
  const displayScore = calculateColumnScore(column, rawData); // Calculated & Rounded Score

  // Select Render
  if (column.type === 'select') {
    const option = column.options?.find(opt => opt.value === rawVal);
    // Main Score: White (Positive/Zero), Red (Negative), Slate (Empty)
    const scoreColor = rawVal !== undefined 
        ? (displayScore < 0 ? 'text-red-400' : 'text-white') 
        : 'text-slate-600';

    return (
      <div onClick={onClick} className={`min-w-[54px] flex-1 min-h-[4rem] border-r border-b border-slate-800 flex flex-col items-center justify-center relative cursor-pointer transition-colors ${isActive ? 'bg-emerald-900/30 ring-1 ring-inset ring-emerald-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
         <span className={`text-xl font-bold ${scoreColor}`}>
            {rawVal !== undefined ? displayScore : '-'}
         </span>
         {option && (
             <span className="absolute bottom-1 right-1 text-[9px] text-slate-500 font-medium bg-slate-900/80 px-1 rounded border border-slate-700 truncate max-w-[90%]">
                 {option.label}
             </span>
         )}
      </div>
    );
  }

  // Number / Mapped Number / Product Render
  let unitText = column.unit || '';
  // Mapped check handled by logic inside, but UI is consistent for number types now

  // Check for Product Factors
  let productUI = null;
  if (column.calculationType === 'product' && rawData && typeof rawData === 'object' && rawData.factors) {
      const [a, b] = rawData.factors;
      const ua = column.subUnits?.[0] || '';
      const ub = column.subUnits?.[1] || '';
      
      productUI = (
        <span className="absolute bottom-1 right-1 flex items-baseline bg-slate-900/80 px-1 rounded border border-slate-800/50 max-w-full overflow-hidden">
             <span className="text-[11px] font-bold font-mono text-indigo-300 leading-none">{a}</span>
             <span className="text-[8px] text-slate-500 ml-[1px] leading-none">{ua}</span>
             <span className="text-[9px] text-slate-600 mx-[2px] leading-none">×</span>
             <span className="text-[11px] font-bold font-mono text-indigo-300 leading-none">{b}</span>
             <span className="text-[8px] text-slate-500 ml-[1px] leading-none">{ub}</span>
        </span>
      );
  }

  // Main Score Color Logic for Numbers
  const mainScoreColor = rawVal !== undefined 
      ? (displayScore < 0 ? 'text-red-400' : 'text-white') 
      : 'text-slate-600';

  return (
    <div onClick={onClick} className={`min-w-[54px] flex-1 min-h-[4rem] border-r border-b border-slate-800 flex items-center justify-between px-1 relative cursor-pointer select-none transition-colors ${isActive ? 'bg-emerald-900/30 ring-1 ring-inset ring-emerald-500' : 'bg-slate-900 hover:bg-slate-800'}`}>
        <span className={`flex-1 text-center text-xl font-bold tracking-tight ${mainScoreColor}`}>
            {displayValue !== undefined ? displayScore : '-'}
        </span>
        
        {/* History Stack on the right (Only if NOT product mode) */}
        {!productUI && history.length > 1 && (
            <div className="flex flex-col items-end text-[8px] text-slate-500 leading-tight font-mono opacity-60 ml-1 border-l border-slate-700 pl-1 max-h-full overflow-hidden">
                {history.slice(-3).map((op, i) => <span key={i}>{op}</span>)}
            </div>
        )}

        {/* Info Text (Unit or Mapped Source or Product Equation) */}
        {rawVal !== undefined && (
            productUI ? productUI : (
                <span className="absolute bottom-1 right-1 text-[10px] font-mono flex items-baseline">
                   <span className="text-emerald-400 font-bold">{displayValue}</span>
                   {unitText && <span className="text-slate-500 text-[8px] ml-0.5">{unitText}</span>}
                </span>
            )
        )}
    </div>
  );
};

export default ScoreCell;
