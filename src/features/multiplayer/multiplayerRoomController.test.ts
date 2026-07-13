import { describe, expect, it, vi } from 'vitest';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../types';
import { createMultiplayerHostSession, createMultiplayerPlayerSessionFromBootstrap } from './multiplayerSession';
import { createMultiplayerRoomController, createMultiplayerPlayerRoomController } from './multiplayerRoomController';
import { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';

const column: ScoreColumn = { id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true, rounding: 'none' };
const template: GameTemplate = { id: 'template-1', name: 'Template', columns: [column], createdAt: 1, updatedAt: 1 };
const player: Player = { id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 };
const session: GameSession = { id: 'session-1', templateId: 'template-1', name: 'Template', startTime: 1, players: [player], status: 'active' };

const createDeliveryStore = (): MultiplayerDeliveryStore => {
  const outbox = new Map<string, any>(); const receipts = new Map<string, any>(); const sequences = new Map<string, any>();
  return {
    getDevice: async () => undefined, putDevice: async () => undefined,
    getSequence: async (id) => sequences.get(id), putSequence: async (record) => { sequences.set(record.id, record); },
    putOutbox: async (record) => { outbox.set(record.id, record); },
    listOutbox: async (roomId, sessionId) => [...outbox.values()].filter((record) => record.roomId === roomId && record.sessionId === sessionId),
    deleteOutbox: async (id) => { outbox.delete(id); },
    getReceipt: async (id) => receipts.get(id), putReceipt: async (record) => { receipts.set(record.id, record); },
  };
};

describe('multiplayer room controller', () => {
  it('persists before send, then clears an acknowledged player patch', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage(), now: () => 10 });
    const store = createDeliveryStore();
    const sent: unknown[] = [];
    const playerController = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: (message) => { sent.push(message); return true; }, sendToConnection: () => true, broadcastLocalChanges: async () => undefined }, now: () => 20,
    });
    const message = await playerController.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    expect(sent).toEqual([message]);
    expect((await store.listOutbox('room-1', 'session-1'))).toHaveLength(1);
    await playerController.receive({ type: 'score:patch-result', roomId: 'room-1', sessionId: 'session-1', opId: message.opId, accepted: true, snapshot: { type: 'session:snapshot', roomId: 'room-1', sessionId: 'session-1', session, revision: 1, updatedAt: 20 } });
    expect((await store.listOutbox('room-1', 'session-1'))).toHaveLength(0);
  });

  it('uses a durable host receipt to make a retried operation harmless', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const reply = vi.fn(); const broadcast = vi.fn(async () => undefined);
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; }, broadcastLocalChanges: broadcast }, now: () => 20,
    });
    const patch = { type: 'score:valuePatch' as const, roomId: 'room-1', sessionId: 'session-1', opId: 'op-1', deviceId: 'device-1', sequence: 1, updatedAt: 20, patch: { actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } } };
    await controller.receive(patch, {});
    await controller.receive(patch, {});
    expect(host.revision).toBe(2);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledTimes(2);
  });
});
