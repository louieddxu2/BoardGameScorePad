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

  it('applies a broadcast session snapshot without requesting a new board package', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage(), now: () => 10 });
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: async () => undefined }, now: () => 20,
    });
    const updatedSession = { ...session, players: [{ ...player, scores: { points: { parts: [8] } }, totalScore: 8 }] };

    await controller.receive({ type: 'session:snapshot', roomId: 'room-1', sessionId: 'session-1', session: updatedSession, revision: 2, updatedAt: 20 });

    expect(playerSession.session.players[0].scores.points).toEqual({ parts: [8] });
    expect(playerSession.revision).toBe(2);
  });

  it('uses a durable host receipt to make a retried operation harmless', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const reply = vi.fn(); const broadcast = vi.fn();
    const connection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; }, broadcastLocalChanges: async () => undefined, broadcastMessage: broadcast }, now: () => 20,
    });
    const patch = { type: 'score:valuePatch' as const, roomId: 'room-1', sessionId: 'session-1', opId: 'op-1', deviceId: 'device-1', sequence: 1, updatedAt: 20, patch: { actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } } };
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, connection);
    await controller.receive(patch, connection);
    await controller.receive(patch, connection);
    expect(host.revision).toBe(2);
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: 'session:snapshot', revision: 2 }));
    expect(reply).toHaveBeenCalledTimes(3);
  });

  it('requires a claim and accepts a claimed player total adjustment', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const reply = vi.fn();
    const connection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; }, broadcastLocalChanges: async () => undefined }, now: () => 20,
    });
    const adjustment = { type: 'player:total-adjustment' as const, roomId: 'room-1', sessionId: 'session-1', opId: 'total-1', deviceId: 'device-1', sequence: 1, actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', targetTotal: 12, updatedAt: 20 };
    await controller.receive(adjustment, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: false, reason: 'participant_not_claimed' }));
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, connection);
    await controller.receive(adjustment, connection);
    expect(host.session.players[0].totalScore).toBe(12);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: true, snapshot: expect.any(Object) }));
  });

  it('allows one connection to claim multiple players without becoming host', async () => {
    const twoPlayerSession = { ...session, players: [player, { ...player, id: 'p2', name: 'P2' }] };
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session: twoPlayerSession, now: () => 10 });
    const store = createDeliveryStore(); const reply = vi.fn(); const connection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; }, broadcastLocalChanges: async () => undefined }, now: () => 20,
    });
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, connection);
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p2' }, connection);
    await controller.receive({ type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', opId: 'p2-op', deviceId: 'device-1', sequence: 1, updatedAt: 20, patch: { actor: { role: 'player', playerId: 'p2' }, targetPlayerId: 'p2', colId: 'points', scoreValue: { parts: [4] } } }, connection);
    expect(host.session.players.find((item) => item.id === 'p2')?.scores.points).toEqual({ parts: [4] });
  });

  it('reports claimed players per live connection and removes them on disconnect', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const claims = vi.fn(); const firstConnection = {}; const secondConnection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: async () => undefined },
      onParticipantClaims: claims, now: () => 20,
    });

    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, firstConnection);
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-2', playerId: 'p1' }, secondConnection);
    expect(controller.getParticipantClaims()).toEqual({ p1: 2 });

    await controller.releaseConnection(firstConnection);
    expect(controller.getParticipantClaims()).toEqual({ p1: 1 });
    expect(claims).toHaveBeenLastCalledWith({ p1: 1 });
  });

  it('persists and broadcasts a host template change with its active session', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const templates: GameTemplate[] = []; const snapshots: GameSession[] = [];
    const broadcast = vi.fn(async () => undefined);
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: {
        putTemplate: async (nextTemplate) => { templates.push(nextTemplate); },
        putSession: async (nextSession) => { snapshots.push(nextSession); },
        updateRoomRevision: async () => undefined,
      },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: broadcast }, now: () => 20,
    });
    const updatedTemplate = { ...template, columns: [...template.columns, { ...column, id: 'bonus', name: 'Bonus' }], updatedAt: 20 };

    const snapshot = await controller.applyLocalBoard(updatedTemplate, session);

    expect(snapshot?.revision).toBe(2);
    expect(host.template.columns.map((item) => item.id)).toEqual(['points', 'bonus']);
    expect(templates).toEqual([updatedTemplate]);
    expect(snapshots).toEqual([snapshot?.session]);
    expect(broadcast).not.toHaveBeenCalled();
    await controller.publishBoard();
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('serializes host persistence for rapid accepted patches', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const connection = {}; const revisions: number[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: {
        putSession: async () => { if (revisions.length === 0) await firstWrite; },
        updateRoomRevision: async (_roomId, revision) => { revisions.push(revision); },
      },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: async () => undefined }, now: () => 20,
    });
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, connection);
    const first = controller.receive({ type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', opId: 'op-1', deviceId: 'device-1', sequence: 1, updatedAt: 20, patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [1] } } }, connection);
    const second = controller.receive({ type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', opId: 'op-2', deviceId: 'device-1', sequence: 2, updatedAt: 20, patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [2] } } }, connection);
    await Promise.resolve();
    expect(revisions).toEqual([]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(revisions).toEqual([2, 3]);
    expect(host.session.players[0].scores.points).toEqual({ parts: [2] });
  });

  it('rejects player patches after the host has completed the room', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const reply = vi.fn();
    const connection = {};
    const controller = createMultiplayerRoomController({
      role: 'host', hostSession: host, deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; }, broadcastLocalChanges: async () => undefined },
      now: () => 20,
    });

    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, connection);
    await controller.complete();
    await controller.receive({
      type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', opId: 'late-op', deviceId: 'device-1', sequence: 1, updatedAt: 20,
      patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [9] } },
    }, connection);

    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: false, reason: 'room_completed' }));
    expect(host.session.players[0].scores.points).toBeUndefined();
  });
});
