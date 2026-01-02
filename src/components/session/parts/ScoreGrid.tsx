
import React, { useMemo, useState, useEffect } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../../types';
import { GripVertical, EyeOff, Layers, Sparkles, Settings, Sigma, X } from 'lucide-react';
import ScoreCell from './ScoreCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { usePlayerWidthSync } from '../../../hooks/usePlayerWidthSync';
import { cropImageToDataUrl } from '../../../utils/imageProcessing';
import { calculateColumnScore } from '../../../utils/scoring';

interface ScoreGridProps {
  session: GameSession;
  template: GameTemplate;
  editingCell: { playerId: string, colId: string } | null;
  editingPlayerId: string | null;
  onCellClick: (playerId: string, colId: string, e: React.MouseEvent) => void;
  onPlayerHeaderClick: (playerId: string, e: React.MouseEvent) => void;
  onColumnHeaderClick: (e: React.MouseEvent, col: ScoreColumn) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  baseImage?: string; 
  isEditMode: boolean; 
  zoomLevel: number; 
}

// Helper to correctly format numbers, moved from ScoreCell for reuse
const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Object.is(num, -0)) return '-0';
  return String(num);
};


// Inner component for Header to handle async crop
const HeaderCell: React.FC<{ 
    col: ScoreColumn; 
    baseImage?: string; 
    children: React.ReactNode; 
    className?: string; 
    style?: React.CSSProperties; 
    onClick?: any; 
    draggable?: boolean; 
    onDragStart?: any; 
    onDragEnd?: any; 
    onTouchStart?: any; 
    onTouchMove?: any; 
    onTouchEnd?: any;
    isEditMode: boolean; 
    displayMode: 'row' | 'overlay' | 'hidden'; 
}> = (props) => {
    const [bgUrl, setBgUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (props.baseImage && props.col.visuals?.headerRect) {
            cropImageToDataUrl(props.baseImage, props.col.visuals.headerRect).then(setBgUrl);
        } else {
            setBgUrl(null);
        }
    }, [props.baseImage, props.col.visuals?.headerRect]);

    const style = { ...props.style };
    
    if (props.col.visuals?.headerRect) {
        const { width, height } = props.col.visuals.headerRect;
        if (width > 0 && height > 0) {
            (style as any).aspectRatio = `${width} / ${height}`;
        }
    }

    if (bgUrl) {
        style.backgroundImage = `url(${bgUrl})`;
        style.backgroundSize = '100% 100%';
        style.border = 'none'; 
    }

    const isHidden = props.displayMode === 'hidden';
    const isOverlay = props.displayMode === 'overlay';
    const hiddenStyleClass = (props.isEditMode && isHidden) 
        ? 'ring-2 ring-amber-500/50 ring-inset bg-amber-900/20' 
        : '';

    // --- Indicator Logic ---
    const renderIndicators = () => {
        if (!props.isEditMode) return null;

        return (
            <>
                {/* Top Right: Layout State (Hidden/Overlay) */}
                <div className="absolute top-0.5 right-0.5 flex gap-0.5 z-20">
                    {isHidden && (
                        <div className="bg-black/60 rounded p-0.5 text-amber-400 backdrop-blur-sm border border-amber-500/30" title="隱藏中">
                            <EyeOff size={10} />
                        </div>
                    )}
                    {isOverlay && (
                        <div className="bg-black/60 rounded p-0.5 text-sky-400 backdrop-blur-sm border border-sky-500/30" title="疊加模式">
                            <Layers size={10} />
                        </div>
                    )}
                </div>

                {/* Bottom Left: Scoring State */}
                {!props.col.isScoring && (
                    <div className="absolute bottom-0.5 left-0.5 z-20 bg-black/60 rounded p-0.5 backdrop-blur-sm border border-amber-500/30" title="不計入總分">
                        <div className="relative w-2.5 h-2.5 flex items-center justify-center">
                             <Sigma size={10} className="text-slate-400 opacity-50" />
                             <X size={8} className="absolute -bottom-0.5 -right-0.5 text-amber-500" strokeWidth={3} />
                        </div>
                    </div>
                )}

                {/* Bottom Right: Logic Type (Only Auto) */}
                <div className="absolute bottom-0.5 right-0.5 z-20 flex gap-0.5">
                    {props.col.isAuto && (
                        <div className="bg-black/60 rounded p-0.5 text-indigo-400 backdrop-blur-sm border border-indigo-500/30" title="自動計算">
                            <Sparkles size={10} />
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div {...props} className={`${props.className} ${hiddenStyleClass}`} style={style}>
            {bgUrl ? (
                <>
                    {renderIndicators()}
                    {props.isEditMode && <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded p-0.5 text-white/70"><GripVertical size={10} /></div>}
                </>
            ) : (
                <>
                    {renderIndicators()}
                    {props.children}
                </>
            )}
        </div>
    );
};

// New Component: Top Left Corner
const PlayerLabelCorner: React.FC<{ template: GameTemplate; baseImage?: string; style?: React.CSSProperties }> = ({ template, baseImage, style }) => {
    const [bgUrl, setBgUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (baseImage && template.globalVisuals?.playerLabelRect) {
            cropImageToDataUrl(baseImage, template.globalVisuals.playerLabelRect).then(setBgUrl);
        } else {
            setBgUrl(null);
        }
    }, [baseImage, template.globalVisuals?.playerLabelRect]);

    const finalStyle: React.CSSProperties = { ...style };
    if (bgUrl) {
        finalStyle.backgroundImage = `url(${bgUrl})`;
        finalStyle.backgroundSize = '100% 100%';
        finalStyle.backgroundRepeat = 'no-repeat';
        finalStyle.border = 'none';
    }

    if (baseImage && template.globalVisuals?.playerLabelRect) {
        const { width, height } = template.globalVisuals.playerLabelRect;
        if (width > 0 && height > 0) {
            (finalStyle as any).aspectRatio = `${width} / ${height}`;
        }
    }

    return (
        <div 
            className="sticky left-0 w-[70px] bg-slate-800 border-r border-b border-slate-700 p-2 flex items-center justify-center z-30 shadow-sm shrink-0"
            style={finalStyle}
        >
            {!bgUrl && <span className="font-bold text-sm text-slate-400">玩家</span>}
        </div>
    );
};

const ScoreGrid: React.FC<ScoreGridProps> = ({
  session,
  template,
  editingCell,
  editingPlayerId,
  onCellClick,
  onPlayerHeaderClick,
  onColumnHeaderClick,
  onUpdateTemplate,
  scrollContainerRef,
  contentRef,
  baseImage,
  isEditMode,
  zoomLevel,
}) => {
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate, scrollRef: scrollContainerRef });
  const [imageDims, setImageDims] = useState<{width: number, height: number} | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
      if (baseImage) {
          const img = new Image();
          img.onload = () => setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = baseImage;
      } else {
          setImageDims(null);
      }
  }, [baseImage]);
  
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const observer = new ResizeObserver(entries => {
        if (entries[0]) {
            setContainerWidth(entries[0].contentRect.width);
        }
    });
    observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  const itemColStyle = useMemo(() => {
      if (!baseImage || !imageDims || !template.globalVisuals?.playerLabelRect || containerWidth === 0) {
          return {};
      }
      const { playerLabelRect } = template.globalVisuals;
      if (!playerLabelRect) return {};

      const itemColProportion = playerLabelRect.width / imageDims.width;
      
      return { 
          width: `${containerWidth * itemColProportion}px`, 
          minWidth: `${containerWidth * itemColProportion}px`,
          flexShrink: 0 
      };

  }, [baseImage, imageDims, template.globalVisuals, containerWidth]);
  
  const processedColumns = useMemo(() => {
    const getMode = (col: ScoreColumn) => col.displayMode || 'row';

    if (isEditMode) {
      return template.columns.map(c => ({
        ...c,
        resolvedDisplayMode: getMode(c), 
        overlayColumns: [] as ScoreColumn[],
      }));
    }

    const visibleCols: (ScoreColumn & { resolvedDisplayMode: string, overlayColumns: ScoreColumn[] })[] = [];
    const overlays: ScoreColumn[] = [];

    template.columns.forEach(col => {
      const mode = getMode(col);
      if (mode === 'row') {
        visibleCols.push({ ...col, resolvedDisplayMode: 'row', overlayColumns: [] });
      } else if (mode === 'overlay') {
        overlays.push(col);
      }
    });

    overlays.forEach(overlayCol => {
      const originalIndex = template.columns.findIndex(c => c.id === overlayCol.id);
      let host: (ScoreColumn & { overlayColumns: ScoreColumn[] }) | null = null;
      
      for (let i = originalIndex - 1; i >= 0; i--) {
        const potentialHostDef = template.columns[i];
        if (getMode(potentialHostDef) === 'row') {
          host = visibleCols.find(vc => vc.id === potentialHostDef.id) || null;
          break;
        }
      }
      
      if (host) {
        host.overlayColumns.push(overlayCol);
      }
    });

    return visibleCols;

  }, [template.columns, isEditMode]);


  usePlayerWidthSync(session.players, processedColumns, zoomLevel);

  const dragIndex = template.columns.findIndex(c => c.id === dnd.draggingId);
  const lastColId = processedColumns.length > 0 ? processedColumns[processedColumns.length - 1].id : null;
  
  const getDragHandlers = (colId: string) => {
      if (!isEditMode) return {};
      return {
          draggable: true,
          onDragStart: (e: any) => dnd.handleDragStart(e, colId),
          onDragEnd: dnd.handleDragEnd,
          onTouchStart: (e: any) => dnd.handleTouchStart(e, colId),
          onTouchMove: dnd.handleTouchMove,
          onTouchEnd: dnd.handleTouchEnd,
      };
  };

  return (
    <div className="absolute inset-0 z-0 overflow-auto bg-slate-900 no-scrollbar pb-32" ref={scrollContainerRef}>
      <div 
        id="live-grid-container" 
        className="min-w-full w-fit relative"
        ref={contentRef}
      >
        {/* Player Headers */}
        <div id="live-player-header-row" className="flex sticky top-0 z-20 bg-slate-800 shadow-sm">
          <PlayerLabelCorner 
            template={template} 
            baseImage={baseImage} 
            style={baseImage ? itemColStyle : {}} 
          />
          {session.players.map((p, index) => (
            <TexturedPlayerHeader
                key={p.id}
                player={p}
                playerIndex={index}
                baseImage={baseImage || ''}
                rect={template.globalVisuals?.playerHeaderRect}
                onClick={(e) => onPlayerHeaderClick(p.id, e)}
                isEditing={editingPlayerId === p.id}
                // Pass right mask boundary for limit calculation
                limitX={template.globalVisuals?.rightMaskRect?.x}
            />
          ))}
        </div>

        {/* Rows */}
        {processedColumns.map((col, index) => {
          const isDragging = dnd.draggingId === col.id;
          const isDropTarget = dnd.dropTargetId === col.id;
          const displayMode = col.resolvedDisplayMode as 'row' | 'overlay' | 'hidden';
          
          // Zebra Striping Logic
          const isAlt = index % 2 !== 0; // Odd rows are alt
          
          let indicator = null;
          
          if (isEditMode && dnd.draggingId && isDropTarget) {
              if (isDragging) {
                  indicator = (
                      <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-slate-400/50 bg-slate-500/5" />
                  );
              } else if (dragIndex < template.columns.findIndex(c => c.id === col.id)) { 
                  indicator = (
                      <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] z-50 pointer-events-none rounded-full translate-y-1/2" />
                  );
              } else {
                  indicator = (
                      <div className="absolute top-0 left-0 right-0 h-[4px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] z-50 pointer-events-none rounded-full -translate-y-1/2" />
                  );
              }
          }

          const headerDragHandlers = getDragHandlers(col.id);
          const rowHiddenClass = (isEditMode && displayMode === 'hidden') ? 'opacity-70 bg-slate-900/50' : '';
          
          // Header Background Color Logic (Standard vs Alt)
          // Even: bg-slate-800 (#1e293b)
          // Odd: bg-[#2e3b4e] (Slightly lighter than 800, to match data zebra)
          // When dragging in Edit Mode, force slate-700.
          // Note: If baseImage is present, these colors are covered by the texture unless dragging.
          const headerBgClass = isEditMode && isDragging 
            ? 'bg-slate-700' 
            : (isAlt && !baseImage ? 'bg-[#2e3b4e]' : 'bg-slate-800');

          return (
            <div
              key={col.id}
              id={`row-${col.id}`}
              data-row-id={col.id}
              onDragOver={(e) => isEditMode ? dnd.handleDragOver(e, col.id) : undefined}
              onDrop={(e) => isEditMode ? dnd.handleDrop(e, col.id) : undefined}
              className={`flex relative z-10 transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
            >
              {indicator}

              <HeaderCell
                col={col}
                baseImage={baseImage}
                onClick={(e: any) => onColumnHeaderClick(e, col)}
                isEditMode={isEditMode}
                displayMode={displayMode}
                {...headerDragHandlers}
                className={`sticky left-0 w-[70px] ${headerBgClass} border-r-2 border-b border-slate-700 p-2 flex flex-col justify-center transition-colors z-20 group select-none shrink-0 ${isEditMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab hover:bg-slate-700') : 'cursor-default'}`}
                style={{
                  ...(baseImage ? itemColStyle : {}),
                  borderRightColor: col.color || 'var(--border-slate-700)'
                }}
              >
                <span className="text-sm font-bold text-slate-300 w-full text-center break-words whitespace-pre-wrap leading-tight" style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>
                  {col.name}
                </span>
                {col.isScoring && (
                    <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                        {(() => {
                            if (col.formula.includes('a1×a2') && col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span>{col.subUnits[0]}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span>{col.subUnits[1]}</span></div>;
                            if (col.inputType === 'clicker' && !col.formula.includes('+next')) return <div className="flex items-center justify-center gap-1 flex-wrap w-full"><Settings size={10} />{col.unit && <span className="text-xs break-words text-center">{col.unit}</span>}</div>;
                            
                            // Check for any formula involving multiplication by c1 (e.g. a1xc1, (a1+next)xc1)
                            if (col.formula?.includes('×c1')) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="break-words text-center">{col.unit}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="text-emerald-500 font-bold font-mono">{col.constants?.c1 ?? 1}</span></div>;
                            
                            if (col.unit) return <span className="text-xs break-words w-full text-center">{col.unit}</span>;
                            return null;
                        })()}
                    </div>
                )}
                {isEditMode && <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded p-0.5 text-white/70"><GripVertical size={10} /></div>}
              </HeaderCell>
              
              {session.players.map((p, pIdx) => (
                <div key={p.id} className={`${rowHiddenClass} w-full relative`}>
                    <ScoreCell
                        player={p}
                        playerIndex={pIdx}
                        column={col}
                        allColumns={template.columns} // Pass all columns context
                        allPlayers={session.players} // Pass all players for ranking
                        baseImage={baseImage}
                        isActive={editingCell?.playerId === p.id && editingCell?.colId === col.id}
                        onClick={(e) => onCellClick(p.id, col.id, e)}
                        isEditMode={isEditMode}
                        // Pass right mask boundary for limit calculation
                        limitX={template.globalVisuals?.rightMaskRect?.x}
                        // Pass Zebra Striping flag
                        isAlt={isAlt}
                    />
                     {/* OVERLAY RENDERING */}
                     {col.overlayColumns.map(overlayCol => {
                        const isActive = editingCell?.playerId === p.id && editingCell?.colId === overlayCol.id;
                        const scoreData = p.scores[overlayCol.id];
                        const parts = scoreData?.parts || [];
                        
                        // Also provide context for overlay columns
                        const overlayContext = { 
                            allColumns: template.columns, 
                            playerScores: p.scores,
                            allPlayers: session.players
                        };
                        const displayScore = calculateColumnScore(overlayCol, parts, overlayContext);
                        
                        const hasInput = overlayCol.isAuto ? true : parts.length > 0;
                        const defaultTextColor = baseImage ? 'rgba(28, 35, 51, 0.90)' : '#ffffff';
                        
                        // FIX: Only use column color in Edit Mode. In Play Mode, use default (black/white) to look like ink.
                        const displayColor = (isEditMode && overlayCol.color) ? overlayCol.color : defaultTextColor;

                        const textStyle: React.CSSProperties = {
                            color: hasInput ? (displayScore < 0 ? '#f87171' : displayColor) : '#475569',
                            // Only add shadow if using column color and it's dark
                            ...(isEditMode && overlayCol.color && isColorDark(overlayCol.color) && { textShadow: ENHANCED_TEXT_SHADOW }),
                            ...(baseImage && {
                                fontFamily: '"Kalam", "Caveat", cursive',
                                transform: `rotate(${((p.id.charCodeAt(0) + overlayCol.id.charCodeAt(0)) % 5) - 2}deg)`,
                                mixBlendMode: 'multiply',
                                textShadow: 'none',
                            })
                        };
                        const forceHeight = "h-16";

                        if (!overlayCol.contentLayout) return null;

                        return (
                            <div
                                key={overlayCol.id}
                                className="absolute inset-0 pointer-events-none"
                            >
                                <div 
                                    onClick={(e) => { e.stopPropagation(); onCellClick(p.id, overlayCol.id, e); }}
                                    className={`
                                        absolute flex items-center justify-center 
                                        border-2 rounded-md cursor-pointer transition-all pointer-events-auto
                                        ${isActive 
                                            ? 'border-emerald-500 bg-emerald-500/20 ring-1 ring-emerald-500' // Active Style
                                            : (isEditMode 
                                                ? 'border-dashed border-white/40 hover:border-white/60 hover:bg-white/5' // Edit Mode
                                                : (!baseImage 
                                                    ? 'border-dashed border-white/20 hover:border-white/40 hover:bg-white/5' // Play Mode (No BG)
                                                    : 'border-transparent hover:border-black/10 hover:bg-black/5') // Play Mode (With BG)
                                              )
                                        }
                                    `}
                                    style={{
                                        left: `${overlayCol.contentLayout.x}%`,
                                        top: `${overlayCol.contentLayout.y}%`,
                                        width: `${overlayCol.contentLayout.width}%`,
                                        height: `${overlayCol.contentLayout.height}%`,
                                        borderColor: (!isActive && isEditMode && overlayCol.color) 
                                            ? `${overlayCol.color}60` 
                                            : undefined,
                                    }}
                                >
                                    <span className={`text-xl font-bold tracking-tight w-full text-center truncate px-1 ${forceHeight ? 'leading-none' : ''}`} style={textStyle}>
                                        {hasInput ? formatDisplayNumber(displayScore) : ''}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
              ))}
            </div>
          );
        })}
        
        <div 
            data-row-id={lastColId} 
            onDragOver={(e) => { if (isEditMode && lastColId) dnd.handleDragOver(e, lastColId); }}
            onDrop={(e) => { if (isEditMode && lastColId) dnd.handleDrop(e, lastColId); }}
            className={`w-full ${editingCell || editingPlayerId ? 'h-[40vh]' : 'h-24'}`} 
        />
      </div>
    </div>
  );
};

export default ScoreGrid;
