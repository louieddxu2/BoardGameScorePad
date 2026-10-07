import React from 'react';
import type { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import type { useColumnDragAndDrop } from '../hooks/useColumnDragAndDrop';
import ScoreCell from './ScoreCell';
import TexturedBlock from './TexturedBlock';
import { GripVertical, Settings } from 'lucide-react';
import { ContrastText } from '../../shared/ContrastText';
import { injectSoftHyphens } from '../../../utils/text';
import { buildScoreGridOverlay } from './buildScoreGridOverlay';

type ProcessedScoreColumn = ScoreColumn & { resolvedDisplayMode: string; overlayColumns: ScoreColumn[] };

interface ScoreGridRowsOptions {
  processedColumns: ProcessedScoreColumn[];
  session: GameSession;
  template: GameTemplate;
  dnd: ReturnType<typeof useColumnDragAndDrop>;
  dragIndex: number;
  isEditMode: boolean;
  isTextureMode: boolean;
  headerRowWidth: number | string;
  baseImage?: string;
  itemColStyle: React.CSSProperties;
  getDragHandlers: (colId: string) => React.HTMLAttributes<HTMLElement>;
  renderIndicators: (col: ScoreColumn, isHidden: boolean, isOverlay: boolean) => React.ReactNode;
  aiStatus?: string;
  onColumnHeaderClick: (event: React.MouseEvent, col: ScoreColumn) => void;
  onCellClick: (playerId: string, colId: string, event: React.MouseEvent) => void;
  editingCell: { playerId: string; colId: string } | null;
  leftColWidth: number;
  minPlayerWidth: number;
  containerWidth: number;
  previewValue?: any;
  canEditScore: (playerId: string, column: ScoreColumn | undefined) => boolean;
  editablePlayerIds: string[];
}

/** Preserve row keys, DOM nesting and event handlers while separating row rendering. */
export function buildScoreGridRows({
  processedColumns, session, template, dnd, dragIndex, isEditMode, isTextureMode, headerRowWidth, baseImage,
  itemColStyle, getDragHandlers, renderIndicators, aiStatus, onColumnHeaderClick, onCellClick, editingCell,
  leftColWidth, minPlayerWidth, containerWidth, previewValue, canEditScore, editablePlayerIds
}: ScoreGridRowsOptions) {
  return processedColumns.map((col, index) => {
    const isDragging = dnd.draggingId === col.id;
    const isDropTarget = dnd.dropTargetId === col.id;
    const displayMode = col.resolvedDisplayMode as 'row' | 'overlay' | 'hidden';

    const isAlt = index % 2 !== 0;
    const isHidden = displayMode === 'hidden';
    const isOverlay = displayMode === 'overlay';

    let indicator = null;

    if (isEditMode && dnd.draggingId && isDropTarget) {
      if (isDragging) {
        indicator = <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-txt-muted/50 bg-txt-muted/5" />;
      } else if (dragIndex < template.columns.findIndex(c => c.id === col.id)) {
        indicator = <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-brand-primary shadow-[0_0_8px_theme(colors.brand.primary/80%)] z-50 pointer-events-none rounded-full translate-y-1/2" />;
      } else {
        indicator = <div className="absolute top-0 left-0 right-0 h-[4px] bg-brand-primary shadow-[0_0_8px_theme(colors.brand.primary/80%)] z-50 pointer-events-none rounded-full -translate-y-1/2" />;
      }
    }

    const rowHiddenClass = (isEditMode && displayMode === 'hidden') ? 'opacity-70 bg-app-bg/50' : '';
    // Preserve the original hidden-row utility tokens for Tailwind's static scanner.
    const hiddenStyleClass = (isEditMode && isHidden) ? 'ring-2 ring-status-warning/50 ring-inset bg-status-warning/20' : '';

    const headerBg = isEditMode && isDragging
      ? 'rgb(var(--c-surface-hover))'
      : (isAlt && !isTextureMode ? 'rgb(var(--c-grid-cell-bg-alt))' : 'rgb(var(--c-grid-cell-bg))');

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
          onClick={(e: any) => {
            if (aiStatus === 'compressing' || aiStatus === 'generating') return;
            onColumnHeaderClick(e, col);
          }}
          {...getDragHandlers(col.id)}
          className={`sticky left-0 border-r-2 border-b border-surface-border flex flex-col justify-center transition-colors z-20 group select-none shrink-0 overflow-hidden ${isEditMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab hover:bg-surface-hover') : 'cursor-default'} ${isTextureMode ? 'p-0' : 'p-2'} `}
          style={{
            ...itemColStyle,
            backgroundColor: headerBg,
            borderRightColor: col.color || 'var(--c-surface-border)'
          }}
          fallbackContent={
            <>
              <ContrastText
                className="text-sm font-bold text-txt-secondary w-full text-center break-words whitespace-pre-wrap leading-tight hyphenate"
                color={col.color || 'inherit'}
              >
                {injectSoftHyphens(col.name)}
              </ContrastText>
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
          {isEditMode && isTextureMode && <div className="absolute top-1/2 left-0.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded p-0.5 text-white/70"><GripVertical size={10} /></div>}
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
              data-score-cell={`${session.players[0].id}:${col.id}`}
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
                onClick={(e) => {
                  if (aiStatus === 'compressing' || aiStatus === 'generating') return;
                  onCellClick(session.players[0].id, col.id, e);
                }} // 點下去還是當作點 Player 0，InputPanel 也會認得這個 col 是 shared
                isEditMode={isEditMode}
                limitX={template.globalVisuals?.rightMaskRect?.x}
                isAlt={isAlt}
                previewValue={editingCell?.colId === col.id ? previewValue : undefined}
                forceWidth="100%"
                isReadOnly={!canEditScore(session.players[0].id, col)}
                isEditable={false}
              />
              {/* 疊加的 Overlay 也一併在此渲染 (例如公式、文字顯示) */}
              {col.overlayColumns.map(overlayCol => buildScoreGridOverlay({
                overlayCol, player: session.players[0], template, allPlayers: session.players,
                isOverlayActive: editingCell?.colId === overlayCol.id,
                isTextureMode, isEditMode, onCellClick
              }))}
            </div>
          </div>
        ) : (
          session.players.map((p, pIdx) => {
            const isActive = editingCell?.playerId === p.id && editingCell?.colId === col.id;
            const isParticipantEditableColumn = editablePlayerIds.includes(p.id) && p.color !== 'transparent';

            return (
              <div key={p.id} className={`${rowHiddenClass} w-full relative player-col-${p.id}`} data-score-cell={`${p.id}:${col.id}`}>
                <ScoreCell
                  player={p}
                  playerIndex={pIdx}
                  column={col}
                  allColumns={template.columns}
                  allPlayers={session.players}
                  baseImage={baseImage}
                  isActive={isActive}
                  onClick={(e) => {
                    if (aiStatus === 'compressing' || aiStatus === 'generating') return;
                    onCellClick(p.id, col.id, e);
                  }}
                  isEditMode={isEditMode}
                  limitX={template.globalVisuals?.rightMaskRect?.x}
                  isAlt={isAlt}
                  previewValue={isActive ? previewValue : undefined}
                  isReadOnly={!canEditScore(p.id, col)}
                  isEditable={false}
                />
                {isParticipantEditableColumn && (
                  <>
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 z-20 w-2 pointer-events-none blur-[3px]"
                      style={{ backgroundImage: `linear-gradient(to right, ${p.color}, transparent)`, opacity: 0.42 }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 right-0 z-20 w-2 pointer-events-none blur-[3px]"
                      style={{ backgroundImage: `linear-gradient(to left, ${p.color}, transparent)`, opacity: 0.42 }}
                    />
                  </>
                )}
                {col.overlayColumns.map(overlayCol => buildScoreGridOverlay({
                  overlayCol, player: p, template, allPlayers: session.players,
                  isOverlayActive: editingCell?.playerId === p.id && editingCell?.colId === overlayCol.id,
                  isTextureMode, isEditMode, onCellClick
                }))}
              </div>
            );
          })
        )}
      </div>
    );
  });
}
