
import React from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../../types';
import { calculateColumnScore, getAutoColumnError } from '../../../utils/scoring';
import TexturedScoreCell from './TexturedScoreCell';
import { Link2Off, AlertTriangle } from 'lucide-react';

interface ScoreCellProps {
  player: Player;
  playerIndex: number; 
  column: ScoreColumn;
  allColumns?: ScoreColumn[];
  allPlayers?: Player[];
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  forceHeight?: string;
  screenshotMode?: boolean;
  simpleMode?: boolean; 
  baseImage?: string; 
  isEditMode?: boolean; 
  limitX?: number;
  isAlt?: boolean; // New prop for Zebra Striping
}

interface CellContentProps {
    parts: number[];
    displayScore: number;
    hasInput: boolean;
    column: ScoreColumn;
    simpleMode: boolean;
    textStyle: React.CSSProperties;
    forceHeight?: string;
    screenshotMode?: boolean;
    autoError?: 'missing_dependency' | 'math_error' | null;
}

// --- Helpers ---
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};

// --- Sub-Components (Renderers) ---

const CellContentAuto: React.FC<CellContentProps> = ({ displayScore, forceHeight, autoError, textStyle }) => (
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

const CellContentSelect: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, screenshotMode, textStyle }) => {
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
};

const CellContentProduct: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, screenshotMode, textStyle }) => {
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
};

