import { describe, expect, it, vi } from 'vitest';
import { GameSession, GameTemplate } from '../../types';
import { createMultiplayerHostSession } from './multiplayerSession';
import { routeMultiplayerSessionUpdate } from './multiplayerSessionUpdateRouter';
import { ScoreValuePatchMessage } from './protocol';

const template: GameTemplate = {
  id: 'template-1', name: 'Test', createdAt: 1, updatedAt: 1,
  columns: [
    { id: 'a', name: 'A', formula: 'a1', inputType: 'keypad', isScoring: true, rounding: 'none' },
    { id: 'b', name: 'B', formula: 'b1', inputType: 'keypad', isScoring: true, rounding: 'none' },
  ],
};
const session = (): GameSession => ({
  id: 'session-1', templateId: template.id, name: 'Canonical', startTime: 1, status: 'active',
  players: [{ id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 }],
});
const patch = (input: { opId: string; colId: string; value: number; sequence?: number }): ScoreValuePatchMessage => ({
  type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1',
  opId: input.opId, sequence: input.sequence ?? 1, updatedAt: 10,
  patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: input.colId, scoreValue: { parts: [input.value] } },
});

describe('authoritative multiplayer writes', () => {
  it('merges independent operations created from stale client snapshots instead of replacing the whole session', () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host-1', template, session: session(), now: () => 10 });

    expect(host.receiveScoreValuePatch(patch({ opId: 'op-a', colId: 'a', value: 4 })).accepted).toBe(true);
    expect(host.receiveScoreValuePatch(patch({ opId: 'op-b', colId: 'b', value: 7 })).accepted).toBe(true);

    expect(host.session.players[0].scores).toEqual({ a: { parts: [4] }, b: { parts: [7] } });
    expect(host.revision).toBe(3);
  });

  it('deduplicates a retried operation and rejects an older operation for the same score cell', () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host-1', template, session: session(), now: () => 10 });
    const accepted = patch({ opId: 'op-new', colId: 'a', value: 8, sequence: 2 });

    expect(host.receiveScoreValuePatch(accepted).accepted).toBe(true);
    expect(host.receiveScoreValuePatch(accepted).accepted).toBe(true);
    expect(host.receiveScoreValuePatch(patch({ opId: 'op-old', colId: 'a', value: 3, sequence: 1 }))).toEqual({ accepted: false, reason: 'outdated_player_update' });

    expect(host.session.players[0].scores.a).toEqual({ parts: [8] });
    expect(host.revision).toBe(2);
  });

  it('never lets a participant publish an entire stale session object', async () => {
    const previous = session();
    const staleWholeSession = {
      ...previous,
      name: 'Stale overwrite',
      players: [{ ...previous.players[0], scores: { a: { parts: [9] } }, totalScore: 9 }],
    };
    const queueScoreValuePatch = vi.fn(async () => undefined);
    const runtime = { role: 'player', controller: { queueScoreValuePatch, queueTotalAdjustment: vi.fn() } } as any;

    const result = await routeMultiplayerSessionUpdate({ previous, next: staleWholeSession, claimedPlayerIds: ['p1'], runtime });

    expect(result).toBeNull();
    expect(queueScoreValuePatch).toHaveBeenCalledWith(expect.objectContaining({ colId: 'a', scoreValue: { parts: [9] } }));
    expect(runtime.controller).not.toHaveProperty('applyLocalSession');
  });
});
