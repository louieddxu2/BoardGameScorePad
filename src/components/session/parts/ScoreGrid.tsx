
import React, { useMemo, useState, useEffect } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../../types';
import { GripVertical, EyeOff, Layers, Sparkles, Settings, Sigma, X, Plus } from 'lucide-react';
import ScoreCell from './ScoreCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedBlock from './TexturedBlock';
import { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import { isColorDark, ENHANCED_TEXT_SHADOW } from '../../../utils/ui';
import { usePlayerWidthSync } from '../../../hooks/usePlayerWidthSync';
import { calculateColumnScore, resolveSelectOption } from '../../../utils/scoring';
import { calculateDynamicFontSize } from '../../../utils/dynamicLayout';

interface ScoreGridProps {
  session: GameSession;
  template: GameTemplate;
  editingCell: { playerId: string, colId: string } | null;
  editingPlayerId: string | null;
  onCellClick: (playerId: string, colId: string, e: React.MouseEvent) => void;
  onPlayerHeaderClick: (playerId: string, e: React.MouseEvent) => void;
  onColumnHeaderClick: (e: React.MouseEvent, col: ScoreColumn) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onAddColumn: () => void; // New prop
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  baseImage?: string; 
  isEditMode: boolean; 
  zoomLevel: number;
  previewValue?: any; 
}

const formatDisplayNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '';
  if (Object.is(num, -0)) return '-0';
  return String(num);
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
  onAddColumn,
  scrollContainerRef,
  contentRef,
  baseImage,
  isEditMode,
  zoomLevel,
  previewValue,
}) => {
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate, scrollRef: scrollContainerRef });
  const [imageDims, setImageDims] = useState<{width: number, height: number} | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // [Simplified Logic] 
  // Determine mode strictly by existence of baseImage.
  // We do NOT wait for dimensions to load to switch modes, preventing style flickering.
  const isTextureMode = !!baseImage;

  // Load image dimensions for ratio calculation (only if in texture mode)
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
            const width = entries[0].contentRect.width;
            window.requestAnimationFrame(() => {
                setContainerWidth(width);
            });
        }
    });
    observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  // Calculate the width of the Left Sticky Column (Label)
  const leftColWidth = useMemo(() => {
      // 1. Texture Mode: Use loaded dimensions if available
      // [FIX] playerLabelRect.width is now a normalized percentage (0.0 - 1.0).
      // We should NOT divide by imageDims.width anymore.
      if (isTextureMode && imageDims && template.globalVisuals?.playerLabelRect) {
          const { playerLabelRect } = template.globalVisuals;
          // Direct proportion (0-1)
          const itemColProportion = playerLabelRect.width; 
          return containerWidth * itemColProportion * zoomLevel;
      }
      
      // 2. Standard Mode or Texture Mode (loading): Dynamic calculation / Fallback
      if (containerWidth > 0) {
          return Math.max(70, containerWidth / (session.players.length + 2));
      }
      
      return 70; // Absolute fallback
  }, [isTextureMode, imageDims, template.globalVisuals, containerWidth, zoomLevel, session.players.length]);

  const itemColStyle = useMemo(() => {
      return { 
          width: `${leftColWidth}px`, 
          minWidth: `${leftColWidth}px`,
          flexShrink: 0 
      };
  }, [leftColWidth]);
  
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

  const renderIndicators = (col: ScoreColumn, isHidden: boolean, isOverlay: boolean) => {
    if (!isEditMode) return null;
    return (
        <>
            <div className="absolute top-0.5 right-0.5 flex gap-0.5 z-20">
                {isHidden && <div className="bg-black/60 rounded p-0.5 text-amber-400 backdrop-blur-sm border border-amber-500/30" title="隱藏中"><EyeOff size={10} /></div>}
                {isOverlay && <div className="bg-black/60 rounded p-0.5 text-sky-400 backdrop-blur-sm border border-sky-500/30" title="疊加模式"><Layers size={10} /></div>}
            </div>
            {!col.isScoring && <div className="absolute bottom-0.5 left-0.5 z-20 bg-black/60 rounded p-0.5 backdrop-blur-sm border border-amber-500/30" title="不計入總分"><div className="relative w-2.5 h-2.5 flex items-center justify-center"><Sigma size={10} className="text-slate-400 opacity-50" /><X size={8} className="absolute -bottom-0.5 -right-0.5 text-amber-500" strokeWidth={3} /></div></div>}
            <div className="absolute bottom-0.5 right-0.5 z-20 flex gap-0.5">{col.isAuto && <div className="bg-black/60 rounded p-0.5 text-indigo-400 backdrop-blur-sm border border-indigo-500/30" title="自動計算"><Sparkles size={10} /></div>}</div>
        </>
    );
  };

  const minPlayerWidth = 54 * zoomLevel;
  const requiredRowWidth = leftColWidth + (session.players.length * minPlayerWidth);
  const headerRowWidth = containerWidth ? Math.max(containerWidth, requiredRowWidth) : '100%';

  return (
    <div className="absolute inset-0 z-0 overflow-auto bg-slate-900 no-scrollbar pb-32" ref={scrollContainerRef}>
      <div 
        id="live-grid-container" 
        className="min-w-full w-fit relative"
        ref={contentRef}
      >
        {/* Player Headers */}
        <div 
            id="live-player-header-row" 
            className="flex sticky top-0 z-20 bg-slate-800 shadow-sm"
            style={{ width: typeof headerRowWidth === 'number' ? `${headerRowWidth}px` : headerRowWidth }}
        >
          <TexturedBlock 
            baseImage={baseImage} // Pass directly, TextureBlock handles null
            rect={template.globalVisuals?.playerLabelRect}
            fallbackContent={<span className="font-bold text-sm text-slate-400">玩家</span>}
            className={`sticky left-0 bg-slate-800 border-r border-b border-slate-700 flex items-center justify-center z-30 shadow-sm shrink-0 overflow-hidden ${isTextureMode ? 'p-0' : 'p-2'}`}
            style={itemColStyle} 
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
          const isAlt = index % 2 !== 0; 
          const isHidden = displayMode === 'hidden';
          const isOverlay = displayMode === 'overlay';
          
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

          const rowHiddenClass = (isEditMode && displayMode === 'hidden') ? 'opacity-70 bg-slate-900/50' : '';
          const hiddenStyleClass = (isEditMode && isHidden) ? 'ring-2 ring-amber-500/50 ring-inset bg-amber-900/20' : '';
          
          // Header Background Color Logic - Dependent on isTextureMode
          const headerBgClass = isEditMode && isDragging 
            ? 'bg-slate-700' 
            : (isAlt && !isTextureMode ? 'bg-[#2e3b4e]' : 'bg-slate-800');

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

              <TexturedBlock
                baseImage={baseImage}
                rect={col.visuals?.headerRect}
                onClick={(e: any) => onColumnHeaderClick(e, col)}
                {...getDragHandlers(col.id)}
                className={`sticky left-0 ${headerBgClass} ${hiddenStyleClass} border-r-2 border-b border-slate-700 flex flex-col justify-center transition-colors z-20 group select-none shrink-0 overflow-hidden ${isEditMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab hover:bg-slate-700') : 'cursor-default'} ${isTextureMode ? 'p-0' : 'p-2'}`}
                style={{
                  ...itemColStyle,
                  borderRightColor: col.color || 'var(--border-slate-700)'
                }}
                fallbackContent={
                    <>
                        <span className="text-sm font-bold text-slate-300 w-full text-center break-words whitespace-pre-wrap leading-tight" style={{ ...(col.color && { color: col.color, ...(isColorDark(col.color) && { textShadow: ENHANCED_TEXT_SHADOW }) }) }}>
                        {col.name}
                        </span>
                        {col.isScoring && (
                            <div className="text-xs text-slate-500 mt-1 flex flex-col items-center justify-center w-full leading-none">
                                {(() => {
                                    if (col.formula.includes('a1×a2') && col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span>{col.subUnits[0]}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span>{col.subUnits[1]}</span></div>;
                                    if (col.inputType === 'clicker' && !col.formula.includes('+next')) return <div className="flex items-center justify-center gap-1 flex-wrap w-full"><Settings size={10} />{col.unit && <span className="text-xs break-words text-center">{col.unit}</span>}</div>;
                                    if (col.formula?.includes('×c1')) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="break-words text-center">{col.unit}</span><span className="text-slate-600 text-[11px] mx-0.5">×</span><span className="text-emerald-500 font-bold font-mono">{col.constants?.c1 ?? 1}</span></div>;
                                    if (col.unit) return <span className="text-xs break-words w-full text-center">{col.unit}</span>;
                                    return null;
                                })()}
                            </div>
                        )}
                    </>
                }
              >
                {renderIndicators(col, isHidden, isOverlay)}
                {isEditMode && isTextureMode && <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded p-0.5 text-white/70"><GripVertical size={10} /></div>}
              </TexturedBlock>
              
              {session.players.map((p, pIdx) => {
                const isActive = editingCell?.playerId === p.id && editingCell?.colId === col.id;
                
                return (
                <div key={p.id} className={`${rowHiddenClass} w-full relative player-col-${p.id}`}>
                    <ScoreCell
                        player={p}
                        playerIndex={pIdx}
                        column={col}
                        allColumns={template.columns}
                        allPlayers={session.players}
                        baseImage={baseImage}
                        isActive={isActive}
                        onClick={(e) => onCellClick(p.id, col.id, e)}
                        isEditMode={isEditMode}
                        limitX={template.globalVisuals?.rightMaskRect?.x}
                        isAlt={isAlt}
                        previewValue={isActive ? previewValue : undefined}
                    />
                     {col.overlayColumns.map(overlayCol => {
                        const isOverlayActive = editingCell?.playerId === p.id && editingCell?.colId === overlayCol.id;
                        const scoreData = p.scores[overlayCol.id];
                        const parts = scoreData?.parts || [];
                        
                        const overlayContext = { 
                            allColumns: template.columns, 
                            playerScores: p.scores,
                            allPlayers: session.players
                        };
                        const displayScore = calculateColumnScore(overlayCol, parts, overlayContext);
                        
                        let displayText = '';
                        const hasInput = overlayCol.isAuto ? true : parts.length > 0;
                        const isSelectList = overlayCol.inputType === 'clicker' && !(overlayCol.formula || '').includes('+next');

                        if (hasInput) {
                            if (isSelectList && parts.length > 0) {
                                const option = resolveSelectOption(overlayCol, scoreData);
                                const renderMode = overlayCol.renderMode || 'standard';
                                if (option && (renderMode === 'label_only' || renderMode === 'standard')) {
                                    displayText = option.label;
                                } else {
                                    displayText = formatDisplayNumber(displayScore);
                                }
                            } else {
                                displayText = formatDisplayNumber(displayScore);
                            }
                        }

                        // [Fix] Dynamic Font Sizing for Overlay Items
                        const dynamicFontSize = calculateDynamicFontSize([displayText]);

                        const defaultTextColor = isTextureMode ? 'rgba(28, 35, 51, 0.90)' : '#ffffff';
                        const displayColor = (isEditMode && overlayCol.color) ? overlayCol.color : defaultTextColor;

                        const textStyle: React.CSSProperties = {
                            color: hasInput ? (displayScore < 0 ? '#f87171' : displayColor) : '#475569',
                            fontSize: dynamicFontSize, // Apply dynamic font size
                            ...(isEditMode && overlayCol.color && isColorDark(overlayCol.color) && { textShadow: ENHANCED_TEXT_SHADOW }),
                            ...(isTextureMode && {
                                fontFamily: '"Kalam", "Caveat", cursive',
                                transform: `rotate(${((p.id.charCodeAt(0) + overlayCol.id.charCodeAt(0)) % 5) - 2}deg)`,
                                mixBlendMode: 'multiply',
                                textShadow: 'none',
                            })
                        };
                        
                        if (!overlayCol.contentLayout) return null;

                        return (
                            <div key={overlayCol.id} className="absolute inset-0 pointer-events-none">
                                <div 
                                    onClick={(e) => { e.stopPropagation(); onCellClick(p.id, overlayCol.id, e); }}
                                    className={`
                                        absolute flex items-center justify-center 
                                        border-2 rounded-md cursor-pointer transition-all pointer-events-auto
                                        ${isOverlayActive 
                                            ? 'border-emerald-500 bg-emerald-500/20 ring-1 ring-emerald-500' // Active Style
                                            : (isEditMode 
                                                ? 'border-dashed border-white/40 hover:border-white/60 hover:bg-white/5' // Edit Mode
                                                : (!isTextureMode 
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
                                        borderColor: (!isOverlayActive && isEditMode && overlayCol.color) ? `${overlayCol.color}60` : undefined,
                                        containerType: 'size', // [Fix] Enable Container Queries for dynamic sizing
                                    } as React.CSSProperties}
                                >
                                    <span className="font-bold tracking-tight w-full text-center truncate px-1" style={textStyle}>
                                        {displayText}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
              );})}
            </div>
          );
        })}
        
        {/* [New Feature] Add Blank Column Button in Edit Mode */}
        {isEditMode && (
            <div className="flex relative z-10 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Left Sticky Add Button */}
                <div 
                    className="sticky left-0 bg-slate-900 border-r border-b border-slate-700 flex items-center justify-center p-2 z-20 shrink-0"
                    style={itemColStyle} 
                >
                    <button 
                        onClick={onAddColumn}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-emerald-500 border border-slate-600 hover:border-emerald-500/50 flex items-center justify-center transition-all active:scale-95 shadow-sm group"
                        title="新增空白項目"
                    >
                        <Plus size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
                
                {/* Right Empty Filler - Spans full width */}
                <div className="flex-1 bg-slate-900 border-b border-slate-800/50 min-h-[3rem]" />
            </div>
        )}

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
