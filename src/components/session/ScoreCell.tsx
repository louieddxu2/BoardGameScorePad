
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

  // 關鍵修改：
  // 1. 移除 flex-auto, flex-1
  // 2. 加入 flex-none (禁止彈性)
  // 3. 加入 player-col-${player.id} 供 JS Hook 抓取並設定寬度
  // 4. 預設 style={{ width: 54 }} 作為初始值 (Hook 執行後會覆蓋)
  const baseContainerClasses = `player-col-${player.id} flex-none ${forceHeight || 'min-h-[4rem]'} border-r border-b relative cursor-pointer transition-colors select-none flex flex-col justify-center items-center overflow-hidden`;
  
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
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`} style={{ width: '54px' }}>
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
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`} style={{ width: '54px' }}>
         {/* Added w-full, text-center, truncate */}
         <span className={`text-xl font-bold w-full text-center truncate px-1 ${scoreColor} ${forceHeight ? 'leading-none' : ''}`}>
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
             <span className="text-sm font-bold font-mono text-emerald-400 leading-none truncate">{a}</span>
             <span className="text-xs text-emerald-400 ml-[1px] leading-none">{ua}</span>
             <span className="text-sm text-slate-600 mx-[2px] leading-none">×</span>
             <span className="text-sm font-bold font-mono text-emerald-400 leading-none truncate">{b}</span>
             <span className="text-xs text-emerald-400 ml-[1px] leading-none">{ub}</span>
        </span>
      );
  }

  // Allow disabling the list view for Sum Parts via config
  const showParts = column.showPartsInGrid ?? true;
  const showAdvancedSumPartsLayout = isSumPartsMode && history.length > 0 && showParts;

  // Dynamic Row Height Logic for Sum Parts (List View)
  if (showAdvancedSumPartsLayout) {
    return (
      <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`} style={{ width: '54px' }}>
        
        <div className="w-full h-full flex flex-row items-stretch overflow-hidden">
            {/* Left side: Total Score. */}
            <div className="flex-1 flex justify-center items-center min-w-0">
                <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-0.5 ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
                    {displayValue !== undefined ? displayScore : '-'}
                </span>
            </div>
    
            {/* Right side: Parts List. */}
            <div className="flex flex-col justify-end pb-1 pr-1 max-w-[50%]">
                <div className="flex flex-col items-end font-mono leading-tight">
                    {history.map((part, i) => (
                    <div key={i} className="flex items-baseline text-sm max-w-full">
                        <span className="text-emerald-400 font-bold truncate">{part}</span>
                        {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
                    </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // Standard Render
  return (
    <div onClick={onClick} className={`${baseContainerClasses} ${visualClasses}`} style={{ width: '54px' }}>
      
      {/* Centered Main Score - Added truncate/w-full */}
      <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${mainScoreColor} ${forceHeight ? 'leading-none' : ''}`}>
        {displayValue !== undefined ? displayScore : '-'}
      </span>
  
      {/* Bottom Right Info */}
      {rawVal !== undefined && (
        productUI ? (
          productUI
        ) : (
          // Standard Mode (or Sum Parts with 0 entries, or Sum Parts in Total Only mode)
          <span className="absolute bottom-1 right-1 text-sm font-mono flex items-baseline max-w-full px-1">
              <span className="text-emerald-400 font-bold truncate">{String(displayValue)}</span>
              {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
          </span>
        )
      )}

    </div>
  );
};

export default ScoreCell;
