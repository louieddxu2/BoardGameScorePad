
import React from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../types';
import { calculateColumnScore, getAutoColumnError } from '../../utils/scoring';
import TexturedScoreCell from './parts/TexturedScoreCell';
import { Link2Off, AlertTriangle } from 'lucide-react';

interface ScoreCellProps {
  player: Player;
  playerIndex: number; 
  column: ScoreColumn;
  allColumns?: ScoreColumn[]; // Added prop
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  forceHeight?: string;
  screenshotMode?: boolean;
  simpleMode?: boolean; 
  baseImage?: string; 
  isEditMode?: boolean; 
  limitX?: number; // New Prop for Right Bound limit
}

// Helper to correctly format numbers
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};

const ScoreCell: React.FC<ScoreCellProps> = ({ player, playerIndex, column, allColumns, isActive, onClick, forceHeight, screenshotMode = false, simpleMode = false, baseImage, isEditMode = false, limitX }) => {
  const scoreData: ScoreValue | undefined = player.scores[column.id];
  
  // --- Strategy Pattern: Switch to Textured Cell if data exists ---
  // [CRITICAL CHANGE]: Only use textured cell if baseImage is present
  if (baseImage && column.visuals?.cellRect) {
      return (
          <TexturedScoreCell 
            player={player}
            playerIndex={playerIndex}
            column={column}
            allColumns={allColumns} // Pass context down
            scoreValue={scoreData}
            baseImage={baseImage}
            rect={column.visuals.cellRect}
            onClick={onClick}
            isActive={isActive}
            minHeight={screenshotMode ? '100%' : '3rem'}
            simpleMode={simpleMode}
            isEditMode={isEditMode}
            limitX={limitX}
          />
      );
  }

  // --- Default Rendering Logic ---
  
  const parts = scoreData?.parts || [];
  
  // Context for Auto Calculation
  const scoringContext = allColumns ? {
      allColumns: allColumns,
      playerScores: player.scores
  } : undefined;

  const displayScore = calculateColumnScore(column, parts, scoringContext);
  const autoError = getAutoColumnError(column, scoringContext);
  
  // Determine if we should show input (Auto columns always show input if they have a result)
  const hasInput = column.isAuto ? true : parts.length > 0;
  
  // [CRITICAL CHANGE]: Only use custom layout for the MAIN cell if baseImage is present.
  // This ensures that when no image is loaded, the cell behaves like a standard list item
  // (filling width, auto height) instead of a fixed-position floating box.
  const hasLayout = !!column.contentLayout && !!baseImage;

  // Visual Styling
  const minHeightClass = screenshotMode ? '' : (baseImage ? 'min-h-[3rem]' : 'min-h-[4rem]');
  const borderStructureClasses = baseImage ? '' : 'border-r border-b';
  const cursorClass = hasLayout ? 'cursor-default' : 'cursor-pointer';
  // If hasLayout is true, we set pointer-events-none to the wrapper to let clicks pass through the "empty" areas
  const pointerEventsClass = hasLayout ? 'pointer-events-none' : '';
  const baseContainerClasses = `player-col-${player.id} w-full h-full ${forceHeight || ''} ${borderStructureClasses} relative ${cursorClass} ${pointerEventsClass} transition-colors select-none flex flex-col justify-center items-center overflow-hidden`;
  
  // 判斷是否為「標準模式下的自動計算格」
  const isStandardAuto = !baseImage && column.isAuto;
  
  let visualClasses = '';

  if (screenshotMode) {
      if (baseImage) {
          // Texture Mode: Keep transparent to show image
          visualClasses = `bg-transparent h-full`;
      } else {
          // Standard Grid Screenshot Mode
          if (isStandardAuto) {
              // WYSIWYG: Auto cells keep their tint and border in screenshot
              visualClasses = `bg-indigo-900/20 border-indigo-500/30 h-full`;
          } else {
              // Normal cells are transparent with slate border
              visualClasses = `bg-transparent border-slate-700 h-full`;
          }
      }
  } else {
      // Interactive Mode
      let bgClass = 'bg-slate-900 hover:bg-slate-800';
      let borderClass = baseImage ? 'border-transparent' : 'border-slate-800';
      
      if (isStandardAuto) {
          // Auto cells have distinct background and border
          bgClass = 'bg-indigo-900/20 hover:bg-indigo-900/30';
          borderClass = 'border-indigo-500/30';
      }

      // ONLY apply ring to the container if there is NO layout.
      // If there IS a layout, the ring goes on the inner box (finalContent).
      if (isActive && !hasLayout) {
          visualClasses = `${minHeightClass} ring-2 ring-inset ring-emerald-500 z-10 ${bgClass}`;
      } else {
          visualClasses = `${minHeightClass} ${bgClass} ${borderClass}`;
      }
  }

  const textStyle = {
      color: autoError ? '#f43f5e' : (hasInput ? (displayScore < 0 ? '#f87171' : '#ffffff') : '#475569'),
  };

  const renderContent = () => {
      // Auto Column (Special Display)
      if (column.isAuto) {
          return (
            <>
                {autoError && (
                    <div className="absolute top-1 left-1 text-rose-500 z-20" title={autoError === 'missing_dependency' ? "參照的欄位已遺失" : "計算錯誤 (如除以0)"}>
                        {autoError === 'missing_dependency' ? <Link2Off size={14} /> : <AlertTriangle size={14} />}
                    </div>
                )}
                <span className={`text-xl font-bold w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                    {autoError ? 'ERR' : formatDisplayNumber(displayScore)}
                </span>
            </>
          );
      }

      // Select/Options Render
      const isSelectList = column.inputType === 'clicker' && !column.formula.includes('+next');
      if (isSelectList) {
        const rawVal = parts[0];
        const option = column.quickActions?.find(opt => opt.value === rawVal);
        return (
          <>
             <span className={`text-xl font-bold w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                {hasInput ? formatDisplayNumber(displayScore) : ''}
             </span>
             {!simpleMode && option && (
                 <span className={`absolute bottom-1 right-1 text-xs font-medium px-1 rounded truncate max-w-[90%] ${screenshotMode ? 'text-emerald-400/80' : 'text-emerald-400 bg-slate-900/80 border border-slate-700'}`}>
                     {option.label}
                 </span>
             )}
          </>
        );
      }

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
            <>
              <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                {hasInput ? formatDisplayNumber(displayScore) : ''}
              </span>
              {!simpleMode && productUI}
            </>
          );
      }

      // Sum Parts Render
      if ((column.formula || '').includes('+next')) {
        const showParts = column.showPartsInGrid ?? true;
        if (showParts && parts.length > 0) {
            return (
                <div className="w-full h-full flex flex-row items-stretch overflow-hidden">
                    <div className="flex-1 flex justify-center items-center min-w-0">
                        <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-0.5 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                            {hasInput ? formatDisplayNumber(displayScore) : ''}
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
            );
        }
      }

      // Standard Render
      const rawVal = (column.formula || '').includes('+next') ? displayScore : parts[0];
      
      return (
        <>
          <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
            {hasInput ? formatDisplayNumber(displayScore) : ''}
          </span>
      
          {!simpleMode && hasInput && (
              <span className="absolute bottom-1 right-1 text-sm font-mono flex items-baseline max-w-full px-1">
                  <span className="text-emerald-400 font-bold truncate">{formatDisplayNumber(rawVal)}</span>
                  {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
              </span>
          )}
        </>
      );
  };

  // Only use layout if baseImage is present
  const finalContent = hasLayout ? (
      <div 
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`
            absolute flex items-center justify-center 
            ${!screenshotMode ? 'border-2 rounded-md cursor-pointer transition-all pointer-events-auto' : ''}
            ${!screenshotMode && isActive 
                ? 'border-emerald-500 bg-emerald-500/20 ring-1 ring-emerald-500' 
                : (!screenshotMode ? 'border-dashed border-white/20 hover:border-white/50 hover:bg-white/5' : '')
            }
        `}
        style={{
            left: `${column.contentLayout!.x}%`,
            top: `${column.contentLayout!.y}%`,
            width: `${column.contentLayout!.width}%`,
            height: `${column.contentLayout!.height}%`,
        }}
      >
          {column.isAuto && autoError && (
              <div className="absolute top-0 right-0 text-rose-500 z-20 translate-x-1/3 -translate-y-1/3 drop-shadow-md">
                  {autoError === 'missing_dependency' ? <Link2Off size={16} /> : <AlertTriangle size={16} />}
              </div>
          )}
          <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
            {hasInput ? (autoError ? 'ERR' : formatDisplayNumber(displayScore)) : ''}
          </span>
      </div>
  ) : renderContent();

  return (
    <div 
        onClick={hasLayout ? undefined : onClick} 
        className={`${baseContainerClasses} ${visualClasses}`}
    >
        {finalContent}
    </div>
  );
};

export default ScoreCell;
