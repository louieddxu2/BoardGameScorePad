import { describe, expect, it, vi } from 'vitest';
import { GameSession } from '../../types';
import { routeMultiplayerSessionUpdate } from './multiplayerSessionUpdateRouter';

const session = (): GameSession => ({ id: 's1', templateId: 't1', name: 'Test', startTime: 1, status: 'active', players: [
  { id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 },
  { id: 'p2', name: 'P2', color: '#000', scores: {}, totalScore: 0 },
] });

describe('multiplayer session update router', () => {
  it('routes participant score changes as compact patches for claimed players only', async () => {
    const previous = session();
    const next = { ...previous, players: previous.players.map((player) => player.id === 'p1' ? { ...player, scores: { points: { parts: [7] } }, totalScore: 7 } : player) };
    const queueScoreValuePatch = vi.fn(async () => undefined);
    await routeMultiplayerSessionUpdate({ previous, next, claimedPlayerIds: ['p1'], runtime: { role: 'player', controller: { queueScoreValuePatch, queueTotalAdjustment: vi.fn() } } as any });
    expect(queueScoreValuePatch).toHaveBeenCalledWith(expect.objectContaining({ targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } }));
  });

  it('lets the host publish a complete authoritative session update', async () => {
    const previous = session(); const next = { ...previous, name: 'Changed' };
    const applyLocalSession = vi.fn(async () => ({ session: next }));
    await expect(routeMultiplayerSessionUpdate({ previous, next, runtime: { role: 'host', controller: { applyLocalSession } } as any })).resolves.toEqual(next);
    expect(applyLocalSession).toHaveBeenCalledWith(next);
  });
});
