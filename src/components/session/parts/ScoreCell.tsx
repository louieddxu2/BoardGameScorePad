
import React, { useRef, useEffect } from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../../types';
import { calculateColumnScore, getAutoColumnError, getRawValue } from '../../../utils/scoring';
import TexturedScoreCell from './TexturedScoreCell';
import { Link2Off, AlertTriangle } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';

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
  isAlt?: boolean; 
  previewValue?: any; // New prop for ghost input
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
    previewValue?: any;
}

// --- Helpers ---
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};

// Return type now includes a React Node for flexible rendering (e.g., A x B)
const getPreviewInfo = (previewValue: any, column: ScoreColumn): { val: number | null, labelNode: React.ReactNode | null } => {
    if (!previewValue) return { val: null, labelNode: null };
    
    // Product Sum Parts: { factors: [A, B] }
    if (column.formula.includes('×a2')) {
        if (typeof previewValue === 'object' && previewValue.factors) {
            const f1 = parseFloat(String(previewValue.factors[0])) || 0;
            // Parse f2 correctly, default to 0 if NaN (though InputPanel typically inits to 1)
            const f2Raw = parseFloat(String(previewValue.factors[1]));
            const f2 = isNaN(f2Raw) ? 0 : f2Raw;
            
            // Show preview if any interaction happened (one of them is non-zero, or both entered)
            if (f1 !== 0 || f2 !== 0) {
                 const product = f1 * f2;
                 const ua = column.subUnits?.[0] || '';
                 const ub = column.subUnits?.[1] || '';
                 
                 // Construct A x B label using inline-flex to prevent wrapping issues
                 const labelNode = (
                    <span className="inline-flex items-baseline justify-end gap-[2px] whitespace-nowrap">
                        <span>{formatDisplayNumber(f1)}</span>
                        <span className="text-[10px] opacity-80">{ua}</span>
                        <span className="mx-0.5 text-xs opacity-70">×</span>
                        <span>{formatDisplayNumber(f2)}</span>
                        <span className="text-[10px] opacity-80">{ub}</span>
                    </span>
                 );

                 return { val: product, labelNode };
            }
        }
        return { val: null, labelNode: null };
    }
    
    // Standard Sum Parts
    const rawVal = getRawValue(previewValue);
    if (rawVal !== 0) {
        const constant = column.constants?.c1 ?? 1;
        const finalVal = rawVal * constant;
        
        const labelNode = (
            <span className="inline-flex items-baseline justify-end whitespace-nowrap">
                {formatDisplayNumber(finalVal)}
                {column.unit && <span className="text-[10px] ml-0.5 not-italic opacity-80">{column.unit}</span>}
            </span>
        );
        
        return { val: finalVal, labelNode };
    }
    
    return { val: null, labelNode: null };
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
    const renderMode = column.renderMode || 'standard';
    
    const labelColor = option?.color || column.color || (screenshotMode ? '#10b981' : '#34d399');
    // If the label color is dark, apply a white halo/shadow to make it readable on dark background
    const labelStyle: React.CSSProperties = {
        color: labelColor,
        textShadow: isColorDark(labelColor) ? ENHANCED_TEXT_SHADOW : undefined,
    };

    // Label Only Mode: Show Label in Center
    if (renderMode === 'label_only' && option) {
        return (
            <div className="w-full h-full flex items-center justify-center p-1">
                <span 
                    className={`text-lg font-bold text-center leading-tight whitespace-pre-wrap break-words w-full ${forceHeight ? 'max-h-full overflow-hidden' : ''}`} 
                    style={labelStyle}
                >
                    {option.label}
                </span>
            </div>
        );
    }

    // Standard & Value Only: Show Score in Center
    return (
        <>
            <span className={`text-xl font-bold w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
            {hasInput ? formatDisplayNumber(displayScore) : ''}
            </span>
            
            {/* Standard Mode: Show Label in Bottom Right */}
            {renderMode === 'standard' && !simpleMode && option && (
                <span 
                    className="absolute bottom-1 right-1 text-[10px] font-bold px-1 text-right max-w-[90%] whitespace-pre-wrap leading-tight"
                    style={labelStyle}
                >
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

const CellContentSum: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, textStyle, previewValue }) => {
    const showPartsSetting = column.showPartsInGrid ?? true;
    const preview = getPreviewInfo(previewValue, column);
    const hasPreview = preview.val !== null;

    // --- Anti-Flicker Logic ---
    // We track the previous state to detect the "Gap" frame where preview is cleared 
    // but the parts list hasn't updated yet.
    const prevHasPreview = useRef(hasPreview);
    const prevPartsLen = useRef(parts.length);
    
    // Detect if we are in the "Gap" frame:
    // 1. We currently have NO preview (!hasPreview)
    // 2. But we DID have a preview in the last render (prevHasPreview.current)
    // 3. AND the parts list length hasn't changed yet (parts.length === prevPartsLen.current)
    // If all true, it means we just committed, but the new part hasn't arrived. 
    // We should keep the spacer to prevent height collapse.
    const isGap = !hasPreview && prevHasPreview.current && parts.length === prevPartsLen.current;
    
    // Update refs after render
    useEffect(() => {
        prevHasPreview.current = hasPreview;
        prevPartsLen.current = parts.length;
    });

    const shouldReserveSpace = hasPreview || isGap;
    // ---------------------------

    // Use Absolute Preview Layout (Centered Total + Corner Ghost) if:
    // 1. Simple Mode is forced
    // 2. Column is configured to hide parts
    
    // Priority 1: Simple Mode (Total Only)
    if (simpleMode || showPartsSetting === false) {
         return (
            <div className="relative w-full h-full flex items-center justify-center">
                <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                    {hasInput ? formatDisplayNumber(displayScore) : ''}
                </span>
                {hasPreview && (
                    <span className="absolute bottom-1 right-1 text-sm font-bold text-amber-400 italic animate-pulse whitespace-nowrap">
                        {preview.labelNode}
                    </span>
                )}
            </div>
         );
    }

    // Priority 2: "Parts Only" Mode (List Only)
    if (showPartsSetting === 'parts_only') {
        const allParts = hasPreview ? [...parts, preview.val!] : parts;
        const fontSizeClass = allParts.length > 3 ? 'text-sm' : 'text-xl';
        return (
            <div className="w-full h-full flex flex-col justify-center items-center overflow-hidden py-0.5 relative">
                {parts.map((part, i) => (
                    <div key={i} className={`${fontSizeClass} font-bold font-mono leading-tight truncate w-full text-center`}>
                        <span style={textStyle}>{formatDisplayNumber(part)}</span>
                    </div>
                ))}
                {hasPreview && (
                    <div className={`${fontSizeClass} font-bold font-mono leading-tight w-full text-center flex justify-center`}>
                        <span className="text-amber-400 italic animate-pulse whitespace-nowrap">
                            {preview.labelNode}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // Priority 3: Standard Mode (Split View: Total + List)
    return (
        <div className="relative w-full h-full">
            <div className="w-full h-full flex flex-row items-stretch overflow-hidden">
                <div className="flex-1 flex justify-center items-center min-w-0">
                    <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-0.5 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                        {hasInput ? formatDisplayNumber(displayScore) : ''}
                    </span>
                </div>
                {/* Right Column: Only rendered if there are parts or if we need to reserve space */}
                {(parts.length > 0 || shouldReserveSpace) && (
                    <div className="flex flex-col justify-end pb-1 pr-1 max-w-[50%]">
                        <div className="flex flex-col items-end font-mono leading-tight">
                            {parts.map((part, i) => (
                                <div key={i} className="flex items-baseline text-sm max-w-full justify-end">
                                    <span className="text-emerald-400 font-bold truncate">{formatDisplayNumber(part)}</span>
                                    {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
                                </div>
                            ))}
                            {/* Invisible Spacer: reserves VERTICAL height for the preview */}
                            {shouldReserveSpace && (
                                <div className="h-[1.25rem] w-0"></div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Absolute Preview Overlay */}
            {hasPreview && (
                <div className="absolute bottom-1 right-1 pointer-events-none">
                    <span className="text-amber-400 font-bold italic animate-pulse text-sm whitespace-nowrap">
                        {preview.labelNode}
                    </span>
                </div>
            )}
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
  const { player, playerIndex, column, allColumns, allPlayers, isActive, onClick, forceHeight, screenshotMode = false, baseImage, isEditMode, limitX, isAlt, previewValue } = props;
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
      const commonProps = { parts, displayScore, hasInput, column, simpleMode: props.simpleMode || false, forceHeight, screenshotMode, textStyle, autoError, previewValue };

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

export default React.memo(ScoreCell);
