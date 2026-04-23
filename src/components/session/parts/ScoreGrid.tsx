
import React, { useMemo, useState, useEffect } from 'react';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../../types';
import { GripVertical, EyeOff, Layers, Sparkles, Settings, Sigma, X } from 'lucide-react';
import ScoreCell from './ScoreCell';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedBlock from './TexturedBlock';
import GridFooter from './GridFooter';
import { useSessionTranslation } from '../../../i18n/session';
import { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import { isColorDark, ENHANCED_TEXT_SHADOW, getContrastTextShadow, getCurrentTheme } from '../../../utils/ui';
import { usePlayerWidthSync } from '../../../hooks/usePlayerWidthSync';
import { calculateColumnScore, resolveSelectOption } from '../../../utils/scoring';
import { calculateDynamicFontSize } from '../../../utils/dynamicLayout';
import { injectSoftHyphens } from '../../../utils/text';
import { formatDisplayNumber } from '../../../utils/scoreDisplay';

interface ScoreGridProps {
  session: GameSession;
  template: GameTemplate;
  editingCell: { playerId: string, colId: string } | null;
  editingPlayerId: string | null;
  onCellClick: (playerId: string, colId: string, e: React.MouseEvent) => void;
  onPlayerHeaderClick: (playerId: string, e: React.MouseEvent) => void;
  onColumnHeaderClick: (e: React.MouseEvent, col: ScoreColumn) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onAddColumn: () => void;
  onOpenSettings?: () => void; // Made optional for robustness
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  baseImage?: string;
  isEditMode: boolean;
  zoomLevel: number;
  previewValue?: any;
  // [New Props]
  onToggleToolbox?: () => void;
  isToolboxOpen?: boolean;
}

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
  onOpenSettings,
  onToggleToolbox, // [New]
  isToolboxOpen,   // [New]
  scrollContainerRef,
  contentRef,
  baseImage,
  isEditMode,
  zoomLevel,
  previewValue,
}) => {
  const { t } = useSessionTranslation();
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate, scrollRef: scrollContainerRef });
  const [imageDims, setImageDims] = useState<{ width: number, height: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const isTextureMode = !!baseImage;

  // [Logic] Determine if the list is "Long" (needs toolbox button)
  // Short list = No image AND columns < 5.
  // So Long list = Image OR columns >= 5.
  const showToolboxButton = useMemo(() => {
    return !!baseImage || template.columns.length >= 5;
  }, [baseImage, template.columns.length]);

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

  const leftColWidth = useMemo(() => {
    if (isTextureMode && imageDims && template.globalVisuals?.playerLabelRect) {
      const { playerLabelRect } = template.globalVisuals;
      const itemColProportion = playerLabelRect.width;
      return containerWidth * itemColProportion * zoomLevel;
    }

    if (containerWidth > 0) {
      return Math.max(70, containerWidth / (session.players.length + 2));
    }

    return 70;
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
          {isHidden && <div className="bg-[rgba(var(--c-black)/0.6)] rounded p-0.5 text-status-warning backdrop-blur-sm border border-status-warning/30" title={t('grid_hidden')}><EyeOff size={10} /></div>}
          {isOverlay && <div className="bg-[rgba(var(--c-black)/0.6)] rounded p-0.5 text-status-info backdrop-blur-sm border border-status-info/30" title={t('grid_overlay')}><Layers size={10} /></div>}
        </div>
        {!col.isScoring && <div className="absolute bottom-0.5 left-0.5 z-20 bg-[rgba(var(--c-black)/0.6)] rounded p-0.5 backdrop-blur-sm border border-status-warning/30" title={t('input_not_scored')}><div className="relative w-2.5 h-2.5 flex items-center justify-center"><Sigma size={10} className="text-txt-muted opacity-50" /><X size={8} className="absolute -bottom-0.5 -right-0.5 text-status-warning" strokeWidth={3} /></div></div>}
        <div className="absolute bottom-0.5 right-0.5 z-20 flex gap-0.5">{col.isAuto && <div className="bg-[rgba(var(--c-black)/0.6)] rounded p-0.5 text-brand-secondary backdrop-blur-sm border border-brand-secondary/30" title={t('input_auto_calc')}><Sparkles size={10} /></div>}</div>
      </>
    );
  };

  const minPlayerWidth = 54 * zoomLevel;
  const requiredRowWidth = leftColWidth + (session.players.length * minPlayerWidth);
  const headerRowWidth = containerWidth ? Math.max(containerWidth, requiredRowWidth) : '100%';

  return (
    <div className="absolute inset-0 z-0 overflow-auto bg-app-bg no-scrollbar pb-32" ref={scrollContainerRef}>
      <div
        id="live-grid-container"
        className="min-w-full w-fit relative"
        ref={contentRef}
      >
        {/* Player Headers */}
        <div
          id="live-player-header-row"
          className="flex sticky top-0 z-20 modal-bg-elevated shadow-sm transition-all duration-200"
          style={{ width: typeof headerRowWidth === 'number' ? `${headerRowWidth}px` : headerRowWidth }}
        >
          <TexturedBlock
            baseImage={baseImage}
            rect={template.globalVisuals?.playerLabelRect}
            fallbackContent={<span className="font-bold text-sm text-txt-muted">{t('grid_player')}</span>}
            onClick={isEditMode && onOpenSettings ? onOpenSettings : undefined}
            className={`sticky left-0 modal-bg-elevated border-r border-b border-surface-border flex items-center justify-center z-30 shadow-sm shrink-0 overflow-hidden ${isTextureMode ? 'p-0' : 'p-2'} ${isEditMode ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
            style={itemColStyle}
          >
            {/* Gear Icon: Visual Cue for Settings */}
            {isEditMode && (
              <div className="absolute top-1 left-1 text-status-warning z-50 pointer-events-none drop-shadow-md">
                <Settings size={14} />
              </div>
            )}
          </TexturedBlock>

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

          const isAlt = index % 2 !== 0;
          const isHidden = displayMode === 'hidden';
          const isOverlay = displayMode === 'overlay';

          let indicator = null;

          if (isEditMode && dnd.draggingId && isDropTarget) {
            if (isDragging) {
                <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-txt-muted/50 bg-txt-muted/5" />
            } else if (dragIndex < template.columns.findIndex(c => c.id === col.id)) {
                <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-brand-primary shadow-[0_0_8px_rgba(var(--c-brand-primary)/0.8)] z-50 pointer-events-none rounded-full translate-y-1/2" />
            } else {
                <div className="absolute top-0 left-0 right-0 h-[4px] bg-brand-primary shadow-[0_0_8px_rgba(var(--c-brand-primary)/0.8)] z-50 pointer-events-none rounded-full -translate-y-1/2" />
            }
          }

          const rowHiddenClass = (isEditMode && displayMode === 'hidden') ? 'opacity-70 bg-app-bg/50' : '';
          const hiddenStyleClass = (isEditMode && isHidden) ? 'ring-2 ring-status-warning/50 ring-inset bg-status-warning/20' : '';

          const headerBgClass = isEditMode && isDragging
            ? 'bg-surface-hover'
            : (isAlt && !isTextureMode ? 'bg-surface-bg-alt/50' : 'modal-bg-elevated');

          return (
            <div
              key={col.id}
              id={`row-${col.id}`}
              data-row-id={col.id}
              onDragOver={(e) => isEditMode ? dnd.handleDragOver(e, col.id) : undefined}
              onDrop={(e) => isEditMode ? dnd.handleDrop(e, col.id) : undefined}
              className={`flex relative z-10 transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
              style={{ width: typeof headerRowWidth === 'number' ? `${headerRowWidth}px` : headerRowWidth }}
            >
              {indicator}

              <TexturedBlock
                baseImage={baseImage}
                rect={col.visuals?.headerRect}
                onClick={(e: any) => onColumnHeaderClick(e, col)}
                {...getDragHandlers(col.id)}
                className={`sticky left-0 ${headerBgClass} ${hiddenStyleClass} border-r-2 border-b border-surface-border flex flex-col justify-center transition-colors z-20 group select-none shrink-0 overflow-hidden ${isEditMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab hover:bg-surface-hover') : 'cursor-default'} ${isTextureMode ? 'p-0' : 'p-2'} `}
                style={{
                  ...itemColStyle,
                  borderRightColor: col.color || 'var(--c-surface-border)'
                }}
                fallbackContent={
                  <>
                    <span className="text-sm font-bold text-txt-secondary w-full text-center break-words whitespace-pre-wrap leading-tight hyphenate" style={{ ...(col.color && { color: col.color, ...(getContrastTextShadow(col.color) && { textShadow: getContrastTextShadow(col.color) }) }) }}>
                      {injectSoftHyphens(col.name)}
                    </span>
                    {col.isScoring && (
                      <div className="text-[10px] text-txt-muted mt-1 flex flex-col items-center justify-center w-full leading-none">
                        {(() => {
                          if (col.formula.includes('a1×a2') && col.subUnits) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span>{col.subUnits[0]}</span><span className="text-txt-muted text-[11px] mx-0.5">×</span><span>{col.subUnits[1]}</span></div>;
                          if (col.inputType === 'clicker' && !col.formula.includes('+next')) return <div className="flex items-center justify-center gap-1 flex-wrap w-full"><Settings size={10} />{col.unit && <span className="text-[11px] break-words text-center">{col.unit}</span>}</div>;
                          if (col.formula?.includes('×c1')) return <div className="flex items-center justify-center gap-0.5 flex-wrap w-full"><span className="break-words text-center">{col.unit}</span><span className="text-txt-muted text-[11px] mx-0.5">×</span><span className="text-brand-primary font-bold font-mono">{col.constants?.c1 ?? 1}</span></div>;
                          if (col.unit) return <span className="text-[11px] break-words w-full text-center">{col.unit}</span>;
                          return null;
                        })()}
                      </div>
                    )}
                  </>
                }
              >
                {renderIndicators(col, isHidden, isOverlay)}
                {isEditMode && isTextureMode && <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[rgba(var(--c-black)/0.4)] rounded p-0.5 text-[rgba(var(--c-white)/0.7)]"><GripVertical size={10} /></div>}
              </TexturedBlock>

              {/* Normal Players Row OR Shared Player Row */}
              {col.isShared && session.players.length > 0 ? (
                <div
                  className={`${rowHiddenClass} flex-1 relative shared-col-container flex`}
                  style={{
                    width: `${session.players.length * minPlayerWidth}px`, // Maintains internal ratio for scoring logic
                  }}
                >
                  <div
                    className="sticky z-10 flex items-center justify-center overflow-hidden"
                    style={{
                      left: leftColWidth,
                      width: `min(100%, ${containerWidth - leftColWidth}px)`,
                      // 這邊不再利用 100vw，而是用外層 scroll container 的 containerWidth 來限制可視區塊寬度
                      // 若玩家很少 (總寬度小於視窗寬度)，就乖乖維持在 100% (總寬度) 內置中。
                    }}
                  >
                    <ScoreCell
                      player={session.players[0]} // 只讀取第一個玩家的值作為顯示代表，不過 InputPanel 更新時記得要寫給所有人
                      playerIndex={0}
                      column={col}
                      allColumns={template.columns}
                      allPlayers={session.players}
                      baseImage={baseImage}
                      isActive={editingCell?.colId === col.id} // 只要此 column 處於編輯中就一起亮起來
                      onClick={(e) => onCellClick(session.players[0].id, col.id, e)} // 點下去還是當作點 Player 0，InputPanel 也會認得這個 col 是 shared
                      isEditMode={isEditMode}
                      limitX={template.globalVisuals?.rightMaskRect?.x}
                      isAlt={isAlt}
                      previewValue={editingCell?.colId === col.id ? previewValue : undefined}
                      forceWidth="100%"
                    />
                    {/* 疊加的 Overlay 也一併在此渲染 (例如公式、文字顯示) */}
                    {col.overlayColumns.map((overlayCol) => {
                      const isOverlayActive = editingCell?.colId === overlayCol.id;
                      const scoreData = session.players[0].scores[overlayCol.id];
                      const parts = scoreData?.parts || [];

                      // 略過複雜的顯示層次計算，因為這整段都是照抄原版玩家 Overlay，只是對應到共用欄位
                      const overlayContext = {
                        allColumns: template.columns,
                        playerScores: session.players[0].scores,
                        allPlayers: session.players
                      };
                      const displayScore = calculateColumnScore(overlayCol, parts, overlayContext, scoreData);

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

                      const dynamicFontSize = calculateDynamicFontSize([displayText]);
                      const defaultTextColor = isTextureMode ? 'rgba(var(--c-black)/0.9)' : 'rgb(var(--c-txt-primary))';
                      const displayColor = (isEditMode && overlayCol.color) ? overlayCol.color : defaultTextColor;

                      const textStyle: React.CSSProperties = {
                        color: hasInput ? (displayScore < 0 ? 'rgb(var(--c-status-danger))' : displayColor) : 'rgb(var(--c-txt-muted))',
                        fontSize: dynamicFontSize,
                        ...(isEditMode && overlayCol.color && isColorDark(overlayCol.color) && { textShadow: ENHANCED_TEXT_SHADOW }),
                        ...(isTextureMode && {
                          fontFamily: '"Kalam", "Caveat", cursive',
                          transform: `rotate(${((session.players[0].id.charCodeAt(0) + overlayCol.id.charCodeAt(0)) % 5) - 2}deg)`,
                          mixBlendMode: 'multiply',
                          textShadow: 'none',
                        })
                      };

                      // 如果沒有設定框選區域，我們依然允許它渲染，只是寬高預設為 100% (真的重疊上去)

                      return (
                        <div key={overlayCol.id} className="absolute inset-0 pointer-events-none">
                          <div
                            onClick={(e) => { e.stopPropagation(); onCellClick(session.players[0].id, overlayCol.id, e); }}
                            className={`
                                          absolute flex items-center justify-center 
                                          border-2 rounded-md cursor-pointer transition-all pointer-events-auto
                                          ${isOverlayActive
                                ? 'border-brand-primary bg-brand-primary/20 ring-1 ring-brand-primary'
                                : (isEditMode
                                  ? 'border-dashed border-txt-primary/40 hover:border-txt-primary/60 hover:bg-txt-primary/5'
                                  : (!isTextureMode
                                    ? 'border-dashed border-txt-primary/20 hover:border-txt-primary/40 hover:bg-txt-primary/5'
                                    : 'border-transparent hover:border-black/10 hover:bg-black/5')
                                )
                              }
                                      `}
                            style={{
                              left: overlayCol.contentLayout ? `${overlayCol.contentLayout.x}%` : undefined,
                              top: overlayCol.contentLayout ? `${overlayCol.contentLayout.y}%` : undefined,
                              width: overlayCol.contentLayout ? `${overlayCol.contentLayout.width}%` : '100%',
                              height: overlayCol.contentLayout ? `${overlayCol.contentLayout.height}%` : '100%',
                              borderColor: (!isOverlayActive && isEditMode && overlayCol.color) ? `${overlayCol.color}60` : undefined,
                              containerType: 'size',
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
                </div>
              ) : (
                session.players.map((p, pIdx) => {
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
                        const displayScore = calculateColumnScore(overlayCol, parts, overlayContext, p.scores[overlayCol.id]);

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

                        const dynamicFontSize = calculateDynamicFontSize([displayText]);

                        const defaultTextColor = isTextureMode ? 'rgba(var(--c-black)/0.9)' : 'rgb(var(--c-txt-primary))';
                        const displayColor = (isEditMode && overlayCol.color) ? overlayCol.color : defaultTextColor;

                        const textStyle: React.CSSProperties = {
                          color: hasInput ? (displayScore < 0 ? 'rgb(var(--c-status-danger))' : displayColor) : 'rgb(var(--c-txt-muted))',
                          fontSize: dynamicFontSize,
                          ...(isEditMode && overlayCol.color && isColorDark(overlayCol.color) && { textShadow: ENHANCED_TEXT_SHADOW }),
                          ...(isTextureMode && {
                            fontFamily: '"Kalam", "Caveat", cursive',
                            transform: `rotate(${((p.id.charCodeAt(0) + overlayCol.id.charCodeAt(0)) % 5) - 2}deg)`,
                            mixBlendMode: 'multiply',
                            textShadow: 'none',
                          })
                        };

                        // 如果沒有設定框選區域，我們依然允許它渲染，只是寬高預設為 100% (真的重疊上去)

                        return (
                          <div key={overlayCol.id} className="absolute inset-0 pointer-events-none">
                            <div
                              onClick={(e) => { e.stopPropagation(); onCellClick(p.id, overlayCol.id, e); }}
                              className={`
                                          absolute flex items-center justify-center 
                                          border-2 rounded-md cursor-pointer transition-all pointer-events-auto
                                          ${isOverlayActive
                                  ? 'border-brand-primary bg-brand-primary/20 ring-1 ring-brand-primary'
                                  : (isEditMode
                                    ? 'border-dashed border-[rgba(var(--c-txt-primary)/0.4)] hover:border-[rgba(var(--c-txt-primary)/0.6)] hover:bg-[rgba(var(--c-txt-primary)/0.05)]'
                                    : (!isTextureMode
                                      ? 'border-dashed border-[rgba(var(--c-txt-primary)/0.2)] hover:border-[rgba(var(--c-txt-primary)/0.4)] hover:bg-[rgba(var(--c-txt-primary)/0.05)]'
                                      : 'border-transparent hover:border-[rgba(var(--c-black)/0.1)] hover:bg-[rgba(var(--c-black)/0.05)]')
                                  )
                                }
                                      `}
                              style={{
                                left: overlayCol.contentLayout ? `${overlayCol.contentLayout.x}%` : undefined,
                                top: overlayCol.contentLayout ? `${overlayCol.contentLayout.y}%` : undefined,
                                width: overlayCol.contentLayout ? `${overlayCol.contentLayout.width}%` : '100%',
                                height: overlayCol.contentLayout ? `${overlayCol.contentLayout.height}%` : '100%',
                                borderColor: (!isOverlayActive && isEditMode && overlayCol.color) ? `${overlayCol.color}60` : undefined,
                                containerType: 'size',
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
                  );
                })
              )}
            </div>
          );
        })}

        {/* Footer Area */}
        <GridFooter
          isEditMode={isEditMode}
          onAddColumn={onAddColumn}
          itemColStyle={itemColStyle}
          showToolboxButton={showToolboxButton} // [New]
          isToolboxOpen={!!isToolboxOpen}      // [New]
          onToggleToolbox={onToggleToolbox || (() => { })} // [New]
        />

        <div
          data-row-id={lastColId}
          onDragOver={(e) => { if (isEditMode && lastColId) dnd.handleDragOver(e, lastColId); }}
          onDrop={(e) => { if (isEditMode && lastColId) dnd.handleDrop(e, lastColId); }}
          className={`w-full ${(editingCell || editingPlayerId || (!baseImage && template.columns.length < 5) || isToolboxOpen) ? 'h-[40vh]' : 'h-24'}`}
        />
      </div>
    </div>
  );
};

export default ScoreGrid;
