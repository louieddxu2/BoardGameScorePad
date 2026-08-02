import { describe, expect, it, vi } from 'vitest';
import { GameSession, GameTemplate, MultiplayerRoomRecord } from '../../types';
import { createScoreStateSyncAdapter, readSyncItemPayload, ScoreStateSyncStore } from './scoreStateSyncAdapter';

const room: MultiplayerRoomRecord = {
  roomId: 'room-1', sessionId: 'session-1', templateId: 'template-1', hostDeviceId: 'host-1',
  role: 'host', revision: 3, createdAt: 10, updatedAt: 30,
};
const template: GameTemplate = {
  id: 'template-1', name: 'Template', columns: [], createdAt: 1, updatedAt: 2,
};
const session: GameSession = {
  id: 'session-1', templateId: 'template-1', name: 'Template', startTime: 10,
  players: [], status: 'active',
};

const createStore = (overrides: Partial<ScoreStateSyncStore> = {}): ScoreStateSyncStore => ({
  getRoom: async () => room,
  getSession: async () => session,
  getTemplate: async () => template,
  applyRemoteBootstrap: async () => undefined,
  ...overrides,
});

describe('score-state sync adapter', () => {
  it('has the room as its handshake scope and publishes host metadata', async () => {
    const adapter = createScoreStateSyncAdapter({ roomId: 'room-1', role: 'host', store: createStore() });

    expect(adapter.getScope()).toEqual({ sessionStart: 0, roomKey: 'room-1' });
    await expect(adapter.listMetas()).resolves.toEqual([{ id: 'session-1', version: 3 }]);
  });

  it('serializes the host canonical score state as one versioned item', async () => {
    const adapter = createScoreStateSyncAdapter({ roomId: 'room-1', role: 'host', store: createStore() });
    const item = await adapter.getItem('session-1');

    expect(item).toMatchObject({ id: 'session-1', version: 3, meta: { kind: 'score-state' } });
    expect(JSON.parse(await readSyncItemPayload(item!.payload))).toEqual({
      room: { roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 },
      template,
      session,
      revision: 3,
      exportedAt: 30,
    });
  });

  it('lets a player import a valid remote item without publishing one itself', async () => {
    const applyRemoteBootstrap = vi.fn(async () => undefined);
    const player = createScoreStateSyncAdapter({
      roomId: 'room-1', role: 'player', store: createStore({ applyRemoteBootstrap }),
    });
    const host = createScoreStateSyncAdapter({ roomId: 'room-1', role: 'host', store: createStore() });
    const item = await host.getItem('session-1');

    expect(await player.getItem('session-1')).toBeNull();
    await player.upsertRemoteItem(item!);
    expect(applyRemoteBootstrap).toHaveBeenCalledWith(expect.objectContaining({
      type: 'room:bootstrap', roomId: 'room-1',
      package: expect.objectContaining({ session, template, revision: 3 }),
    }));
  });

  it('publishes a terminal completion item and lets a player receive it after reconnecting', async () => {
    const finalSession = { ...session, status: 'completed' as const, lastUpdatedAt: 50 };
    const completedRoom: MultiplayerRoomRecord = {
      ...room,
      status: 'completed',
      revision: 4,
      completedAt: 50,
      completedSession: finalSession,
      completedTemplate: template,
    };
    const host = createScoreStateSyncAdapter({
      roomId: 'room-1', role: 'host', store: createStore({ getRoom: async () => completedRoom }),
    });
    const item = await host.getItem('session-1');
    expect(item).toMatchObject({ id: 'session-1', version: 4, meta: { kind: 'session-completion' } });

    const onRemoteCompletion = vi.fn(async () => undefined);
    const player = createScoreStateSyncAdapter({
      roomId: 'room-1', role: 'player', store: createStore(), onRemoteCompletion,
    });
    await player.upsertRemoteItem(item!);

    expect(onRemoteCompletion).toHaveBeenCalledWith(expect.objectContaining({
      type: 'session:completed', roomId: 'room-1', sessionId: 'session-1', revision: 4,
      finalSession,
    }));
  });

  it('rejects a score-state item with a mismatched room or version', async () => {
    const player = createScoreStateSyncAdapter({ roomId: 'room-1', role: 'player', store: createStore() });
    const invalidItem = {
      id: 'session-1', version: 4,
      payload: new Blob([JSON.stringify({
        room: { roomId: 'room-2', hostDeviceId: 'host-1', createdAt: 10 }, template, session, revision: 4, exportedAt: 30,
      })]),
    };

    await expect(player.upsertRemoteItem(invalidItem)).rejects.toThrow('invalid_score_state_item');
  });
});
