import { GameSession, GameTemplate, Player, ScoreValue } from '../../types';
import { recalculateScoreSession } from '../../utils/sessionScoring';

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

const mergeChangedFields = <T extends object>(current: T, previous: T, next: T, ignored: Array<keyof T>): T => {
  const result = { ...current };
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)] as Array<keyof T>);
  for (const key of keys) {
    if (ignored.includes(key) || previous[key] === next[key] || JSON.stringify(previous[key]) === JSON.stringify(next[key])) continue;
    if (Object.prototype.hasOwnProperty.call(next, key)) result[key] = next[key];
    else delete result[key];
  }
  return result;
};

/** Rebase an explicit local edit onto current inputs, never onto stale totals. */
export const mergeSessionInputChanges = (current: GameSession, previous: GameSession, next: GameSession): GameSession => {
  const previousPlayers = new Map(previous.players.map(player => [player.id, player]));
  const nextPlayers = new Map(next.players.map(player => [player.id, player]));
  const currentPlayers = new Map(current.players.map(player => [player.id, player]));
  const sameOrder = previous.players.length === next.players.length &&
    previous.players.every((player, index) => player.id === next.players[index].id);
  const ids = sameOrder ? current.players.map(player => player.id) : [
    ...next.players.filter(player => currentPlayers.has(player.id) || !previousPlayers.has(player.id)).map(player => player.id),
    ...current.players.filter(player => !previousPlayers.has(player.id) && !nextPlayers.has(player.id)).map(player => player.id),
  ];
  const players = ids.flatMap(id => {
    const local = nextPlayers.get(id);
    const base = previousPlayers.get(id);
    const latest = currentPlayers.get(id);
    if (!local) return latest ? [latest] : [];
    if (!base) return [local];
    if (!latest) return [];
    if (base === local) return [latest];
    const merged = mergeChangedFields(latest, base, local, ['id', 'scores', 'totalScore']);
    return [{ ...merged, scores: mergeChangedFields(latest.scores, base.scores, local.scores, []) }];
  });
  return { ...mergeChangedFields(current, previous, next, ['id', 'players', 'winnerIds', 'lastUpdatedAt']), players };
};

/** Validation and raw inputs only, so several pending inputs can be derived once. */
export const applyScoreValueInputs = (
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
    session: { ...session, players: updatedPlayers },
  };
};

export const applyScoreValuePatch = (
  session: GameSession,
  template: GameTemplate,
  patch: ScoreValuePatch,
): ScoreValuePatchResult => {
  const result = applyScoreValueInputs(session, template, patch);
  return result.ok ? { ok: true, session: recalculateScoreSession(result.session, template) } : result;
};
