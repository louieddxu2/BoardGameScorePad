import { describe, expect, it } from 'vitest';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../types';
import { applyScoreValuePatch, isValidScoreValue } from './scoreValuePatch';

const createColumn = (overrides: Partial<ScoreColumn> = {}): ScoreColumn => ({
  id: 'points',
  name: 'Points',
  formula: 'a1',
  inputType: 'keypad',
  isScoring: true,
  rounding: 'none',
  ...overrides,
});

const createPlayer = (id: string, scores: Player['scores'] = {}): Player => ({
  id,
  name: id,
  color: '#fff',
  scores,
  totalScore: 0,
});

const createTemplate = (columns: ScoreColumn[] = [createColumn()]): GameTemplate => ({
  id: 'template-1',
  name: 'Template',
  columns,
  createdAt: 1,
});

const createSession = (players: Player[] = [createPlayer('p1'), createPlayer('p2')]): GameSession => ({
  id: 'session-1',
  templateId: 'template-1',
  name: 'Session',
  startTime: 1,
  players,
  status: 'active',
  scoringRule: 'HIGHEST_WINS',
});

describe('applyScoreValuePatch', () => {
  it('lets a player update their own non-shared score value', () => {
    const result = applyScoreValuePatch(createSession(), createTemplate(), {
      actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p1',
      colId: 'points',
      scoreValue: { parts: [7] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.players[0].scores.points).toEqual({ parts: [7] });
    expect(result.session.players[0].totalScore).toBe(7);
    expect(result.session.winnerIds).toEqual(['p1']);
  });

  it('rejects a player editing another player score', () => {
    const result = applyScoreValuePatch(createSession(), createTemplate(), {
      actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p2',
      colId: 'points',
      scoreValue: { parts: [5] },
    });

    expect(result).toEqual({ ok: false, reason: 'player_cannot_edit_other_player' });
  });

  it('lets the host update any player score', () => {
    const result = applyScoreValuePatch(createSession(), createTemplate(), {
      actor: { role: 'host' },
      targetPlayerId: 'p2',
      colId: 'points',
      scoreValue: { parts: [4] },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.players[1].scores.points).toEqual({ parts: [4] });
    expect(result.session.players[1].totalScore).toBe(4);
  });

  it('requires host authority for shared columns and applies the value to every player row', () => {
    const template = createTemplate([createColumn({ id: 'shared', isShared: true })]);

    const rejected = applyScoreValuePatch(createSession(), template, {
      actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p1',
      colId: 'shared',
      scoreValue: { parts: [3] },
    });

    expect(rejected).toEqual({ ok: false, reason: 'shared_column_requires_host' });

    const accepted = applyScoreValuePatch(createSession(), template, {
      actor: { role: 'host' },
      targetPlayerId: 'p1',
      colId: 'shared',
      scoreValue: { parts: [3] },
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    expect(accepted.session.players.map((player) => player.scores.shared)).toEqual([
      { parts: [3] },
      { parts: [3] },
    ]);
    expect(accepted.session.players.map((player) => player.totalScore)).toEqual([3, 3]);
  });

  it('deletes an existing score when scoreValue is null', () => {
    const session = createSession([
      createPlayer('p1', { points: { parts: [8] } }),
      createPlayer('p2'),
    ]);

    const result = applyScoreValuePatch(session, createTemplate(), {
      actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p1',
      colId: 'points',
      scoreValue: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.session.players[0].scores.points).toBeUndefined();
    expect(result.session.players[0].totalScore).toBe(0);
  });

  it('rejects unknown players, unknown columns, auto columns, and malformed score values', () => {
    expect(applyScoreValuePatch(createSession(), createTemplate(), {
      actor: { role: 'host' },
      targetPlayerId: 'missing',
      colId: 'points',
      scoreValue: { parts: [1] },
    })).toEqual({ ok: false, reason: 'player_not_found' });

    expect(applyScoreValuePatch(createSession(), createTemplate(), {
      actor: { role: 'host' },
      targetPlayerId: 'p1',
      colId: 'missing',
      scoreValue: { parts: [1] },
    })).toEqual({ ok: false, reason: 'column_not_found' });

    expect(applyScoreValuePatch(createSession(), createTemplate([createColumn({ inputType: 'auto', isAuto: true })]), {
      actor: { role: 'host' },
      targetPlayerId: 'p1',
      colId: 'points',
      scoreValue: { parts: [1] },
    })).toEqual({ ok: false, reason: 'auto_column_readonly' });

    expect(applyScoreValuePatch(createSession(), createTemplate(), {
      actor: { role: 'host' },
      targetPlayerId: 'p1',
      colId: 'points',
      scoreValue: { parts: [Number.NaN] },
    })).toEqual({ ok: false, reason: 'invalid_score_value' });
  });

  it('validates the stored score value shape without understanding the input UI type', () => {
    expect(isValidScoreValue({ parts: [2], optionId: 'choice-a' })).toBe(true);
    expect(isValidScoreValue({ parts: [2, 3], multiOptionIds: ['a', 'b'] })).toBe(true);
    expect(isValidScoreValue({ parts: ['2'] })).toBe(false);
    expect(isValidScoreValue({ value: 2 })).toBe(false);
  });
});
