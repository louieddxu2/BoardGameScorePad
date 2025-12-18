
import React from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../types';
import { calculateColumnScore } from '../../utils/scoring';
import { Check } from 'lucide-react';

interface ScoreCellProps {
  player: Player;
  column: ScoreColumn;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  forceHeight?: string;
  screenshotMode?: boolean;
  simpleMode?: boolean; // New prop for simplified screenshot view
}

// Helper to correctly format numbers for display, especially handling -0
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};

const ScoreCell: React.FC<ScoreCellProps> = ({ player, column, isActive, onClick, forceHeight, screenshotMode = false, simpleMode = false }) => {
  const scoreData: ScoreValue | undefined = player.scores[column.id];
  const parts = scoreData?.parts || [];

  const baseContainerClasses = `player-col-${player.id} w-full ${forceHeight || ''} border-r border-b relative cursor-pointer transition-colors select-none flex flex-col justify-center items-center overflow-hidden`;
  
  let visualClasses = '';
  if (screenshotMode) {
      visualClasses = 'bg-transparent border-slate-700 h-full';
  } else {
      visualClasses = `min-h-[4rem] ${isActive 
        ? 'bg-emerald-900/30 ring-1 ring-inset ring-emerald-500 border-slate-800' 
        : 'bg-slate-900 hover:bg-slate-800 border-slate-800'}`;
  }

  const displayScore = calculateColumnScore(column, parts);
  const hasInput = parts.length > 0;

  // Select/Options Render (Now driven by inputType and formula)
  const isSelectList = column.inputType === 'clicker' && !column.formula.includes('+next');
  if (isSelectList) {
    const rawVal = parts[0];
    const option = column.quickActions?.find(opt => opt.value === rawVal);
    const scoreColor = hasInput ? (displayScore < 0 ? 'text-red-400' : 'text-white') : 'text-slate-600';

    return (
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`}>
         <span className={`text-xl font-bold w-full text-center truncate px-1 ${scoreColor} ${forceHeight ? 'leading-none' : ''}`}>
            {hasInput ? formatDisplayNumber(displayScore) : '-'}
         </span>
         {!simpleMode && option && (
             <span className={`absolute bottom-1 right-1 text-xs font-medium px-1 rounded truncate max-w-[90%] ${screenshotMode ? 'text-emerald-400/80' : 'text-emerald-400 bg-slate-900/80 border border-slate-700'}`}>
                 {option.label}
             </span>
         )}
      </div>
    );
  }

  const mainScoreColor = hasInput ? (displayScore < 0 ? 'text-red-400' : 'text-white') : 'text-slate-600';
      
  // Product Render
  if (column.formula === 'a1×a2') {
      const [a, b] = parts;
      const ua = column.subUnits?.[0] || '';
      const ub = column.subUnits?.[1] || '';
      
      const productUI = hasInput ? (
        <span className={`absolute bottom-1 right-1 flex items-baseline px-1 rounded max-w-full overflow-hidden ${screenshotMode ? '' : 'bg-slate-900/80 border border-slate-800/50'}`}>
             <span className="text-sm font-bold font-mono text-emerald-400 leading-none truncate">{formatDisplayNumber(a)}</span>
             <span className="text-xs text-emerald-400/80 ml-[1px] leading-none">{ua}</span>
             <span className="text-sm text-slate-600 mx-[2px] leading-none">×</span>
             <span className="text-sm font-bold font-mono text-emerald-400 leading-none truncate">{formatDisplayNumber(b ?? 1)}</span>
             <span className="text-xs text-emerald-400/80 ml-[1px] leading-none">{ub}</span>
        </span>
      ) : null;
      
      return (
        <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`}>
          <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
            {hasInput ? formatDisplayNumber(displayScore) : '-'}
          </span>
          {!simpleMode && productUI}
        </div>
      );
  }

  // Sum Parts Render
  if ((column.formula || '').includes('+next')) {
    const showParts = column.showPartsInGrid ?? true;
    if (showParts && parts.length > 0) {
        return (
          <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`}>
            <div className="w-full h-full flex flex-row items-stretch overflow-hidden">
                <div className="flex-1 flex justify-center items-center min-w-0">
                    <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-0.5 ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
                        {hasInput ? formatDisplayNumber(displayScore) : '-'}
                    </span>
                </div>
                {!simpleMode && (
                  <div className="flex flex-col justify-end pb-1 pr-1 max-w-[50%]">
                      <div className="flex flex-col items-end font-mono leading-tight">
                          {parts.map((part, i) => (
                          <div key={i} className="flex items-baseline text-sm max-w-full">
                              <span className="text-emerald-400 font-bold truncate">{formatDisplayNumber(part)}</span>
                              {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
                          </div>
                          ))}
                      </div>
                  </div>
                )}
            </div>
          </div>
        );
    }
  }

  // Standard Render (a1, a1×c1, f1(a1)) and fall-through for sum-parts with showPartsInGrid:false
  const rawVal = (column.formula || '').includes('+next') ? displayScore : parts[0];
  
  return (
    <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`}>
      <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
        {hasInput ? formatDisplayNumber(displayScore) : '-'}
      </span>
  
      {!simpleMode && hasInput && (
          <span className="absolute bottom-1 right-1 text-sm font-mono flex items-baseline max-w-full px-1">
              <span className="text-emerald-400 font-bold truncate">{formatDisplayNumber(rawVal)}</span>
              {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
          </span>
      )}
    </div>
  );
};

export default ScoreCell;