const CellContentSum: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, textStyle }) => {
    const showPartsSetting = column.showPartsInGrid ?? true;
    
    // Priority 1: Force Simple Mode (Total Only)
    // Triggered if: 
    // - View is in Simple Mode (simpleMode prop)
    // - OR Column is configured as Simple (showPartsInGrid === false)
    // - OR No parts to show
    if (simpleMode || showPartsSetting === false || parts.length === 0) {
        return (
            <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                {hasInput ? formatDisplayNumber(displayScore) : ''}
            </span>
        );
    }

    // Priority 2: "Parts Only" Mode (List Only)
    if (showPartsSetting === 'parts_only') {
        if (hasInput && parts.length > 0) {
            const fontSizeClass = parts.length > 3 ? 'text-sm' : 'text-xl';
            return (
                <div className="w-full h-full flex flex-col justify-center items-center overflow-hidden py-0.5">
                    {parts.map((part, i) => (
                        <div key={i} className={`${fontSizeClass} font-bold font-mono leading-tight truncate w-full text-center`}>
                            <span style={textStyle}>{formatDisplayNumber(part)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}></span>;
    }

    // Priority 3: Standard Mode (Split View: Total + List)
    return (
        <div className="w-full h-full flex flex-row items-stretch overflow-hidden">
            <div className="flex-1 flex justify-center items-center min-w-0">
                <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-0.5 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                    {hasInput ? formatDisplayNumber(displayScore) : ''}
                </span>
            </div>
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
        </div>
    );
};

const CellContentStandard: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, textStyle }) => {
    const rawVal = parts[0];
    
    const showRawValHint = displayScore !== rawVal;
    const hasUnit = !!column.unit;
    const shouldShowBottomRight = !simpleMode && hasInput && (showRawValHint || hasUnit);

    return (
      <>
        <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
          {hasInput ? formatDisplayNumber(displayScore) : ''}
        </span>
    
        {shouldShowBottomRight && (
            <span className="absolute bottom-1 right-1 text-sm font-mono flex items-baseline max-w-full px-1">
                <span className="text-emerald-400 font-bold truncate">{formatDisplayNumber(rawVal)}</span>
                {hasUnit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
            </span>
        )}
      </>
    );
};

// --- Main Component ---

const ScoreCell: React.FC<ScoreCellProps> = (props) => {
  const { player, playerIndex, column, allColumns, allPlayers, isActive, onClick, forceHeight, screenshotMode = false, baseImage, isEditMode, limitX, isAlt } = props;
  const scoreData: ScoreValue | undefined = player.scores[column.id];
  
  // Strategy: Switch to Textured Cell if baseImage exists
  if (baseImage && column.visuals?.cellRect) {
      return <TexturedScoreCell {...props} scoreValue={scoreData} baseImage={baseImage} rect={column.visuals.cellRect} minHeight={screenshotMode ? '100%' : '3rem'} />;
  }

  // --- Data Preparation ---
  const parts = scoreData?.parts || [];
  const scoringContext = allColumns ? { allColumns, playerScores: player.scores, allPlayers } : undefined;
  const displayScore = calculateColumnScore(column, parts, scoringContext);
  const autoError = getAutoColumnError(column, scoringContext);
  const hasInput = column.isAuto ? true : parts.length > 0;
  const hasLayout = !!column.contentLayout && !!baseImage;

  // --- Visuals ---
  const minHeightClass = screenshotMode ? '' : (baseImage ? 'min-h-[3rem]' : 'min-h-[4rem]');
  const borderStructureClasses = baseImage ? '' : 'border-r border-b';
  const cursorClass = hasLayout ? 'cursor-default' : 'cursor-pointer';
  const pointerEventsClass = hasLayout ? 'pointer-events-none' : '';
  const baseContainerClasses = `player-col-${player.id} w-full h-full ${forceHeight || ''} ${borderStructureClasses} relative ${cursorClass} ${pointerEventsClass} transition-colors select-none flex flex-col justify-center items-center overflow-hidden`;
  
  const isStandardAuto = !baseImage && column.isAuto;
  let visualClasses = '';

  if (screenshotMode) {
      if (baseImage) visualClasses = `bg-transparent h-full`;
      else if (isStandardAuto) visualClasses = `bg-indigo-900/20 border-indigo-500/30 h-full`;
      else {
          // Standard Screenshot Cell: Apply zebra striping if needed
          const bg = isAlt ? 'bg-slate-800/50' : 'bg-transparent';
          visualClasses = `${bg} border-slate-700 h-full`;
      }
  } else {
      let bgClass = 'bg-slate-900 hover:bg-slate-800';
      
      // Zebra Striping Logic (Slightly Lighter Black)
      // INCREASED VISIBILITY: Changed opacity from /20 to /50 to make it more obvious
      if (!baseImage && !isStandardAuto && isAlt) {
          bgClass = 'bg-slate-800/50 hover:bg-slate-700'; 
      }

      let borderClass = baseImage ? 'border-transparent' : 'border-slate-800';
      if (isStandardAuto) {
          bgClass = 'bg-indigo-900/20 hover:bg-indigo-900/30';
          borderClass = 'border-indigo-500/30';
      }
      if (isActive && !hasLayout) {
          visualClasses = `${minHeightClass} ring-2 ring-inset ring-emerald-500 z-10 ${bgClass}`;
      } else {
          visualClasses = `${minHeightClass} ${bgClass} ${borderClass}`;
      }
  }

  const textStyle = {
      color: autoError ? '#f43f5e' : (hasInput ? (displayScore < 0 ? '#f87171' : '#ffffff') : '#475569'),
  };

  // --- Render Selection ---
  const renderContent = () => {
      const commonProps = { parts, displayScore, hasInput, column, simpleMode: props.simpleMode || false, forceHeight, screenshotMode, textStyle, autoError };

      if (column.isAuto) return <CellContentAuto {...commonProps} />;
      if (column.inputType === 'clicker' && !column.formula.includes('+next')) return <CellContentSelect {...commonProps} />;
      if (column.formula === 'a1×a2') return <CellContentProduct {...commonProps} />;
      if ((column.formula || '').includes('+next')) return <CellContentSum {...commonProps} />;
      
      return <CellContentStandard {...commonProps} />;
  };

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
    <div onClick={hasLayout ? undefined : onClick} className={`${baseContainerClasses} ${visualClasses}`}>
        {finalContent}
    </div>
  );
};

export default ScoreCell;
