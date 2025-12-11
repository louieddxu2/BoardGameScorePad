import React from 'react';
import { Player, ScoreColumn } from '../../types';
import { calculateColumnScore, getRawValue, getScoreHistory } from '../../utils/scoring';
import { Check } from 'lucide-react';

interface ScoreCellProps {
  player: Player;
  column: ScoreColumn;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  forceHeight?: string;
  screenshotMode?: boolean;
}

const ScoreCell: React.FC<ScoreCellProps> = ({ player, column, isActive, onClick, forceHeight, screenshotMode = false }) => {
  const rawData = player.scores[column.id];

  // Common styles to ensure layout match between live and screenshot
  // We keep border width (border-r, border-b) but make color transparent in screenshot text-only mode
  // so the layout size remains exactly 100% identical.
  const baseContainerClasses = `min-w-[54px] flex-1 ${forceHeight || 'min-h-[4rem]'} border-r border-b relative cursor-pointer transition-colors select-none flex justify-center items-center`;
  
  // Determine Visual Style (Colors)
  let visualClasses = '';
  if (screenshotMode) {
      // In screenshot mode (Text Only), everything is transparent except the text content
      visualClasses = 'bg-transparent border-transparent';
  } else {
      // Live Mode
      visualClasses = isActive 
        ? 'bg-emerald-900/30 ring-1 ring-inset ring-emerald-500 border-slate-800' 
        : 'bg-slate-900 hover:bg-slate-800 border-slate-800';
  }

  // Boolean Render
  if (column.type === 'boolean') {
    return (
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`}>
        {rawData ? <Check size={24} className="text-emerald-500" /> : <div className={`w-2 h-2 rounded-full ${screenshotMode ? 'bg-slate-700/50' : 'bg-slate-700'}`} />}
      </div>
    );
  }

  // Determine display value
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
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses} flex-col`}>
         <span className={`text-xl font-bold ${scoreColor} ${forceHeight ? 'leading-none' : ''}`}>
            {rawVal !== undefined ? displayScore : '-'}
         </span>
         {option && (
             <span className={`absolute bottom-1 right-1 text-xs font-medium px-1 rounded truncate max-w-[90%] ${screenshotMode ? 'text-emerald-400 border border-transparent' : 'text-emerald-400 bg-slate-900/80 border border-slate-700'}`}>
                 {option.label}
             </span>
         )}
      </div>
    );
  }

  // Number / Mapped Number / Product / Sum Parts Render
  const isSumPartsMode = column.calculationType === 'sum-parts';
  const mainScoreColor = rawVal !== undefined 
      ? (displayScore < 0 ? 'text-red-400' : 'text-white') 
      : 'text-slate-600';
      
  // Check for Product Factors
  let productUI = null;
  if (column.calculationType === 'product' && rawData && typeof rawData === 'object' && rawData.factors) {
      const [a, b] = rawData.factors;
      const ua = column.subUnits?.[0] || '';
      const ub = column.subUnits?.[1] || '';
      
      productUI = (
        <span className={`absolute bottom-1 right-1 flex items-baseline px-1 rounded max-w-full overflow-hidden ${screenshotMode ? 'border-transparent' : 'bg-slate-900/80 border border-slate-800/50'}`}>
             <span className="text-sm font-bold font-mono text-emerald-400 leading-none">{a}</span>
             <span className="text-xs text-emerald-400 ml-[1px] leading-none">{ua}</span>
             <span className="text-sm text-slate-600 mx-[2px] leading-none">×</span>
             <span className="text-sm font-bold font-mono text-emerald-400 leading-none">{b}</span>
             <span className="text-xs text-emerald-400 ml-[1px] leading-none">{ub}</span>
        </span>
      );
  }

  const showAdvancedSumPartsLayout = isSumPartsMode && history.length > 0;

  // Dynamic Row Height Logic for Sum Parts
  if (showAdvancedSumPartsLayout) {
    return (
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses} flex-row !items-stretch`}>
        {/* Left side: Total Score. Takes up remaining space and centers its content. */}
        <div className="flex-1 flex justify-center items-center">
          <span className={`text-xl font-bold tracking-tight ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
            {displayValue !== undefined ? displayScore : '-'}
          </span>
        </div>
  
        {/* Right side: Parts List. Takes up its own content width, aligns its content to the bottom. */}
        <div className="flex flex-col justify-end pb-1 pr-1">
          <div className="flex flex-col items-end font-mono leading-tight">
            {history.map((part, i) => (
              <div key={i} className="flex items-baseline text-sm">
                <span className="text-emerald-400 font-bold">{part}</span>
                {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5">{column.unit}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Standard Render for everything else
  return (
    <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`}>
      
      {/* Centered Main Score */}
      <span className={`text-xl font-bold tracking-tight ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
        {displayValue !== undefined ? displayScore : '-'}
      </span>
  
      {/* Bottom Right Info */}
      {rawVal !== undefined && (
        productUI ? (
          productUI
        ) : (
          // Standard Mode (or Sum Parts with 0 entries, which is the initial state)
          <span className="absolute bottom-1 right-1 text-sm font-mono flex items-baseline">
              <span className="text-emerald-400 font-bold">{String(displayValue)}</span>
              {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5">{column.unit}</span>}
          </span>
        )
      )}

    </div>
  );
};

export default ScoreCell;