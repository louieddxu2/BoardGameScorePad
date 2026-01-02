
import React, { useEffect, useState } from 'react';
import { Player, ScoreColumn, ScoreValue } from '../../../types';
import { calculateColumnScore, getAutoColumnError } from '../../../utils/scoring';
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
}

// Helper for number formatting
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
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
  limitX
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
  
  useEffect(() => {
    let isMounted = true;
    getSmartTextureUrl(baseImage, rect, playerIndex, limitX).then((url) => {
        if (isMounted) setBgUrl(url);
    });
    return () => { isMounted = false; };
  }, [baseImage, rect, playerIndex, limitX]);

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
      return (
        <div 
            onClick={undefined} 
            className={`player-col-${player.id} w-full self-stretch relative cursor-default select-none overflow-hidden transition-all pointer-events-none`}
            style={{
                backgroundColor: '#e2e8f0', 
                minHeight: minHeight, 
            }}
        >
            <SmartTextureLayer bgUrl={bgUrl} rect={rect} />
            
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
                }}
            >
                {column.isAuto && autoError && (
                    <div className="absolute -top-3 -right-3 text-rose-500 z-20 drop-shadow-md">
                        {autoError === 'missing_dependency' ? <Link2Off size={16} /> : <AlertTriangle size={16} />}
                    </div>
                )}
                <span className="text-xl font-bold tracking-tight leading-none" style={inkStyle}>
                    {hasInput ? (autoError ? 'ERR' : formatDisplayNumber(displayScore)) : ''}
                </span>
            </div>
            <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-10" />
        </div>
      );
  }

  const isSumParts = (column.formula || '').includes('+next');
  const isSelectList = column.inputType === 'clicker' && !isSumParts;
  const isProduct = column.formula === 'a1×a2';

  const renderContent = () => {
      // Auto Mode
      if (column.isAuto) {
          return (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                  {autoError && (
                      <div className="absolute top-1 right-1 text-rose-500 z-20 opacity-80" title={autoError === 'missing_dependency' ? "參照的欄位已遺失" : "計算錯誤"}>
                          {autoError === 'missing_dependency' ? <Link2Off size={14} /> : <AlertTriangle size={14} />}
                      </div>
                  )}
                  <span className="text-3xl font-bold tracking-tight" style={inkStyle}>
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

      // Priority 1: Simple/Total Mode
      // Triggered if prop simpleMode=true OR config showPartsInGrid=false
      if (simpleMode || column.showPartsInGrid === false) {
          // This block falls through to the Default/Simple rendering at the bottom
          // which renders just the centered total.
      }
      else if (isSumParts && hasInput) {
          // Priority 2: Parts Only Mode (List)
          if (column.showPartsInGrid === 'parts_only') {
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
          
          // Priority 3: Standard Mode (Split View)
          // Since we already filtered out 'false' (Simple) and 'parts_only' (List) and simpleMode prop, 
          // this is the default Standard view.
          return (
              <div className="relative z-10 w-full h-full flex flex-row items-stretch">
                  <div className="w-1/2 flex justify-center items-center min-w-0 border-r border-slate-500/10 pr-0.5">
                      <span className="text-xl font-bold tracking-tight leading-none" style={inkStyle}>
                          {formatDisplayNumber(displayScore)}
                      </span>
                  </div>
                  <div className="w-1/2 flex flex-col justify-center items-end pl-1 pr-0.5 leading-none opacity-90 gap-0.5" style={noteStyle}>
                      {parts.map((p, i) => (
                          <span key={i} className="text-sm font-bold block truncate max-w-full">
                              {formatDisplayNumber(p)}
                          </span>
                      ))}
                  </div>
              </div>
          );
      }

      // Default/Simple mode rendering (Center Total)
      const rawVal = parts[0];
      const showRawValHint = displayScore !== rawVal;
      const hasUnit = !!column.unit;
      
      // Determine if we should show the bottom-right hint (Standard mode only)
      // Only show hint if NOT in simpleMode AND column setting is NOT simple
      const showBottomRight = !simpleMode && column.showPartsInGrid !== false && hasInput && !isProduct && !isSumParts && !isSelectList && (showRawValHint || hasUnit);

      return (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
              {isProduct && hasInput ? (
                  <div className="flex flex-col items-center justify-center leading-none" style={inkStyle}>
                      <span className="text-2xl font-bold">{formatDisplayNumber(displayScore)}</span>
                      {!simpleMode && column.showPartsInGrid !== false && (
                        <span className="text-xs opacity-70 font-sans tracking-tighter" style={{ mixBlendMode: 'normal' }}>
                            {parts[0]}×{parts[1] ?? 1}
                        </span>
                      )}
                  </div>
              ) : (
                  <span className="text-3xl font-bold tracking-tight" style={inkStyle}>
                      {hasInput ? formatDisplayNumber(displayScore) : ''}
                  </span>
              )}

              {!simpleMode && column.showPartsInGrid !== false && (
                <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end pointer-events-none max-w-[80%]">
                    {isSelectList && hasInput && (() => {
                        const rawVal = parts[0];
                        const option = column.quickActions?.find(opt => opt.value === rawVal);
                        if (option) {
                            return <span className="text-base font-bold leading-tight text-right rotate-[-1deg]" style={noteStyle}>{option.label}</span>;
                        }
                        return null;
                    })()}
                    
                    {/* Bug Fix: Standard Weighted Column with Unit */}
                    {showBottomRight && (
                         <div className="flex items-center gap-0.5 leading-none" style={noteStyle}>
                             <span className="text-lg font-bold">{formatDisplayNumber(parts[0])}</span>
                             {column.unit && <span className="text-xs opacity-70">{column.unit}</span>}
                         </div>
                    )}
                </div>
              )}
          </div>
      );
  };

  return (
    <div 
        onClick={onClick}
        className={`player-col-${player.id} w-full self-stretch relative cursor-pointer select-none overflow-hidden transition-all ${isActive ? '' : 'hover:brightness-95'}`}
        style={{
            backgroundColor: '#e2e8f0', 
            minHeight: minHeight, 
        }}
    >
        {isActive && <div className="absolute inset-0 ring-2 ring-inset ring-emerald-500 z-30 pointer-events-none"></div>}
        <SmartTextureLayer bgUrl={bgUrl} rect={rect} />
        {renderContent()}
        <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.05)] pointer-events-none z-10" />
    </div>
  );
};

export default TexturedScoreCell;
