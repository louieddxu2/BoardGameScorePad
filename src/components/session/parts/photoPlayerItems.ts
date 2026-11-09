import type { Player, ScoreColumn } from '../../../types';
import { calculateColumnScore, getAutoColumnError, resolveSelectedOptions } from '../../../utils/scoring';
import { formatDisplayNumber } from '../../../utils/scoreDisplay';

interface PhotoItemHeading {
  id: string;
  name: string;
  color?: string;
}

export type PhotoItemValue = { value: string } | { labels: Array<{ id: string; text: string; color: string }> };

// Match the input button's option / column / default background precedence.
const DEFAULT_PHOTO_LABEL_COLOR = 'rgb(var(--c-white))';

/** Resolve values against the same column definitions and scoring context as the grid. */
function getPhotoItemValue(column: ScoreColumn, player: Player, columns: ScoreColumn[], players: Player[]): PhotoItemValue | undefined {
  const context = { allColumns: columns, playerScores: player.scores, allPlayers: players };
  const score = player.scores[column.id];
  const options = resolveSelectedOptions(column, score);
  if (options.length) {
    return { labels: options.map(option => ({
      id: option.id, text: option.label, color: option.color || column.color || DEFAULT_PHOTO_LABEL_COLOR,
    })) };
  }
  const parts = score?.parts ?? [];
  if (!column.isAuto && parts.length === 0) return undefined;
  const error = getAutoColumnError(column, context);
  return { value: error ? 'ERR' : formatDisplayNumber(calculateColumnScore(column, parts, context, score)) };
}

export function getPhotoItemRows(columns: ScoreColumn[], players: (Player & { isAnonymous?: boolean })[]) {
  const individual: (PhotoItemHeading & { values: Map<string, PhotoItemValue> })[] = [];
  const shared: (PhotoItemHeading & { value: PhotoItemValue })[] = [];
  const visiblePlayers = players.filter(player => !player.isAnonymous);

  for (const column of columns) {
    if (!column.showInPhoto) continue;
    const heading = { id: column.id, name: column.name, color: column.color };
    const values = new Map<string, PhotoItemValue>();
    for (const player of visiblePlayers) {
      const value = getPhotoItemValue(column, player, columns, players);
      if (!value) continue;
      if (column.isShared) {
        // A shared input is stored per player. Use the first value eligible for export.
        shared.push({ ...heading, value });
        break;
      }
      values.set(player.id, value);
    }
    if (values.size > 0) individual.push({ ...heading, values });
  }

  return { individual, shared };
}
