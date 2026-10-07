import type React from 'react';
import type { GameTemplate, Player, ScoreColumn } from '../../../types';
import { calculateColumnScore, resolveSelectOption } from '../../../utils/scoring';
import { calculateDynamicFontSize } from '../../../utils/dynamicLayout';
import { formatDisplayNumber } from '../../../utils/scoreDisplay';
import { ContrastText } from '../../shared/ContrastText';
import TouchActionTarget from '../../shared/TouchActionTarget';

interface ScoreGridOverlayOptions {
  overlayCol: ScoreColumn;
  player: Player;
  template: GameTemplate;
  allPlayers: Player[];
  isOverlayActive: boolean;
  isTextureMode: boolean;
  isEditMode: boolean;
  onCellClick: (playerId: string, colId: string, event: React.MouseEvent) => void;
}

/** Return the existing keyed JSX without adding a component or gesture owner. */
export function buildScoreGridOverlay({
  overlayCol, player, template, allPlayers, isOverlayActive, isTextureMode, isEditMode, onCellClick
}: ScoreGridOverlayOptions) {
  const scoreData = player.scores[overlayCol.id];
  const parts = scoreData?.parts || [];

  const overlayContext = {
    allColumns: template.columns,
    playerScores: player.scores,
    allPlayers
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
  const defaultTextColor = isTextureMode ? 'rgb(var(--c-black) / 0.9)' : 'rgb(var(--c-txt-primary))';
  const displayColor = (isEditMode && overlayCol.color) ? overlayCol.color : defaultTextColor;
  // 如果沒有設定框選區域，我們依然允許它渲染，只是寬高預設為 100% (真的重疊上去)

  return (
    <div key={overlayCol.id} className="absolute inset-0 pointer-events-none">
      <TouchActionTarget
        onActivate={(event) => { event.stopPropagation(); onCellClick(player.id, overlayCol.id, event as unknown as React.MouseEvent); }}
        moveThreshold={10}
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
        <ContrastText
          className="font-bold tracking-tight w-full text-center truncate px-1"
          color={hasInput ? (displayScore < 0 ? 'rgb(var(--c-status-danger))' : displayColor) : 'rgb(var(--c-txt-muted))'}
          style={{ fontSize: dynamicFontSize }}
          isTextureMode={isTextureMode}
        >
          {displayText}
        </ContrastText>
      </TouchActionTarget>
    </div>
  );
}
