import { GameSession, GameTemplate } from '../../types';
import { calculatePlayerTotal } from '../../utils/scoring';

export interface ScoreInputCell {
  playerId: string;
  colId: string;
}

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

  if ((column.formula || '').includes('+next')) {
    return column.formula.includes('×a2') ? { factors: [0, 1] } : 0;
  }

  const existingScore = player.scores[cell.colId];
  if (column.formula === 'a1×a2') {
    return { factors: existingScore?.parts || [0, 1] };
  }

  return { value: existingScore?.parts?.[0] ?? 0 };
};
