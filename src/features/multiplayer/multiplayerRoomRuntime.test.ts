import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMultiplayerHostSession } from './multiplayerSession';
import { GameSession, GameTemplate, MultiplayerParticipantBindingRecord, MultiplayerRoomRecord, ScoreColumn } from '../../types';
import { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { MultiplayerParticipantBindingStore, saveParticipantBinding } from './multiplayerParticipantBinding';
import { MultiplayerPlayerRoomStore, MultiplayerRoomRecoveryStore, MultiplayerRoomRuntimeTransport, createMultiplayerHostRoomRuntime, createMultiplayerPlayerRoomRuntime, restoreMultiplayerHostRoomRuntime, restoreMultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';

const column: ScoreColumn = { id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true, rounding: 'none' };
const template: GameTemplate = { id: 'template-1', name: 'Template', columns: [column], createdAt: 1, updatedAt: 1 };
const session: GameSession = {
  id: 'session-1', templateId: 'template-1', name: 'Template', startTime: 1, status: 'active',
  players: [{ id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 }],
};

const createRuntimeStore = (): MultiplayerRoomRecoveryStore & MultiplayerPlayerRoomStore => {
  const templates = new Map<string, GameTemplate>(); const sessions = new Map<string, GameSession>(); const rooms = new Map<string, MultiplayerRoomRecord>();
  return {
    getTemplate: async (id) => templates.get(id),
    getRoom: async (id) => rooms.get(id),
    getSession: async (id) => sessions.get(id),
    putTemplate: async (value) => { templates.set(value.id, value); },
    putSession: async (value) => { sessions.set(value.id, value); },
    putRoom: async (value) => { rooms.set(value.roomId, value); },
    persistBootstrap: async ({ template: bootstrapTemplate, session: bootstrapSession, room: bootstrapRoom }) => {
      if (bootstrapTemplate) templates.set(bootstrapTemplate.id, bootstrapTemplate);
      sessions.set(bootstrapSession.id, bootstrapSession);
      rooms.set(bootstrapRoom.roomId, bootstrapRoom);
    },
    updateRoomRevision: async (roomId, revision, updatedAt) => { const room = rooms.get(roomId); if (room) rooms.set(roomId, { ...room, revision, updatedAt }); },
    deleteRoom: async (id) => { rooms.delete(id); },
  };
};

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

const createBindingStore = (): MultiplayerParticipantBindingStore => {
  const records = new Map<string, MultiplayerParticipantBindingRecord>();
  return { get: async (id) => records.get(id), put: async (record) => { records.set(record.id, record); }, delete: async (id) => { records.delete(id); } };
};

describe('multiplayer room runtime', () => {
  afterEach(() => vi.useRealTimers());

  it('cancels a pending automatic template transfer when the host runtime stops', async () => {
    vi.useFakeTimers();
    const broadcast = vi.fn(async () => undefined);
    const stop = vi.fn();
    const runtime = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host', template, session,
      store: createRuntimeStore(), deliveryStore: createDeliveryStore(),
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: broadcast, stop },
    });
    await runtime.controller.applyLocalBoard({ ...template, name: 'Changed' }, session);
    runtime.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await runtime.whenIdle?.();
    expect(broadcast).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('applies a delayed template without rolling back newer confirmed or pending inputs', async () => {
    const host = createMultiplayerHostSession({ roomId: 'room-1', hostDeviceId: 'host', template, session, now: () => 10 });
    const store = createRuntimeStore();
    const delivery = createDeliveryStore();
    const sendToHost = vi.fn(() => false);
    const runtime = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.createBootstrapMessage(), deviceId: 'device',
      store, deliveryStore: delivery, bindingStore: createBindingStore(),
      transport: { sendToHost, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
    });
    host.applyLocalBoard({ ...template, columns: [{ ...column, formula: 'a1×c1', constants: { c1: 2 } }], updatedAt: 2 }, host.session);
    const delayedTemplate = host.createBootstrapMessage();
    const newerScore = host.applyLocalSession({ ...host.session, players: [{ ...session.players[0], scores: { points: { parts: [4] } } }] })!;
    await runtime.receive(newerScore);
    const pending = await runtime.controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    sendToHost.mockClear();
    const persistBootstrap = store.persistBootstrap;
    const persisted = vi.spyOn(store, 'persistBootstrap');
    let finishWrite!: () => void;
    const writing = new Promise<void>(resolve => { finishWrite = resolve; });
    persisted.mockImplementationOnce(async (records) => { await writing; await persistBootstrap(records); });
    // Same timestamp but stale local content must not hide the live host structure.
    await store.putTemplate({ ...template, updatedAt: 2 });
    const apply = runtime.receive(delayedTemplate);
    await vi.waitFor(() => expect(persisted).toHaveBeenCalledTimes(1));
    const latestScore = host.applyLocalSession({ ...host.session, players: [{ ...session.players[0], scores: { points: { parts: [5] } } }] })!;
    const newer = runtime.receive(latestScore);
    finishWrite();
    await Promise.all([apply, newer]);

    expect(runtime.session.revision).toBe(latestScore.revision);
    expect(runtime.session.session.players[0]).toMatchObject({ scores: { points: { parts: [7] } }, totalScore: 14 });
    expect(await store.getSession('session-1')).toMatchObject({ players: [{ scores: { points: { parts: [5] } }, totalScore: 10 }] });
    expect(await store.getRoom('room-1')).toMatchObject({ revision: latestScore.revision });
    expect(await store.getTemplate('template-1')).toMatchObject({ columns: [{ formula: 'a1×c1', constants: { c1: 2 } }] });
    expect(await delivery.listOutbox('room-1', 'session-1')).toHaveLength(1);
    expect(sendToHost).not.toHaveBeenCalled();

    const obsoleteTemplate = { ...delayedTemplate, package: { ...delayedTemplate.package, revision: 1, template } };
    expect(await runtime.receive(obsoleteTemplate)).toBe(false);
    expect(persisted).toHaveBeenCalledTimes(1);
    await runtime.receive({ type: 'score:patch-result', roomId: 'room-1', sessionId: 'session-1', opId: pending.opId, accepted: false, reason: 'test_rejected' });
    expect(runtime.session.session.players[0].totalScore).toBe(10);
    expect(await delivery.listOutbox('room-1', 'session-1')).toHaveLength(0);
    runtime.stop();
  });
  it('persists a complete permission set and removes it when all permissions are cleared', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const connection = {};
    let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>>;
    let player: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const hostTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false,
      sendToConnection: (_connection, message) => { void player.receive(message); return true; },
      broadcastLocalChanges: vi.fn(async () => undefined),
    };
    const playerTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { void host.receive(message, connection); return true; },
      sendToConnection: () => false,
      broadcastLocalChanges: async () => undefined,
    };
    host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport: hostTransport, now: () => 10 });
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 20 });

    expect(player.controller.setPlayerClaims(['p1'])).toBe(true);
    await vi.waitFor(async () => expect(await bindingStore.get('room-1:player-device')).toMatchObject({ playerIds: ['p1'] }));
    expect(host.getParticipantClaims()).toEqual({ p1: 1 });

    expect(player.controller.setPlayerClaims([])).toBe(true);
    await vi.waitFor(async () => expect(await bindingStore.get('room-1:player-device')).toBeUndefined());
    expect(host.getParticipantClaims()).toEqual({});
  });

  it('reclaims the bound player before replaying a disconnected edit', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const connection = {};
    let connected = true;
    let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>>;
    let player: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const hostTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false,
      sendToConnection: (_connection, message) => { void player.receive(message); return true; },
      broadcastLocalChanges: vi.fn(async () => undefined),
    };
    const playerTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { if (!connected) return false; void host.receive(message, connection); return true; },
      sendToConnection: () => false,
      broadcastLocalChanges: async () => undefined,
    };
    host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport: hostTransport, now: () => 10 });
    const bootstrap = host.session.createBootstrapMessage();
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 20 });

    player.controller.claimPlayer('p1');
    await vi.waitFor(async () => expect(await bindingStore.get('room-1:player-device')).toMatchObject({ playerId: 'p1' }));

    connected = false;
    await player.controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [8] } });
    expect((await playerDelivery.listOutbox('room-1', 'session-1'))).toHaveLength(1);
    expect(host.session.session.players[0].scores.points).toBeUndefined();
    expect(player.session.session.players[0].totalScore).toBe(8);

    connected = true;
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 30 });
    expect(player.session.session.players[0].totalScore).toBe(8);
    // The optimistic value is recovered from the durable outbox, not saved as confirmed data.
    expect((await playerStore.getSession('session-1'))?.players[0].totalScore).toBe(0);
    expect(await player.restoreParticipantBinding()).toBe(true);

    await vi.waitFor(async () => expect(await playerDelivery.listOutbox('room-1', 'session-1')).toHaveLength(0));
    expect(host.session.session.players[0].scores.points).toEqual({ parts: [8] });
    expect(host.session.revision).toBe(2);
  });

  it('restores accepted score and total sequences and does not let older replayed inputs overwrite them', async () => {
    const store = createRuntimeStore(); const delivery = createDeliveryStore();
    const reply = vi.fn(); const broadcast = vi.fn(() => true); const connection = {};
    const transport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false, sendToConnection: (_connection, message) => { reply(message); return true; },
      broadcastLocalChanges: async () => undefined, broadcastMessage: broadcast,
    };
    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, revision: 7, store, deliveryStore: delivery, transport, now: () => 10 });
    const claim = { type: 'room:claim-player', roomId: 'room-1', sessionId: 'session-1', deviceId: 'remote', playerId: 'p1' };
    const score = {
      type: 'score:valuePatch', roomId: 'room-1', sessionId: 'session-1', deviceId: 'remote', opId: 'score-new', sequence: 2, updatedAt: 12,
      patch: { actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [12] } },
    };
    const total = {
      type: 'player:total-adjustment', roomId: 'room-1', sessionId: 'session-1', deviceId: 'remote', opId: 'total-new', sequence: 2, updatedAt: 13,
      actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', targetTotal: 16,
    };
    await host.receive(claim, connection);
    await host.receive(score, connection);
    await host.receive(total, connection);
    const restored = await restoreMultiplayerHostRoomRuntime({ roomId: 'room-1', store, deliveryStore: delivery, transport, now: () => 20 });
    expect(restored?.session.room).toEqual({ roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 });
    expect(restored?.session.revision).toBe(9);
    const readSequence = vi.spyOn(delivery, 'getSequence');
    await restored!.receive(claim, connection);
    await restored!.receive({ ...score, opId: 'score-old', sequence: 1, patch: { ...score.patch, scoreValue: { parts: [7] } } }, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: false, reason: 'outdated_player_update' }));
    await restored!.receive({ ...total, opId: 'total-old', sequence: 1, targetTotal: 8 }, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: false, reason: 'outdated_player_update' }));
    await restored!.receive(score, connection);
    await restored!.receive(total, connection);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: true, snapshot: expect.objectContaining({ revision: 9 }) }));
    expect(restored!.session.session.players[0]).toMatchObject({ totalScore: 16, bonusScore: 4, scores: { points: { parts: [12] } } });
    expect(broadcast).toHaveBeenCalledTimes(2);
    await restored!.receive({ ...score, opId: 'score-later', sequence: 3, patch: { ...score.patch, scoreValue: { parts: [13] } } }, connection);
    expect(restored!.session.session.players[0].totalScore).toBe(17);
    expect(readSequence).toHaveBeenCalledTimes(2);
    readSequence.mockRestore();
  });

  it('restores a player runtime with stored room, session, template, and binding', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const transport: MultiplayerRoomRuntimeTransport = { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined };

    const host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport, now: () => 10 });
    const bootstrap = host.session.createBootstrapMessage();
    const player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport, now: () => 20 });
    await saveParticipantBinding({ store: bindingStore, roomId: 'room-1', sessionId: 'session-1', deviceId: 'player-device', playerIds: ['p1'] });

    const restored = await restoreMultiplayerPlayerRoomRuntime({
      roomId: 'room-1',
      deviceId: 'player-device',
      store: playerStore,
      bindingStore,
      deliveryStore: playerDelivery,
      transport,
      now: () => 30,
    });
    expect(restored).not.toBeNull();
    expect(restored?.session.room).toEqual({ roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 });
    expect(await restored?.restoreParticipantBinding()).toBe(true);
  });

  it('returns session ownership only after the host completes the room', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    let stopped = false; let released: GameSession | undefined;
    const connection = {};
    let host: Awaited<ReturnType<typeof createMultiplayerHostRoomRuntime>>;
    let player: Awaited<ReturnType<typeof createMultiplayerPlayerRoomRuntime>>;
    const hostTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: () => false, sendToConnection: (_connection, message) => { void player.receive(message); return true; }, broadcastLocalChanges: async () => undefined,
      broadcastMessage: (message) => { void player.receive(message); return true; },
    };
    const playerTransport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { void host.receive(message, connection); return true; }, sendToConnection: () => false, broadcastLocalChanges: async () => undefined,
      stop: () => { stopped = true; },
    };
    host = await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore, deliveryStore: hostDelivery, transport: hostTransport, now: () => 10 });
    player = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'player-device', store: playerStore,
      bindingStore, deliveryStore: playerDelivery, transport: playerTransport,
      onOwnershipReturned: (localSession) => { released = localSession; }, now: () => 20,
    });
    player.controller.claimPlayer('p1');
    await vi.waitFor(() => expect(host.getParticipantClaims()).toEqual({ p1: 1 }));
    await host.controller.complete();
    await vi.waitFor(() => expect(released?.status).toBe('active'));
    expect(stopped).toBe(true);
    expect(released?.players).toEqual(session.players);
  });

  it('stops the participant transport as soon as completion arrives, before local persistence finishes', async () => {
    const hostStore = createRuntimeStore(); const playerStore = createRuntimeStore();
    const hostDelivery = createDeliveryStore(); const playerDelivery = createDeliveryStore(); const bindingStore = createBindingStore();
    const host = await createMultiplayerHostRoomRuntime({
      roomId: 'room-1', hostDeviceId: 'host-1', template, session, store: hostStore,
      deliveryStore: hostDelivery,
      transport: { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined },
      now: () => 10,
    });
    let finishPersistence!: () => void;
    const persistenceGate = new Promise<void>((resolve) => { finishPersistence = resolve; });
    const originalPutTemplate = playerStore.putTemplate;
    const stop = vi.fn();
    const player = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: host.session.createBootstrapMessage(), deviceId: 'player-device',
      store: playerStore, bindingStore, deliveryStore: playerDelivery,
      transport: { sendToHost: () => true, sendToConnection: () => false, broadcastLocalChanges: async () => undefined, stop },
      now: () => 20,
    });
    playerStore.putTemplate = async (value) => {
      await persistenceGate;
      return originalPutTemplate(value);
    };

    const completion = host.session.complete();
    completion.finalSession.players[0] = { ...session.players[0], scores: { points: { parts: [9] } }, bonusScore: 2, totalScore: 999 };
    completion.finalSession.winnerIds = ['incorrect'];
    const receiving = player.receive(completion);
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    finishPersistence();
    await receiving;
    expect((await playerStore.getSession('session-1'))?.players[0].totalScore).toBe(11);
    expect((await playerStore.getSession('session-1'))?.winnerIds).toEqual(['p1']);
    expect(await player.receive(completion)).toBe(false);
  });

  it('ignores a late completion after the participant has left the room', async () => {
    const store = createRuntimeStore();
    const delivery = createDeliveryStore();
    const bindingStore = createBindingStore();
    const sent: unknown[] = [];
    let released = false;
    const transport: MultiplayerRoomRuntimeTransport = {
      sendToHost: (message) => { sent.push(message); return true; },
      sendToConnection: () => false,
      broadcastLocalChanges: async () => undefined,
      stop: vi.fn(),
    };
    const player = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: {
        type: 'room:bootstrap',
        roomId: 'room-1',
        package: {
          version: 1,
          room: { roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 },
          template,
          session,
          revision: 1,
          exportedAt: 10,
        },
      },
      deviceId: 'player-device',
      store,
      bindingStore,
      deliveryStore: delivery,
      transport,
      onOwnershipReturned: () => { released = true; },
      now: () => 20,
    });

    expect(player.leaveRoom()).toBe(true);
    expect(sent).toEqual([expect.objectContaining({ type: 'room:leave' })]);

    const completed = await player.receive({
      type: 'session:completed',
      roomId: 'room-1',
      sessionId: 'session-1',
      template,
      finalSession: { ...session, status: 'completed' },
      revision: 2,
      completedAt: 30,
    });

    expect(completed).toBe(false);
    expect(released).toBe(false);
    expect(transport.stop).toHaveBeenCalledTimes(1);
  });
});
