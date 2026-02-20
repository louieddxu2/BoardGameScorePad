
import React, { useRef, useEffect } from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../../types';
import { calculateColumnScore, getAutoColumnError, resolveSelectOption } from '../../../utils/scoring';
import TexturedScoreCell from './TexturedScoreCell';
import { Link2Off, AlertTriangle } from 'lucide-react';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { calculateDynamicFontSize } from '../../../utils/dynamicLayout';
import { 
    formatDisplayNumber, 
    getRawInputString, 
    getProductInputStrings, 
    getGhostPreview 
} from '../../../utils/scoreDisplay';

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
  previewValue?: any; 
  skipTextureRendering?: boolean; 
}

interface CellContentProps {
    parts: number[];
    scoreValue?: ScoreValue; 
    displayScore: number;
    hasInput: boolean;
    column: ScoreColumn;
    simpleMode: boolean;
    textStyle: React.CSSProperties;
    forceHeight?: string;
    screenshotMode?: boolean;
    autoError?: 'missing_dependency' | 'math_error' | null;
    previewValue?: any;
    isActive?: boolean;
}

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

const CellContentSelect: React.FC<CellContentProps> = ({ parts, scoreValue, displayScore, hasInput, column, simpleMode, forceHeight, screenshotMode, textStyle }) => {
    // Use centralized resolver
    const option = resolveSelectOption(column, scoreValue);
    const renderMode = column.renderMode || 'standard';
    
    const labelColor = option?.color || column.color || (screenshotMode ? '#10b981' : '#34d399');
    const labelStyle: React.CSSProperties = {
        color: labelColor,
        textShadow: isColorDark(labelColor) ? ENHANCED_TEXT_SHADOW : undefined,
    };

    // Label Only Mode
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

    // Standard & Value Only
    return (
        <>
            <span className={`text-xl font-bold w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
            {hasInput ? formatDisplayNumber(displayScore) : ''}
            </span>
            
            {/* Standard Mode Label */}
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

const CellContentProduct: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, screenshotMode, textStyle, previewValue, isActive }) => {
    // [Refactor] Use utility to resolve display strings (handles "5." and "-0")
    const [displayA, displayB] = getProductInputStrings(previewValue, !!isActive, parts);

    const ua = column.subUnits?.[0] || '';
    const ub = column.subUnits?.[1] || '';
    
    const productUI = hasInput ? (
      <span className={`absolute bottom-1 right-1 flex items-baseline px-1 rounded max-w-full overflow-hidden ${screenshotMode ? '' : 'bg-slate-900/80 border border-slate-800/50'}`}>
           <span className="text-sm font-bold font-mono text-emerald-400 leading-none truncate">{displayA}</span>
           <span className="text-xs text-emerald-400/80 ml-[1px] leading-none">{ua}</span>
           <span className="text-sm text-slate-600 mx-[2px] leading-none">×</span>
           <span className="text-sm font-bold font-mono text-emerald-400 leading-none truncate">{displayB}</span>
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
    
    // [Refactor] Use utility to get ghost preview
    const preview = getGhostPreview(previewValue, column);
    const hasPreview = preview.val !== null;

    // --- Anti-Flicker Logic (Preserved) ---
    const prevHasPreview = useRef(hasPreview);
    const prevPartsLen = useRef(parts.length);
    const isGap = !hasPreview && prevHasPreview.current && parts.length === prevPartsLen.current;
    
    useEffect(() => {
        prevHasPreview.current = hasPreview;
        prevPartsLen.current = parts.length;
    });

    const shouldReserveSpace = hasPreview || isGap;
    // ---------------------------

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
        const fontSizeClass = 'text-xl';
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
                {/* Right Column: Parts List */}
                {(parts.length > 0 || shouldReserveSpace) && (
                    <div className="flex flex-col justify-end pb-1 pr-1 max-w-[50%]">
                        <div className="flex flex-col items-end font-mono leading-tight">
                            {parts.map((part, i) => (
                                <div key={i} className="flex items-baseline text-sm max-w-full justify-end">
                                    <span className="text-emerald-400 font-bold truncate">{formatDisplayNumber(part)}</span>
                                    {column.unit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
                                </div>
                            ))}
                            {/* Invisible Spacer */}
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

const CellContentStandard: React.FC<CellContentProps> = ({ parts, displayScore, hasInput, column, simpleMode, forceHeight, textStyle, previewValue, isActive }) => {
    const rawVal = parts[0];
    const computedStr = formatDisplayNumber(displayScore);
    const hasUnit = !!column.unit;

    // [Refactor] Use utility to get raw input string (handles active state, "5.", "-0")
    // If not active or empty, fall back to formatted saved value
    const displayRawStr = getRawInputString(previewValue, !!isActive) ?? formatDisplayNumber(rawVal);
    
    // Check if user is actively typing (isActive is sufficient proxy here combined with result)
    const isTyping = !!isActive;

    const showRawValHint = displayScore !== rawVal; // For non-active state (saved value check)
    
    // Show condition:
    // 1. Not Simple Mode
    // 2. AND (
    //      (Active AND (string differs from center OR has Unit)) OR 
    //      (Not Active AND HasInput AND (Calculated != Raw OR Has Unit))
    //    )
    const shouldShowBottomRight = !simpleMode && (
        (isTyping && (displayRawStr !== computedStr || hasUnit)) ||
        (!isTyping && hasInput && (showRawValHint || hasUnit))
    );

    return (
      <>
        <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
          {hasInput ? computedStr : ''}
        </span>
    
        {shouldShowBottomRight && (
            <span className="absolute bottom-1 right-1 text-sm font-mono flex items-baseline max-w-full px-1">
                <span className="text-emerald-400 font-bold truncate">{displayRawStr}</span>
                {hasUnit && <span className="text-emerald-400/80 text-xs ml-0.5 truncate">{column.unit}</span>}
            </span>
        )}
      </>
    );
};

// --- Main Component ---

const ScoreCell: React.FC<ScoreCellProps> = (props) => {
  const { player, playerIndex, column, allColumns, allPlayers, isActive, onClick, forceHeight, screenshotMode = false, baseImage, isEditMode, limitX, isAlt, previewValue, skipTextureRendering } = props;
  const scoreData: ScoreValue | undefined = player.scores[column.id];
  
  if (baseImage && column.visuals?.cellRect) {
      return (
        <TexturedScoreCell 
            {...props} 
            scoreValue={scoreData} 
            baseImage={baseImage} 
            rect={column.visuals.cellRect} 
            minHeight={screenshotMode ? '100%' : '3rem'} 
            skipTextureRendering={skipTextureRendering} 
        />
      );
  }

  // --- Data Preparation ---
  const parts = scoreData?.parts || [];
  const scoringContext = allColumns ? { allColumns, playerScores: player.scores, allPlayers } : undefined;
  const displayScore = calculateColumnScore(column, parts, scoringContext);
  const autoError = getAutoColumnError(column, scoringContext);
  const hasInput = column.isAuto ? true : parts.length > 0;
  
  const hasLayout = !!column.contentLayout;

  // --- Visuals ---
  const minHeightClass = screenshotMode ? '' : (baseImage ? 'min-h-[3rem]' : 'min-h-[4rem]');
  const borderStructureClasses = baseImage ? '' : 'border-r border-b';
  const cursorClass = hasLayout ? 'cursor-default' : 'cursor-pointer';
  const pointerEventsClass = hasLayout ? 'pointer-events-none' : '';
  const baseContainerClasses = `w-full h-full ${forceHeight || ''} ${borderStructureClasses} relative ${cursorClass} ${pointerEventsClass} transition-colors select-none flex flex-col justify-center items-center overflow-hidden`;
  
  const isStandardAuto = !baseImage && column.isAuto;
  let visualClasses = '';

  if (screenshotMode) {
      if (baseImage) visualClasses = `bg-transparent h-full`;
      else if (isStandardAuto) visualClasses = `bg-indigo-900/20 border-indigo-500/30 h-full`;
      else {
          const bg = isAlt ? 'bg-slate-800/50' : 'bg-transparent';
          visualClasses = `${bg} border-slate-700 h-full`;
      }
  } else {
      let bgClass = 'bg-slate-900 hover:bg-slate-800';
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
      const commonProps = { parts, scoreValue: scoreData, displayScore, hasInput, column, simpleMode: props.simpleMode || false, forceHeight, screenshotMode, textStyle, autoError, previewValue, isActive };

      if (column.isAuto) return <CellContentAuto {...commonProps} />;
      if (column.inputType === 'clicker' && !column.formula.includes('+next')) return <CellContentSelect {...commonProps} />;
      if (column.formula === 'a1×a2') return <CellContentProduct {...commonProps} />;
      if ((column.formula || '').includes('+next')) return <CellContentSum {...commonProps} />;
      
      return <CellContentStandard {...commonProps} />;
  };

  // Custom Layout Mode (Content Box)
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
            containerType: 'size',
        } as React.CSSProperties}
      >
          {column.isAuto && autoError && (
              <div className="absolute top-0 right-0 text-rose-500 z-20 translate-x-1/3 -translate-y-1/3 drop-shadow-md">
                  {autoError === 'missing_dependency' ? <Link2Off size={16} /> : <AlertTriangle size={16} />}
              </div>
          )}
          
          {(() => {
              let contentForCalc: string[] = [];
              const isSumParts = (column.formula || '').includes('+next');
              const isSelectList = column.inputType === 'clicker' && !isSumParts;
              const isPartsOnly = isSumParts && column.showPartsInGrid === 'parts_only';
              const isLabelOnly = isSelectList && column.renderMode === 'label_only';

              if (hasInput) {
                  if (autoError) {
                      contentForCalc = ['ERR'];
                  } else if (isPartsOnly) {
                      contentForCalc = parts.map(formatDisplayNumber);
                  } else if (isLabelOnly) {
                      const option = resolveSelectOption(column, scoreData);
                      if (option) contentForCalc = option.label.split(/\r\n|\r|\n/);
                  } else {
                      contentForCalc = [formatDisplayNumber(displayScore)];
                  }
              }

              const dynamicFontSize = calculateDynamicFontSize(contentForCalc);

              if (hasInput && isPartsOnly) {
                  return (
                      <div className="flex flex-col items-center justify-center w-full h-full leading-none overflow-hidden" style={textStyle}>
                          {parts.map((p, i) => (
                              <span key={i} className="font-bold font-mono truncate w-full text-center" style={{ fontSize: dynamicFontSize }}>
                                  {formatDisplayNumber(p)}
                              </span>
                          ))}
                      </div>
                  );
              }

              if (hasInput && isLabelOnly) {
                  const option = resolveSelectOption(column, scoreData);
                  const labelColor = option?.color || column.color || (screenshotMode ? '#10b981' : '#34d399');
                  return (
                      <div className="flex flex-col items-center justify-center w-full h-full leading-tight overflow-hidden">
                        {(option?.label || '').split(/\r\n|\r|\n/).map((line, i) => (
                            <span 
                                key={i}
                                className="font-bold text-center break-words w-full" 
                                style={{ color: labelColor, fontSize: dynamicFontSize, textShadow: isColorDark(labelColor) ? ENHANCED_TEXT_SHADOW : undefined }}
                            >
                                {line}
                            </span>
                        ))}
                      </div>
                  );
              }

              return (
                  <span className={`font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={{ ...textStyle, fontSize: dynamicFontSize }}>
                    {hasInput ? (autoError ? 'ERR' : formatDisplayNumber(displayScore)) : ''}
                  </span>
              );
          })()}
      </div>
  ) : renderContent();

  return (
    <div onClick={hasLayout ? undefined : onClick} className={`${baseContainerClasses} ${visualClasses}`}>
        {finalContent}
    </div>
  );
};

export default React.memo(ScoreCell);
