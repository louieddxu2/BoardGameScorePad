import type { Player, ScoreColumn } from '../../../types';
import { calculateColumnScore, getAutoColumnError, resolveSelectedOptions } from '../../../utils/scoring';
import { formatDisplayNumber } from '../../../utils/scoreDisplay';

export interface PhotoPlayerItem {
  id: string;
  name: string;
  value?: string;
  labels?: Array<{ id: string; text: string; color: string }>;
}

// Match the input button's option / column / default background precedence.
export const DEFAULT_PHOTO_LABEL_COLOR = 'rgb(var(--c-white))';

/** Resolve values against the same column definitions and scoring context as the grid. */
export function getPhotoPlayerItems(player: Player, columns: ScoreColumn[], players: Player[]): PhotoPlayerItem[] {
  const context = { allColumns: columns, playerScores: player.scores, allPlayers: players };
  return columns.flatMap<PhotoPlayerItem>(column => {
    if (!column.showInPhoto) return [];
    const score = player.scores[column.id];
    const options = resolveSelectedOptions(column, score);
    if (options.length) {
      return [{ id: column.id, name: column.name, labels: options.map(option => ({
        id: option.id, text: option.label, color: option.color || column.color || DEFAULT_PHOTO_LABEL_COLOR,
      })) }];
    }
    const parts = score?.parts ?? [];
    if (!column.isAuto && parts.length === 0) return [];
    const error = getAutoColumnError(column, context);
    const value = error ? 'ERR' : formatDisplayNumber(calculateColumnScore(column, parts, context, score));
    return [{ id: column.id, name: column.name, value }];
  });
}
