import type { GameSession, GameTemplate, ScoreColumn, ScoreValue } from '../../types';
import { calculatePlayerTotal } from '../../utils/scoring';
import { hasSecondFactor, isSumPartsFormula } from '../../utils/scoreColumnFormula';

export interface ScoreInputCell {
  playerId: string;
  colId: string;
}

export const getColumnInputPreviewValue = (column: ScoreColumn, score?: ScoreValue) => {
  if (isSumPartsFormula(column.formula)) {
    return hasSecondFactor(column.formula) ? { factors: [0, 1] } : 0;
  }
  if (column.formula === 'a1×a2') {
    return { factors: score?.parts || [0, 1] };
  }
  return { value: score?.parts?.[0] ?? 0 };
};

export const getInitialScoreInputPreviewValue = (
  session: GameSession,
  template: GameTemplate,
  cell: ScoreInputCell | null,
): any => {
  if (!cell) return 0;

  const player = session.players.find((candidate) => candidate.id === cell.playerId);
  if (!player) return 0;

  if (cell.colId === '__TOTAL__') {
    return calculatePlayerTotal(player, template, session.players);
  }

  const column = template.columns.find((candidate) => candidate.id === cell.colId);
  if (!column) return 0;

  return getColumnInputPreviewValue(column, player.scores[cell.colId]);
};
