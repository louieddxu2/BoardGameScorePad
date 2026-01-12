
import React, { useEffect, useState } from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../../types';
import { calculateColumnScore, getAutoColumnError, resolveSelectOption } from '../../../utils/scoring';
import { getSmartTextureUrl } from '../../../utils/imageProcessing';
import SmartTextureLayer from './SmartTextureLayer';
import { Link2Off, AlertTriangle } from 'lucide-react';

interface TexturedScoreCellProps {
  player: Player;
  playerIndex: number;
  column: ScoreColumn;
  allColumns?: ScoreColumn[];
  allPlayers?: Player[]; // Added for ranking context
  scoreValue: ScoreValue | undefined;
  baseImage: string;
  rect: { x: number, y: number, width: number, height: number };
  onClick: (e: React.MouseEvent) => void;
  isActive: boolean;
  minHeight?: string | number;
  simpleMode?: boolean;
  isEditMode?: boolean; 
  limitX?: number;
  skipTextureRendering?: boolean; // New Prop
}

// Helper for number formatting
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Number.isNaN(num)) return 'NaN';
  if (num === Infinity) return '∞';
  if (num === -Infinity) return '-∞';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};

const TexturedScoreCell: React.FC<TexturedScoreCellProps> = ({ 
  player, 
  playerIndex,
  column, 
  allColumns,
  allPlayers,
  scoreValue, 
  baseImage, 
  rect, 
  onClick,
  isActive,
  minHeight = '3rem',
  simpleMode = false,
  isEditMode = false,
  limitX,
  skipTextureRendering = false
}) => {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  
  const parts = scoreValue?.parts || [];
  
  // Context for Auto Calculation
  const scoringContext = allColumns ? {
      allColumns: allColumns,
      playerScores: player.scores,
      allPlayers: allPlayers
  } : undefined;

  const displayScore = calculateColumnScore(column, parts, scoringContext);
  const autoError = getAutoColumnError(column, scoringContext);
  
  // Auto columns always show value if they are calculated
  const hasInput = column.isAuto ? true : parts.length > 0;
  
  // [Internal Logic] If we have a valid texture configuration, we override the default minHeight.
  // This allows the row height to be governed solely by the Header Block's aspect ratio,
  // preventing the "3rem" default from stretching the row unnecessarily.
  const hasTexture = !!(baseImage && rect);
  const effectiveMinHeight = hasTexture ? '0px' : minHeight;

  useEffect(() => {
    if (skipTextureRendering) return; // Optimization: Don't load texture if skipped
    
    let isMounted = true;
    getSmartTextureUrl(baseImage, rect, playerIndex, limitX).then((url) => {
        if (isMounted) setBgUrl(url);
    });
    return () => { isMounted = false; };
  }, [baseImage, rect, playerIndex, limitX, skipTextureRendering]);

  // Ink Styles
  const inkStyle: React.CSSProperties = {
      fontFamily: '"Kalam", "Caveat", cursive',
      color: autoError ? '#f43f5e' : 'rgba(28, 35, 51, 0.90)', // Red on error
      transform: hasInput ? `rotate(${((player.id.charCodeAt(0) + column.id.charCodeAt(0)) % 5) - 2}deg)` : 'none',
      textShadow: 'none',
      mixBlendMode: 'multiply',
      position: 'relative', 
      zIndex: 10, 
  };

  const noteStyle: React.CSSProperties = {
      fontFamily: '"Kalam", cursive',
      color: 'rgba(71, 85, 105, 0.9)',
      mixBlendMode: 'multiply',
      position: 'relative',
      zIndex: 10,
  };

  // --- Content Rendering ---
  
  // Custom Layout Wrapper
  if (column.contentLayout) {
      // Determine what content to show based on column settings
      let layoutContent: React.ReactNode = null;
      
      const isSumParts = (column.formula || '').includes('+next');
      const isPartsOnly = isSumParts && column.showPartsInGrid === 'parts_only';
      const isSelectList = column.inputType === 'clicker' && !isSumParts;
      const isLabelOnly = isSelectList && column.renderMode === 'label_only';

      if (hasInput) {
          if (autoError) {
              layoutContent = 'ERR';
          } else if (isPartsOnly) {
              // Parts Only Mode (List)
              // Logic: Font size calculates based on container height (cqh)
              // Formula: 100cqh / items_count * 0.9 (safety margin)
              // Clamped: Max 1.3rem (normal size), Min calculated dynamically
              const count = Math.max(1, parts.length);
              const dynamicFontSize = `min(1.3rem, calc((100cqh / ${count}) * 0.9))`;
              
              layoutContent = (
                  <div className="flex flex-col items-center justify-center w-full h-full leading-none overflow-hidden">
                      {parts.map((p, i) => (
                          <span key={i} className="font-bold tracking-tight truncate w-full text-center" style={{ ...inkStyle, fontSize: dynamicFontSize }}>
                              {formatDisplayNumber(p)}
                          </span>
                      ))}
                  </div>
              );
          } else if (isLabelOnly) {
              // Label Only Mode
              const option = resolveSelectOption(column, scoreValue);
              const labelColor = option?.color || column.color || 'rgba(28, 35, 51, 0.90)';
              layoutContent = (
                   <span 
                      className="text-lg font-bold text-center leading-tight whitespace-pre-wrap break-words w-full" 
                      style={{ ...inkStyle, color: labelColor }}
                   >
                      {option ? option.label : ''}
                   </span>
              );
          } else {
              // Default: Numeric Score
              layoutContent = (
                  <span className="text-xl font-bold tracking-tight leading-none" style={inkStyle}>
                      {formatDisplayNumber(displayScore)}
                  </span>
              );
          }
      }

      return (
        <div 
            onClick={undefined} 
            className={`w-full h-full relative cursor-default select-none overflow-hidden transition-all pointer-events-none`}
            style={{
                backgroundColor: skipTextureRendering ? 'transparent' : '#e2e8f0', 
                minHeight: effectiveMinHeight, 
            }}
        >
            {!skipTextureRendering && <SmartTextureLayer bgUrl={bgUrl} rect={rect} />}
            
            <div 
                onClick={(e) => { e.stopPropagation(); onClick(e); }}
                className={`
                    absolute flex items-center justify-center z-10 border-2 rounded-md cursor-pointer transition-all pointer-events-auto
                    ${isActive 
                        ? 'border-emerald-500 bg-emerald-500/20 ring-1 ring-emerald-500' // Active Style
                        : (isEditMode 
                            ? 'border-dashed border-slate-500/30 hover:border-slate-600/60 hover:bg-black/5' 
                            : 'border-transparent hover:border-black/10 hover:bg-black/5') // Inactive Style
                    }
                `}
                style={{
                    left: `${column.contentLayout.x}%`,
                    top: `${column.contentLayout.y}%`,
                    width: `${column.contentLayout.width}%`,
                    height: `${column.contentLayout.height}%`,
                    containerType: 'size', // [Key Feature] Enable Container Queries
                } as React.CSSProperties}
            >
                {column.isAuto && autoError && (
                    <div className="absolute -top-3 -right-3 text-rose-500 z-20 drop-shadow-md">
                        {autoError === 'missing_dependency' ? <Link2Off size={16} /> : <AlertTriangle size={16} />}
                    </div>
                )}
                {/* Render the determined content directly */}
                {layoutContent}
            </div>
            {!skipTextureRendering && <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-10" />}
        </div>
      );
  }

  const isSumParts = (column.formula || '').includes('+next');
  const isSelectList = column.inputType === 'clicker' && !isSumParts;
  const isLookup = (column.formula || '').startsWith('f1') || !!column.functions;

  const renderContent = () => {
      // 1. Auto Mode
      if (column.isAuto) {
          return (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                  {autoError && (
                      <div className="absolute top-1 right-1 text-rose-500 z-20 opacity-80" title={autoError === 'missing_dependency' ? "參照的欄位已遺失" : "計算錯誤"}>
                          {autoError === 'missing_dependency' ? <Link2Off size={14} /> : <AlertTriangle size={14} />}
                      </div>
                  )}
                  <span className="text-3xl font-bold tracking-tight leading-none" style={inkStyle}>
                      {autoError ? 'ERR' : formatDisplayNumber(displayScore)}
                  </span>
                  {!simpleMode && !autoError && (
                    <div className="absolute bottom-2 right-2 z-10 opacity-50 pointer-events-none" style={noteStyle}>
                        <span className="text-[10px]">AUTO</span>
                    </div>
                  )}
              </div>
          );
      }

      // 2. Select List (Clicker) with Render Modes
      if (isSelectList) {
          // Use centralized resolver
          const option = resolveSelectOption(column, scoreValue);
          const renderMode = column.renderMode || 'standard';
          
          if (renderMode === 'label_only' && option) {
             const labelColor = option.color || column.color || 'rgba(28, 35, 51, 0.90)';
             return (
                 <div className="relative z-10 w-full h-full flex items-center justify-center p-1">
                     <span 
                        className="text-lg font-bold text-center leading-tight whitespace-pre-wrap break-words w-full"
                        style={{
                            ...inkStyle,
                            color: labelColor,
                            mixBlendMode: 'multiply',
                        }}
                     >
                        {option.label}
                     </span>
                 </div>
             );
          }
          
          return (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                  <span className="text-3xl font-bold tracking-tight leading-none" style={inkStyle}>
                      {hasInput ? formatDisplayNumber(displayScore) : ''}
                  </span>
                  
                  {/* Standard Mode -> Render Label at Bottom Right */}
                  {renderMode === 'standard' && !simpleMode && column.showPartsInGrid !== false && option && (
                      <div className="absolute bottom-1 right-1 z-10 max-w-[90%] flex justify-end pointer-events-none">
                          <span 
                            className="text-xs font-bold leading-tight text-right whitespace-pre-wrap"
                            style={{
                                fontFamily: '"Kalam", cursive',
                                color: option.color || column.color || 'rgba(71, 85, 105, 0.9)',
                                mixBlendMode: 'multiply',
                                transform: 'rotate(-2deg)',
                            }}
                          >
                              {option.label}
                          </span>
                      </div>
                  )}
              </div>
          );
      }

      // 3. Sum Parts Logic
      // In Textured Mode, we treat "Standard" (Total + Parts) the same as "Total Only"
      // to avoid visual clutter on the background image.
      if (isSumParts && hasInput) {
          // Exception: "Parts Only" Mode (List)
          if (column.showPartsInGrid === 'parts_only' && !simpleMode) {
              return (
                  <div className="relative z-10 w-full h-full flex flex-col items-center justify-center py-1 gap-0.5">
                      {parts.map((p, i) => (
                          <span 
                            key={i} 
                            className="text-lg font-bold tracking-tight leading-none block truncate max-w-full"
                            style={{
                                ...inkStyle,
                                transform: `rotate(${((player.id.charCodeAt(0) + i) % 5) - 2}deg)`, 
                            }}
                          >
                              {formatDisplayNumber(p)}
                          </span>
                      ))}
                  </div>
              );
          }
          // Fallthrough: If standard or total-only, proceed to Default Rendering (Big Centered Total)
      }

      // 4. Default / Generic Rendering (Product, Standard, Lookup)
      // Lookup columns show raw input at bottom right
      const showBottomRightRaw = !simpleMode && hasInput && isLookup;

      return (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
              {/* Main Score - Always Centered */}
              <span className="text-3xl font-bold tracking-tight leading-none" style={inkStyle}>
                  {hasInput ? formatDisplayNumber(displayScore) : ''}
              </span>

              {/* Bottom Right Hint (Raw Value for Lookup) */}
              {showBottomRightRaw && (
                <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end pointer-events-none opacity-80">
                    <span className="text-sm font-bold leading-none" style={noteStyle}>
                        {formatDisplayNumber(parts[0])}
                        {column.unit && <span className="text-[10px] ml-0.5">{column.unit}</span>}
                    </span>
                </div>
              )}
          </div>
      );
  };

  return (
    <div 
        onClick={onClick}
        className={`w-full h-full relative cursor-pointer select-none overflow-hidden transition-all ${isActive ? '' : 'hover:brightness-95'}`}
        style={{
            backgroundColor: skipTextureRendering ? 'transparent' : '#e2e8f0', 
            minHeight: effectiveMinHeight, 
        }}
    >
        {isActive && <div className="absolute inset-0 ring-2 ring-inset ring-emerald-500 z-30 pointer-events-none"></div>}
        {!skipTextureRendering && <SmartTextureLayer bgUrl={bgUrl} rect={rect} />}
        {renderContent()}
        {!skipTextureRendering && <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-10" />}
    </div>
  );
};

export default TexturedScoreCell;
