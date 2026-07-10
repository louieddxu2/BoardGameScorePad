import { GameSession, GameTemplate, Player, ScoreValue } from '../../types';
import { calculatePlayerTotal } from '../../utils/scoring';
import { calculateWinners } from '../../utils/templateUtils';

export type ScorePatchActor =
  | { role: 'host' }
  | { role: 'player'; playerId: string };

export interface ScoreValuePatch {
  actor: ScorePatchActor;
  targetPlayerId: string;
  colId: string;
  scoreValue: ScoreValue | null;
}

export type ScoreValuePatchRejectReason =
  | 'player_not_found'
  | 'column_not_found'
  | 'player_cannot_edit_other_player'
  | 'shared_column_requires_host'
  | 'auto_column_readonly'
  | 'invalid_score_value';

export type ScoreValuePatchResult =
  | { ok: true; session: GameSession }
  | { ok: false; reason: ScoreValuePatchRejectReason };

const isFiniteNumberArray = (value: unknown): value is number[] => {
  return Array.isArray(value) && value.every((part) => typeof part === 'number' && Number.isFinite(part));
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((part) => typeof part === 'string');
};

export const isValidScoreValue = (value: unknown): value is ScoreValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const score = value as Partial<ScoreValue>;
  if (!isFiniteNumberArray(score.parts)) return false;
  if (score.optionId !== undefined && typeof score.optionId !== 'string') return false;
  if (score.multiOptionIds !== undefined && !isStringArray(score.multiOptionIds)) return false;

  return true;
};

const cloneScoreValue = (value: ScoreValue): ScoreValue => ({
  parts: [...value.parts],
  ...(value.optionId !== undefined ? { optionId: value.optionId } : {}),
  ...(value.multiOptionIds !== undefined ? { multiOptionIds: [...value.multiOptionIds] } : {}),
});

const recalculateSession = (session: GameSession, template: GameTemplate): GameSession => {
  const playersWithTotals = session.players.map((player) => ({
    ...player,
    totalScore: calculatePlayerTotal(player, template, session.players),
  }));

  return {
    ...session,
    players: playersWithTotals,
    winnerIds: calculateWinners(playersWithTotals, session.scoringRule),
    lastUpdatedAt: Date.now(),
  };
};

export const applyScoreValuePatch = (
  session: GameSession,
  template: GameTemplate,
  patch: ScoreValuePatch
): ScoreValuePatchResult => {
  const column = template.columns.find((col) => col.id === patch.colId);
  if (!column) return { ok: false, reason: 'column_not_found' };

  const targetPlayer = session.players.find((player) => player.id === patch.targetPlayerId);
  if (!targetPlayer) return { ok: false, reason: 'player_not_found' };

  if (column.isAuto || column.inputType === 'auto') {
    return { ok: false, reason: 'auto_column_readonly' };
  }

  if (column.isShared && patch.actor.role !== 'host') {
    return { ok: false, reason: 'shared_column_requires_host' };
  }

  if (
    !column.isShared &&
    patch.actor.role === 'player' &&
    patch.actor.playerId !== patch.targetPlayerId
  ) {
    return { ok: false, reason: 'player_cannot_edit_other_player' };
  }

  if (patch.scoreValue !== null && !isValidScoreValue(patch.scoreValue)) {
    return { ok: false, reason: 'invalid_score_value' };
  }

  const updatedPlayers = session.players.map((player): Player => {
    if (!column.isShared && player.id !== patch.targetPlayerId) return player;

    const scores = { ...player.scores };
    if (patch.scoreValue === null) {
      delete scores[patch.colId];
    } else {
      scores[patch.colId] = cloneScoreValue(patch.scoreValue);
    }

    return { ...player, scores };
  });

  return {
    ok: true,
    session: recalculateSession({ ...session, players: updatedPlayers }, template),
  };
};
