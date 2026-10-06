import { afterEach, describe, expect, it, vi } from 'vitest';
import * as scoring from '../../utils/scoring';
import { GameSession, GameTemplate, Player, ScoreColumn } from '../../types';
import { createMultiplayerHostSession, createMultiplayerPlayerSessionFromBootstrap } from './multiplayerSession';
import { createMultiplayerRoomController, createMultiplayerPlayerRoomController } from './multiplayerRoomController';
import { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { readSyncItemPayload, SyncItem } from './scoreStateSyncAdapter';

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
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it('sends a complete claim set and accepts an empty permission set', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage(), now: () => 10 });
    const accepted = vi.fn();
    const sent: unknown[] = [];
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: (message) => { sent.push(message); return true; }, sendToConnection: () => true, broadcastLocalChanges: async () => undefined },
      onClaimsAccepted: accepted, now: () => 20,
    });

    expect(controller.setPlayerClaims(['p1', 'p1'])).toBe(true);
    expect(sent).toEqual([expect.objectContaining({ type: 'room:set-player-claims', playerIds: ['p1'] })]);

    await controller.receive({ type: 'room:set-player-claims-result', roomId: 'room-1', sessionId: 'session-1', accepted: true, playerIds: [] });
    expect(accepted).toHaveBeenCalledWith([]);

    expect(controller.leaveRoom()).toBe(true);
    expect(sent).toContainEqual({ type: 'room:leave', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1' });
  });

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

  it.each(['ack-first', 'broadcast-first'] as const)('applies an acknowledged snapshot only once when delivery is %s', async (order) => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage(), now: () => 10 });
    const deliveryStore = createDeliveryStore();
    const putSession = vi.fn(async () => undefined);
    const updateRoomRevision = vi.fn(async () => undefined);
    const onSnapshot = vi.fn();
    const sendToHost = vi.fn(() => true);
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore,
      snapshotStore: { putSession, updateRoomRevision },
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      onSnapshot,
    });
    const calculate = vi.spyOn(scoring, 'calculatePlayerTotal');
    const patch = await controller.queueScoreValuePatch({
      actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] },
    });
    expect(playerSession.session.players[0].totalScore).toBe(7);
    expect(playerSession.session.winnerIds).toEqual(['p1']);
    expect(calculate).toHaveBeenCalledTimes(1);
    const updatedSession = { ...session, players: [{ ...player, scores: { points: { parts: [7] } }, totalScore: 7 }] };
    const snapshot = { type: 'session:snapshot' as const, roomId: 'room-1', sessionId: 'session-1', session: updatedSession, revision: 2, updatedAt: 20 };
    const acknowledgement = { type: 'score:patch-result' as const, roomId: 'room-1', sessionId: 'session-1', opId: patch.opId, accepted: true, snapshot };

    for (const message of order === 'ack-first' ? [acknowledgement, snapshot] : [snapshot, acknowledgement]) {
      await controller.receive(message);
    }

    expect(playerSession.revision).toBe(2);
    expect(playerSession.session.players[0].scores.points).toEqual({ parts: [7] });
    expect(putSession).toHaveBeenCalledTimes(1);
    expect(updateRoomRevision).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(sendToHost).toHaveBeenCalledTimes(1);
    expect(await deliveryStore.listOutbox('room-1', 'session-1')).toHaveLength(0);
  });

  it('calculates a broadcast locally before persistence, retaining manual winner rules without echoing it', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage(), now: () => 10 });
    const putSession = vi.fn(async () => undefined);
    const sendToHost = vi.fn(() => false);
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession, updateRoomRevision: async () => undefined },
      transport: { sendToHost, sendToConnection: () => true, broadcastLocalChanges: async () => undefined }, now: () => 20,
    });
    const updatedSession: GameSession = { ...session, lastUpdatedAt: 18, scoringRule: 'LOWEST_WINS', winnerIds: ['wrong'], players: [
      { ...player, scores: { points: { parts: [8] } }, bonusScore: 2, tieBreaker: true, totalScore: 999 },
      { ...player, id: 'p2', scores: { points: { parts: [10] } }, totalScore: -999 },
      { ...player, id: 'p3', isForceLost: true, totalScore: -999 },
    ] };

    await controller.receive({ type: 'session:snapshot', roomId: 'room-1', sessionId: 'session-1', session: updatedSession, revision: 2, updatedAt: 20 });

    expect(playerSession.session.players[0].scores.points).toEqual({ parts: [8] });
    expect(playerSession.session.players.map(p => p.totalScore)).toEqual([10, 10, 0]);
    expect(playerSession.session.winnerIds).toEqual(['p1']);
    expect(playerSession.session.lastUpdatedAt).toBe(18);
    expect(putSession).toHaveBeenCalledExactlyOnceWith(playerSession.session);
    expect(sendToHost).not.toHaveBeenCalled();
    expect(playerSession.revision).toBe(2);
  });

  it('keeps a newer local input while its outbox write and an older acknowledgement are in flight', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage() });
    const delivery = createDeliveryStore();
    const originalPutOutbox = delivery.putOutbox;
    let finishSecond!: () => void;
    const secondWrite = new Promise<void>(resolve => { finishSecond = resolve; });
    let writes = 0;
    delivery.putOutbox = async record => { if (++writes === 2) await secondWrite; await originalPutOutbox(record); };
    const persisted: GameSession[] = [];
    let finishFirstSnapshot!: () => void;
    const firstSnapshotWrite = new Promise<void>(resolve => { finishFirstSnapshot = resolve; });
    let snapshotWrites = 0;
    const sendToHost = vi.fn((_message: unknown) => true);
    const onLocalSession = vi.fn();
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: delivery,
      snapshotStore: { putSession: async value => { if (++snapshotWrites === 1) await firstSnapshotWrite; persisted.push(value); }, updateRoomRevision: async () => undefined },
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      onLocalSession, now: () => 20,
    });
    const input = (value: number) => ({ actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [value] } });
    const first = await controller.queueScoreValuePatch(input(7));
    const secondPending = controller.queueScoreValuePatch(input(12));
    // Calculation/notification does not wait for IndexedDB or for the host.
    expect(playerSession.session.players[0].totalScore).toBe(12);
    expect(onLocalSession).toHaveBeenCalledTimes(2);
    const firstAccepted = host.receiveScoreValuePatch(first);
    if (!firstAccepted.accepted) throw new Error('first input rejected');
    const firstAck = { type: 'score:patch-result' as const, roomId: 'room-1', sessionId: 'session-1', opId: first.opId, accepted: true, snapshot: firstAccepted.snapshot };
    const receivingFirst = controller.receive(firstAck);
    await vi.waitFor(() => expect(snapshotWrites).toBe(1));
    expect(playerSession.session.players[0].totalScore).toBe(12);
    expect(playerSession.confirmedSession.players[0].totalScore).toBe(7);
    finishSecond();
    const second = await secondPending;
    expect(second.sequence).toBeGreaterThan(first.sequence);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    const secondAccepted = host.receiveScoreValuePatch(second);
    if (!secondAccepted.accepted) throw new Error('second input rejected');
    const receivingSecond = controller.receive({ ...firstAck, opId: second.opId, snapshot: secondAccepted.snapshot });
    expect(snapshotWrites).toBe(1);
    finishFirstSnapshot();
    await Promise.all([receivingFirst, receivingSecond]);
    const calculate = vi.spyOn(scoring, 'calculatePlayerTotal');
    await controller.receive(firstAck);
    await controller.receive(firstAccepted.snapshot);
    await controller.receive(secondAccepted.snapshot);
    expect(playerSession.session.players[0].totalScore).toBe(12);
    expect(playerSession.session.winnerIds).toEqual(['p1']);
    expect(persisted.map(value => value.players[0].totalScore)).toEqual([7, 12]);
    expect(await delivery.listOutbox('room-1', 'session-1')).toEqual([]);
    expect(sendToHost).toHaveBeenCalledTimes(2);
    expect(calculate).not.toHaveBeenCalled();
  });

  it('rolls back only the failed local reservation or rejected operation, leaving later inputs intact', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage() });
    const delivery = createDeliveryStore();
    const putOutbox = delivery.putOutbox;
    let writes = 0;
    delivery.putOutbox = async record => { if (++writes === 1) throw new Error('disk full'); await putOutbox(record); };
    const sendToHost = vi.fn((_message: unknown) => true);
    const putSession = vi.fn(async () => undefined);
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: delivery,
      snapshotStore: { putSession, updateRoomRevision: async () => undefined },
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
    });
    const input = (value: number) => ({ actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [value] } });
    const failed = controller.queueScoreValuePatch(input(7));
    const failure = expect(failed).rejects.toThrow('disk full');
    const later = controller.queueScoreValuePatch(input(12));
    await failure;
    const message = await later;
    expect(playerSession.session.players[0].totalScore).toBe(12);
    expect(sendToHost).toHaveBeenCalledExactlyOnceWith(message);
    await controller.receive({ type: 'score:patch-result', roomId: 'room-1', sessionId: 'session-1', opId: message.opId, accepted: false, reason: 'participant_not_claimed' });
    expect(playerSession.session.players[0].totalScore).toBe(0);
    expect(await delivery.listOutbox('room-1', 'session-1')).toEqual([]);
    expect(putSession).not.toHaveBeenCalled();
  });

  it('recovers a single ACK after transient snapshot and outbox failures without recalculating or sending again', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage() });
    const delivery = createDeliveryStore();
    const deleteOutbox = vi.spyOn(delivery, 'deleteOutbox').mockRejectedValueOnce(new Error('delete failed'));
    const putSession = vi.fn(async (_value: GameSession) => undefined).mockRejectedValueOnce(new Error('write failed'));
    const sendToHost = vi.fn((_message: unknown) => true);
    const onSnapshot = vi.fn();
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: delivery,
      snapshotStore: { putSession, updateRoomRevision: async () => undefined },
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      onSnapshot,
    });
    const patch = await controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    const accepted = host.receiveScoreValuePatch(patch);
    if (!accepted.accepted) throw new Error('input rejected');
    const ack = { type: 'score:patch-result' as const, roomId: 'room-1', sessionId: 'session-1', opId: patch.opId, accepted: true, snapshot: accepted.snapshot };
    const calculate = vi.spyOn(scoring, 'calculatePlayerTotal');
    await controller.receive(ack);
    expect(putSession).toHaveBeenCalledTimes(2);
    expect(deleteOutbox).toHaveBeenCalledTimes(2);
    expect(putSession).toHaveBeenLastCalledWith(expect.objectContaining({ players: [expect.objectContaining({ totalScore: 7 })] }));
    expect(await delivery.listOutbox('room-1', 'session-1')).toEqual([]);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(sendToHost).toHaveBeenCalledTimes(1);
    expect(calculate).not.toHaveBeenCalled();
  });

  it('bounds persistence retries and retains the outbox until a later delivery succeeds', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const playerSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: host.createBootstrapMessage() });
    const delivery = createDeliveryStore();
    const putSession = vi.fn(async () => undefined);
    for (let failure = 0; failure < 3; failure++) putSession.mockRejectedValueOnce(new Error('write failed'));
    const sendToHost = vi.fn(() => true);
    const onSnapshot = vi.fn();
    const controller = createMultiplayerPlayerRoomController({
      playerSession, deviceId: 'device-1', deliveryStore: delivery,
      snapshotStore: { putSession, updateRoomRevision: async () => undefined },
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined }, onSnapshot,
    });
    const patch = await controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    const accepted = host.receiveScoreValuePatch(patch);
    if (!accepted.accepted) throw new Error('input rejected');
    const ack = { type: 'score:patch-result' as const, roomId: 'room-1', sessionId: 'session-1', opId: patch.opId, accepted: true, snapshot: accepted.snapshot };
    const calculate = vi.spyOn(scoring, 'calculatePlayerTotal');
    await expect(controller.receive(ack)).rejects.toThrow('write failed');
    expect(putSession).toHaveBeenCalledTimes(3);
    expect(await delivery.listOutbox('room-1', 'session-1')).toHaveLength(1);
    expect(onSnapshot).not.toHaveBeenCalled();
    await controller.receive(ack);
    expect(putSession).toHaveBeenCalledTimes(4);
    expect(await delivery.listOutbox('room-1', 'session-1')).toHaveLength(0);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(sendToHost).toHaveBeenCalledTimes(1);
    expect(calculate).not.toHaveBeenCalled();
  });

  it('acknowledges participant edits once, relays them to others, and broadcasts host edits to everyone', async () => {
    const sharedSession = {
      ...session,
      players: [player, { ...player, id: 'p2', name: 'P2' }],
    };
    const hostSession = createMultiplayerHostSession({
      roomId: 'room-1', hostDeviceId: 'host', template, session: sharedSession, now: () => 10,
    });
    const connectionA = {};
    const connectionB = {};
    const playerASession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: hostSession.createBootstrapMessage() });
    const playerBSession = createMultiplayerPlayerSessionFromBootstrap({ bootstrapMessage: hostSession.createBootstrapMessage() });
    const playerADelivery = createDeliveryStore();
    const sentByA: unknown[] = [];
    const inFlightDeliveries: Promise<unknown>[] = [];
    const putPlayerASession = vi.fn(async () => undefined);
    const onPlayerASnapshot = vi.fn();
    const onPlayerBSnapshot = vi.fn();
    const playerA = createMultiplayerPlayerRoomController({
      playerSession: playerASession, deviceId: 'device-a', deliveryStore: playerADelivery,
      snapshotStore: { putSession: putPlayerASession, updateRoomRevision: async () => undefined },
      transport: { sendToHost: (message) => { sentByA.push(message); return true; }, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      onSnapshot: onPlayerASnapshot,
    });
    const playerB = createMultiplayerPlayerRoomController({
      playerSession: playerBSession, deviceId: 'device-b', deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => true, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      onSnapshot: onPlayerBSnapshot,
    });
    const receiveA = vi.fn((message: unknown) => { inFlightDeliveries.push(playerA.receive(message)); });
    const receiveB = vi.fn((message: unknown) => { inFlightDeliveries.push(playerB.receive(message)); });
    const broadcast = vi.fn((message: unknown, exceptConnection?: unknown) => {
      if (exceptConnection !== connectionA) receiveA(message);
      if (exceptConnection !== connectionB) receiveB(message);
      return true;
    });
    const host = createMultiplayerRoomController({
      role: 'host', hostSession, deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: {
        sendToHost: () => false,
        sendToConnection: (connection, message) => {
          (connection === connectionA ? receiveA : receiveB)(message);
          return true;
        },
        broadcastLocalChanges: async () => undefined,
        broadcastMessage: broadcast,
      },
    });

    await host.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-a', playerId: 'p1' }, connectionA);
    await host.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-b', playerId: 'p2' }, connectionB);
    await Promise.all(inFlightDeliveries.splice(0));
    receiveA.mockClear();
    receiveB.mockClear();

    await playerA.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    await host.receive(sentByA.shift(), connectionA);
    await Promise.all(inFlightDeliveries.splice(0));
    expect(hostSession.session.players[0].scores.points).toEqual({ parts: [7] });
    expect(playerBSession.session.players[0].scores.points).toEqual({ parts: [7] });
    expect(playerBSession.revision).toBe(2);
    expect(playerASession.revision).toBe(2);
    expect(receiveA).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      type: 'score:patch-result', accepted: true, snapshot: expect.objectContaining({ revision: 2, session: hostSession.session }),
    }));
    expect(receiveB).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'session:snapshot', revision: 2 }));
    expect(onPlayerBSnapshot).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
    expect(putPlayerASession).toHaveBeenCalledTimes(1);
    expect(onPlayerASnapshot).toHaveBeenCalledTimes(1);
    expect(await playerADelivery.listOutbox('room-1', 'session-1')).toHaveLength(0);

    await playerA.queueTotalAdjustment({ playerId: 'p1', targetTotal: 11 });
    await host.receive(sentByA.shift(), connectionA);
    await Promise.all(inFlightDeliveries.splice(0));
    expect(hostSession.session.players[0].totalScore).toBe(11);
    expect(playerBSession.session.players[0].totalScore).toBe(11);
    expect(playerBSession.revision).toBe(3);
    expect(playerASession.revision).toBe(3);
    expect(receiveA).toHaveBeenCalledTimes(2);
    expect(receiveA).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'score:patch-result', accepted: true, snapshot: expect.objectContaining({ revision: 3, session: hostSession.session }),
    }));
    expect(receiveB).toHaveBeenCalledTimes(2);
    expect(receiveB).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'session:snapshot', revision: 3 }));
    expect(onPlayerBSnapshot).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }));
    expect(putPlayerASession).toHaveBeenCalledTimes(2);
    expect(onPlayerASnapshot).toHaveBeenCalledTimes(2);
    expect(await playerADelivery.listOutbox('room-1', 'session-1')).toHaveLength(0);
    expect(broadcast).toHaveBeenCalledTimes(2);

    await host.applyLocalSession({
      ...hostSession.session,
      players: hostSession.session.players.map((value) => value.id === 'p2'
        ? { ...value, scores: { points: { parts: [3] } } } : value),
    });
    await Promise.all(inFlightDeliveries.splice(0));
    for (const receive of [receiveA, receiveB]) {
      expect(receive).toHaveBeenCalledTimes(3);
      expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'session:snapshot', revision: 4 }));
    }
    expect(playerASession.session.players[1].totalScore).toBe(3);
    expect(playerBSession.session.players[1].totalScore).toBe(3);
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
    expect(broadcast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'session:snapshot', revision: 2 }), connection);
    expect(reply).toHaveBeenCalledTimes(3);
    for (const [message] of reply.mock.calls.slice(1)) {
      expect(message).toMatchObject({ accepted: true, opId: 'op-1', snapshot: { revision: 2, session: host.session } });
    }
  });

  it('retries a failed accepted write with current inputs rather than an obsolete cached snapshot', async () => {
    const base = { ...session, players: [player, { ...player, id: 'p2' }] };
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session: base });
    const persisted: GameSession[] = [];
    const replies = vi.fn(); const connection = {};
    const putSession = vi.fn(async (value: GameSession) => { persisted.push(value); }).mockRejectedValueOnce(new Error('write failed'));
    const controller = createMultiplayerRoomController({
      role: 'host', hostSession: host, deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: (_connection, value) => { replies(value); return true; }, broadcastLocalChanges: async () => undefined },
    });
    await controller.receive({ type: 'room:set-player-claims', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device', playerIds: ['p1', 'p2'] }, connection);
    replies.mockClear();
    const operation = (id: string, value: number) => ({
      type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device', opId: id, sequence: 1, updatedAt: 20,
      patch: { actor: { role: 'player', playerId: id }, targetPlayerId: id, colId: 'points', scoreValue: { parts: [value] } },
    });
    const first = operation('p1', 7);
    await expect(controller.receive(first, connection)).rejects.toThrow('write failed');
    expect(replies).not.toHaveBeenCalled();
    await controller.receive(operation('p2', 12), connection);
    const calculate = vi.spyOn(scoring, 'calculatePlayerTotal');
    await controller.receive(first, connection);
    expect(host.revision).toBe(3);
    expect(persisted.map(value => value.players.map(item => item.totalScore))).toEqual([[7, 12], [7, 12]]);
    expect(replies).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: true, snapshot: expect.objectContaining({ revision: 3 }) }));
    expect(calculate).not.toHaveBeenCalled();
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

  it('replaces a connection claim set and allows all permissions to be cleared', async () => {
    const twoPlayerSession = { ...session, players: [player, { ...player, id: 'p2', name: 'P2' }] };
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session: twoPlayerSession, now: () => 10 });
    const store = createDeliveryStore(); const claims = vi.fn(); const connection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: async () => undefined },
      onParticipantClaims: claims, now: () => 20,
    });

    await controller.receive({ type: 'room:set-player-claims', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerIds: ['p1', 'p2'] }, connection);
    expect(controller.getParticipantClaims()).toEqual({ p1: 1, p2: 1 });

    await controller.receive({ type: 'room:set-player-claims', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerIds: ['p2'] }, connection);
    expect(controller.getParticipantClaims()).toEqual({ p2: 1 });

    await controller.receive({ type: 'room:set-player-claims', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerIds: [] }, connection);
    expect(controller.getParticipantClaims()).toEqual({});
    expect(claims).toHaveBeenLastCalledWith({});
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

  it('treats a repeated QR scan from the same device as one participant binding', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const claims = vi.fn(); const closeConnection = vi.fn(); const firstConnection = {}; const secondConnection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, closeConnection, broadcastLocalChanges: async () => undefined },
      onParticipantClaims: claims, now: () => 20,
    });

    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, firstConnection);
    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, secondConnection);

    expect(controller.getParticipantClaims()).toEqual({ p1: 1 });
    expect(closeConnection).toHaveBeenCalledWith(firstConnection);
  });

  it('releases a participant binding when the participant explicitly leaves', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const claims = vi.fn(); const closeConnection = vi.fn(); const connection = {};
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, closeConnection, broadcastLocalChanges: async () => undefined },
      onParticipantClaims: claims, now: () => 20,
    });

    await controller.receive({ type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1', playerId: 'p1' }, connection);
    await controller.receive({ type: 'room:leave', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device-1' }, connection);

    expect(controller.getParticipantClaims()).toEqual({});
    expect(claims).toHaveBeenLastCalledWith({});
    expect(closeConnection).toHaveBeenCalledWith(connection);
  });

  it('automatically coalesces committed template edits into one frozen board transfer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createDeliveryStore(); const templates: GameTemplate[] = []; const snapshots: GameSession[] = [];
    const broadcast = vi.fn(async (_item?: SyncItem) => undefined);
    const syncStatus = vi.fn();
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: store,
      snapshotStore: {
        putTemplate: async (nextTemplate) => { templates.push(nextTemplate); },
        putSession: async (nextSession) => { snapshots.push(nextSession); },
        updateRoomRevision: async () => undefined,
      },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: broadcast }, onBoardSyncStatus: syncStatus, now: () => 20,
    });
    const updatedTemplate = { ...template, columns: [...template.columns, { ...column, id: 'bonus', name: 'Bonus' }], updatedAt: 20 };

    const snapshot = await controller.applyLocalBoard(updatedTemplate, session);

    expect(snapshot?.revision).toBe(2);
    expect(host.template.columns.map((item) => item.id)).toEqual(['points', 'bonus']);
    expect(templates).toEqual([updatedTemplate]);
    expect(snapshots).toEqual([snapshot?.session]);
    expect(broadcast).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    const latestTemplate = { ...updatedTemplate, name: 'Latest', updatedAt: 30 };
    await controller.applyLocalBoard(latestTemplate, host.session);
    await vi.advanceTimersByTimeAsync(249);
    expect(broadcast).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
    const item = broadcast.mock.calls[0][0]!;
    expect(JSON.parse(await readSyncItemPayload(item.payload))).toMatchObject({ template: latestTemplate, session: host.session, revision: 3 });
    expect(syncStatus.mock.calls.map(([status]) => status)).toEqual(['pending', 'syncing', 'synced']);
    await controller.applyLocalSession({ ...host.session, players: [{ ...player, scores: { points: { parts: [9] } } }] });
    await vi.advanceTimersByTimeAsync(500);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readSyncItemPayload(item.payload)).session.players[0].scores).toEqual({});
    controller.stop();
  });

  it('keeps a newer template pending during a slow send without blocking local score inputs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    let finishSend!: () => void;
    const sending = new Promise<void>(resolve => { finishSend = resolve; });
    const broadcast = vi.fn(async (_item?: SyncItem): Promise<void> => undefined).mockImplementationOnce(() => sending);
    const syncStatus = vi.fn();
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: createDeliveryStore(),
      snapshotStore: { putTemplate: async () => undefined, putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: broadcast }, onBoardSyncStatus: syncStatus,
    });
    await controller.applyLocalBoard({ ...template, name: 'First' }, session);
    await vi.advanceTimersByTimeAsync(250);
    expect(broadcast).toHaveBeenCalledTimes(1);
    await controller.applyLocalBoard({ ...template, name: 'Second' }, host.session);
    await controller.applyLocalSession({ ...host.session, players: [{ ...player, scores: { points: { parts: [7] } } }] });
    expect(host.session.players[0].totalScore).toBe(7);
    await vi.advanceTimersByTimeAsync(250);
    expect(broadcast).toHaveBeenCalledTimes(1);
    const firstSend = controller.publishBoard();
    finishSend();
    await firstSend;
    expect(syncStatus).toHaveBeenLastCalledWith('pending');
    await vi.advanceTimersByTimeAsync(250);
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readSyncItemPayload(broadcast.mock.calls[1][0]!.payload))).toMatchObject({ template: { name: 'Second' }, session: { players: [{ scores: { points: { parts: [7] } } }] } });
    expect(syncStatus).toHaveBeenLastCalledWith('synced');
    controller.stop();
  });

  it('leaves a failed automatic send for explicit retry instead of looping', async () => {
    vi.useFakeTimers();
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session });
    const broadcast = vi.fn().mockRejectedValueOnce(new Error('send failed')).mockResolvedValue(undefined);
    const syncStatus = vi.fn();
    const controller = createMultiplayerRoomController({ role: 'host', hostSession: host, deliveryStore: createDeliveryStore(),
      snapshotStore: { putSession: async () => undefined, updateRoomRevision: async () => undefined },
      transport: { sendToHost: () => false, sendToConnection: () => true, broadcastLocalChanges: broadcast }, onBoardSyncStatus: syncStatus,
    });
    await controller.applyLocalBoard({ ...template, name: 'Changed' }, session);
    await vi.advanceTimersByTimeAsync(250);
    expect(syncStatus).toHaveBeenLastCalledWith('error');
    await vi.advanceTimersByTimeAsync(5000);
    expect(broadcast).toHaveBeenCalledTimes(1);
    await Promise.all([controller.publishBoard(), controller.publishBoard()]);
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(syncStatus).toHaveBeenLastCalledWith('synced');
    controller.stop();
  });

  it('serializes received, local, and template edits while merging only changes from the UI baseline', async () => {
    const baseline: GameSession = { ...session, players: [player, { ...player, id: 'p2' }] };
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session: baseline, now: () => 10 });
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
    await vi.waitFor(() => expect(host.revision).toBe(2));
    const local = controller.applyLocalSession({
      ...baseline, scoringRule: 'LOWEST_WINS', winnerIds: ['incorrect'],
      players: baseline.players.map(value => value.id === 'p2'
        ? { ...value, color: '#123456', bonusScore: 2, scores: { points: { parts: [3] } }, totalScore: 999 } : value),
    }, baseline);
    const second = controller.receive({ type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', opId: 'op-2', deviceId: 'device-1', sequence: 2, updatedAt: 20, patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [2] } } }, connection);
    const board = controller.applyLocalBoard({ ...template, name: 'Changed', updatedAt: 30 }, { ...baseline, name: 'Changed' }, baseline);
    expect(host.revision).toBe(2);
    expect(revisions).toEqual([]);
    releaseFirst?.();
    await Promise.all([first, local, second, board]);
    expect(revisions).toEqual([2, 3, 4, 5]);
    expect(host.session.players[0].scores.points).toEqual({ parts: [2] });
    expect(host.session.players[1]).toMatchObject({ color: '#123456', bonusScore: 2, totalScore: 5 });
    expect(host.session).toMatchObject({ name: 'Changed', scoringRule: 'LOWEST_WINS', winnerIds: ['p1'] });
    controller.stop();
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
    expect(await controller.applyLocalSession(session)).toBeNull();
    expect(await controller.applyLocalBoard(template, session)).toBeNull();
    expect(host.session.status).toBe('completed');
  });
});
