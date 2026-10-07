
import React, { useMemo, useState, useEffect } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { EyeOff, Layers, Sparkles, Settings, Sigma, X } from 'lucide-react';
import { buildScoreGridRows } from './buildScoreGridRows';
import TexturedPlayerHeader from './TexturedPlayerHeader';
import TexturedBlock from './TexturedBlock';
import GridFooter from './GridFooter';
import { useSessionTranslation } from '../../../i18n/session';
import SimpleScorepadPromo from './SimpleScorepadPromo';
import { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import { usePlayerWidthSync } from '../../../hooks/usePlayerWidthSync';

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
  onOpenBatchAdd?: () => void;
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
  onOpenOnlineSearch?: () => void;
  onOpenAiPrompt?: () => void;
  aiStatus?: string;
  simpleFlashStatus?: string;
  simpleGemmaStatus?: string;
  elapsedTime?: number;
  panelDockOffset: string;
  canEditScore?: (playerId: string, column: ScoreColumn | undefined) => boolean;
  participantClaimCounts?: Record<string, number>;
  editablePlayerIds?: string[];
  canManageParticipantClaims?: boolean;
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
  onOpenBatchAdd,
  onOpenSettings,
  onToggleToolbox, // [New]
  isToolboxOpen,   // [New]
  scrollContainerRef,
  contentRef,
  baseImage,
  isEditMode,
  zoomLevel,
  previewValue,
  onOpenOnlineSearch,
  onOpenAiPrompt,
  aiStatus,
  simpleFlashStatus,
  simpleGemmaStatus,
  elapsedTime,
  panelDockOffset,
  canEditScore = () => true,
  participantClaimCounts = {},
  editablePlayerIds = [],
  canManageParticipantClaims = false,
}) => {
  const { t } = useSessionTranslation();
  const dnd = useColumnDragAndDrop({ template, onUpdateTemplate, scrollRef: scrollContainerRef });

  const isScoresEmpty = useMemo(() => {
    return session.players.every(p => {
      if (!p.scores) return true;
      return Object.values(p.scores).every(scoreData => {
        if (!scoreData) return true;
        return !scoreData.parts || scoreData.parts.length === 0;
      });
    });
  }, [session.players]);

  const isInitialSimpleScorepad = template.columns.length === 0 && isScoresEmpty;

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
      onTouchCancel: dnd.handleTouchCancel,
    };
  };

  const renderIndicators = (col: ScoreColumn, isHidden: boolean, isOverlay: boolean) => {
    if (!isEditMode) return null;
    return (
      <>
        <div className="absolute top-0.5 right-0.5 flex gap-0.5 z-20">
          {isHidden && <div className="bg-modal-backdrop/60 rounded p-0.5 text-status-warning backdrop-blur-sm border border-status-warning/30" title={t('grid_hidden')}><EyeOff size={10} /></div>}
          {isOverlay && <div className="bg-modal-backdrop/60 rounded p-0.5 text-status-info backdrop-blur-sm border border-status-info/30" title={t('grid_overlay')}><Layers size={10} /></div>}
        </div>
        {!col.isScoring && <div className="absolute bottom-0.5 left-0.5 z-20 bg-modal-backdrop/60 rounded p-0.5 backdrop-blur-sm border border-status-warning/30" title={t('input_not_scored')}><div className="relative w-2.5 h-2.5 flex items-center justify-center"><Sigma size={10} className="text-txt-muted opacity-50" /><X size={8} className="absolute -bottom-0.5 -right-0.5 text-status-warning" strokeWidth={3} /></div></div>}
        <div className="absolute bottom-0.5 right-0.5 z-20 flex gap-0.5">{col.isAuto && <div className="bg-modal-backdrop/60 rounded p-0.5 text-brand-secondary backdrop-blur-sm border border-brand-secondary/30" title={t('input_auto_calc')}><Sparkles size={10} /></div>}</div>
      </>
    );
  };

  const minPlayerWidth = 54 * zoomLevel;
  const requiredRowWidth = leftColWidth + (session.players.length * minPlayerWidth);
  const headerRowWidth = containerWidth ? Math.max(containerWidth, requiredRowWidth) : '100%';

  return (
    <div 
      className={`absolute inset-0 z-0 bg-app-bg no-scrollbar ${
        isInitialSimpleScorepad ? 'h-full flex flex-col overflow-hidden pb-0' : 'overflow-auto pb-32'
      }`} 
      ref={scrollContainerRef}
      onDragOver={(e) => {
        // Rows handle their own targets; other grid areas keep the shown line.
        if (isEditMode && !e.defaultPrevented) dnd.handleDragOver(e);
      }}
      onDrop={(e) => {
        if (isEditMode && !e.defaultPrevented) dnd.handleDrop(e);
      }}
      >
        <div
          id="live-grid-container"
          className={`min-w-full w-fit relative ${isInitialSimpleScorepad ? 'h-full flex flex-col' : ''}`}
          ref={contentRef}
        >
        {/* Player Headers */}
        <div
          id="live-player-header-row"
          className="flex sticky top-0 z-20 shadow-sm transition-all duration-200"
          style={{ 
            width: typeof headerRowWidth === 'number' ? `${headerRowWidth}px` : headerRowWidth,
            backgroundColor: 'rgb(var(--c-grid-cell-bg))'
          }}
        >
          <TexturedBlock
            baseImage={baseImage}
            rect={template.globalVisuals?.playerLabelRect}
            fallbackContent={<span className="font-bold text-sm text-txt-muted">{t('grid_player')}</span>}
            onClick={isEditMode && onOpenSettings ? onOpenSettings : undefined}
            className={`sticky left-0 border-r border-b border-surface-border flex items-center justify-center z-30 shadow-sm shrink-0 overflow-hidden ${isTextureMode ? 'p-0' : 'p-2'} ${isEditMode ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
            style={{ 
                ...itemColStyle,
                backgroundColor: 'rgb(var(--c-grid-cell-bg))'
            }}
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
              participantCount={participantClaimCounts[p.id] ?? 0}
              isEditableByParticipant={editablePlayerIds.includes(p.id)}
              canManageParticipantClaims={canManageParticipantClaims}
              limitX={template.globalVisuals?.rightMaskRect?.x}
            />
          ))}
        </div>

        {/* Rows and Hints Container (Grayscale/Disabled on AI generating) */}
        <div className={(aiStatus === 'compressing' || aiStatus === 'generating') ? "pointer-events-none opacity-50 select-none filter grayscale-[20%] transition-all duration-300" : ""}>

          {buildScoreGridRows({
            processedColumns, session, template, dnd, dragIndex, isEditMode, isTextureMode, headerRowWidth, baseImage, itemColStyle, getDragHandlers,
            renderIndicators, aiStatus, onColumnHeaderClick, onCellClick, editingCell, leftColWidth, minPlayerWidth, containerWidth, previewValue, canEditScore, editablePlayerIds
          })}


        </div>

        {/* Footer Area */}
        <GridFooter
          isEditMode={isEditMode}
          onAddColumn={onAddColumn}
          onOpenBatchAdd={onOpenBatchAdd}
          itemColStyle={itemColStyle}
          showToolboxButton={showToolboxButton} // [New]
          isToolboxOpen={!!isToolboxOpen}      // [New]
          onToggleToolbox={onToggleToolbox || (() => { })} // [New]
          isGenerating={aiStatus === 'compressing' || aiStatus === 'generating'}
        />

        {(aiStatus === 'compressing' || aiStatus === 'generating' || aiStatus === 'success') && template.columns.length > 0 ? (
          <div 
            onClick={() => {
              if (aiStatus === 'success') {
                onOpenAiPrompt?.();
              }
            }}
            className={`mx-6 my-4 z-10 flex flex-col items-center p-6 rounded-xl border relative overflow-hidden select-none animate-in fade-in duration-300 ${
              aiStatus === 'success'
                ? 'border-status-success/30 bg-status-success/5 shadow-md shadow-status-success/5 cursor-pointer hover:bg-status-success/10 active:scale-[0.99] transition-all'
                : 'border-brand-primary/20 bg-brand-primary/5 backdrop-blur-sm shadow-md'
            }`}
            style={template.columns.length > 0 ? { marginLeft: `${leftColWidth + 16}px`, marginRight: '16px' } : undefined}
          >
            {/* 流光裝飾背景 */}
            <div className={`absolute inset-0 animate-pulse pointer-events-none ${
              aiStatus === 'success'
                ? 'bg-gradient-to-r from-status-success/5 via-brand-secondary/5 to-status-success/5'
                : 'bg-gradient-to-r from-brand-primary/5 via-brand-secondary/5 to-brand-primary/5'
            }`} />
            
            {/* Gemini 霓虹流光條 */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 animate-pulse ${
              aiStatus === 'success'
                ? 'bg-gradient-to-r from-status-success via-brand-secondary to-status-success'
                : 'bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary'
            }`} />
            
            <div className="relative flex flex-col items-center gap-4 text-center z-10">
              <div className="relative flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full animate-ping scale-110 ${
                  aiStatus === 'success' ? 'bg-status-success/20' : 'bg-brand-primary/20'
                }`} />
                <div className={`relative rounded-full border shadow-md flex items-center justify-center w-14 h-14 ${
                  aiStatus === 'success'
                    ? 'bg-status-success/10 text-status-success border-status-success/30'
                    : 'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
                }`}>
                  <Sparkles size={24} className="animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <h4 className="text-txt-primary font-black text-sm tracking-wide flex items-center justify-center gap-2">
                  {aiStatus === 'success' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                      {t('session_ai_success_status' as any)}
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping" />
                      {t('session_ai_waiting_status') || 'AI score grid generating...'}
                    </>
                  )}
                </h4>
                {aiStatus === 'success' ? (
                  <p className="text-[11px] text-txt-muted leading-relaxed font-medium max-w-[280px]">
                    {t('session_ai_success_status_detail' as any)}
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-txt-muted leading-relaxed font-mono font-medium max-w-[280px]">
                      {(t('session_ai_waiting_timer') || 'Analyzing, elapsed {seconds}s...').replace('{seconds}', (elapsedTime || 0).toString())}
                    </p>
                    <p className="text-[10px] text-brand-primary font-semibold leading-relaxed max-w-[280px]">
                      {t('session_ai_waiting_status_detail')}
                    </p>
                    <p className="text-[10px] text-status-warning font-semibold leading-relaxed max-w-[280px]">
                      {t('session_ai_keep_awake_hint')}
                    </p>
                  </>
                )}
              </div>

              {aiStatus !== 'success' && (
                <div className="flex gap-1.5 items-center justify-center py-1 bg-black/10 rounded-full px-3 border border-white/5">
                  <div className="w-1 h-1 rounded-full bg-brand-primary animate-bounce delay-100" />
                  <div className="w-1 h-1 rounded-full bg-brand-secondary animate-bounce delay-200" />
                  <div className="w-1 h-1 rounded-full bg-brand-primary animate-bounce delay-300" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <SimpleScorepadPromo
            isInitialSimpleScorepad={isInitialSimpleScorepad}
            leftColWidth={leftColWidth}
            onOpenOnlineSearch={onOpenOnlineSearch}
            onOpenAiPrompt={onOpenAiPrompt}
            aiStatus={aiStatus}
            simpleFlashStatus={simpleFlashStatus}
            simpleGemmaStatus={simpleGemmaStatus}
            elapsedTime={elapsedTime}
            zoomLevel={zoomLevel}
            isEditMode={isEditMode}
          />
        )}

        {!isInitialSimpleScorepad && (
          <div
            data-row-id={lastColId}
            onDragOver={(e) => { if (isEditMode && lastColId) dnd.handleDragOver(e, lastColId); }}
            onDrop={(e) => { if (isEditMode && lastColId) dnd.handleDrop(e, lastColId); }}
            className={`w-full bg-app-bg ${(editingCell || editingPlayerId || (!baseImage && template.columns.length < 5) || isToolboxOpen) ? 'h-[40vh]' : 'h-24'}`}
            style={{ marginBottom: panelDockOffset }}
          />
        )}
      </div>
    </div>
  );
};

export default ScoreGrid;
