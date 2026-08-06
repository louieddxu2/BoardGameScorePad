import { describe, expect, it, vi } from 'vitest';
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

    connected = true;
    player = await createMultiplayerPlayerRoomRuntime({ bootstrapMessage: bootstrap, deviceId: 'player-device', store: playerStore, bindingStore, deliveryStore: playerDelivery, transport: playerTransport, now: () => 30 });
    expect(await player.restoreParticipantBinding()).toBe(true);

    await vi.waitFor(async () => expect(await playerDelivery.listOutbox('room-1', 'session-1')).toHaveLength(0));
    expect(host.session.session.players[0].scores.points).toEqual({ parts: [8] });
    expect(host.session.revision).toBe(2);
  });

  it('restores a host runtime with the original room identity and revision', async () => {
    const store = createRuntimeStore(); const delivery = createDeliveryStore();
    const transport: MultiplayerRoomRuntimeTransport = { sendToHost: () => false, sendToConnection: () => false, broadcastLocalChanges: async () => undefined };
    await createMultiplayerHostRoomRuntime({ roomId: 'room-1', hostDeviceId: 'host-1', template, session, revision: 7, store, deliveryStore: delivery, transport, now: () => 10 });
    const restored = await restoreMultiplayerHostRoomRuntime({ roomId: 'room-1', store, deliveryStore: delivery, transport, now: () => 20 });
    expect(restored?.session.room).toEqual({ roomId: 'room-1', hostDeviceId: 'host-1', createdAt: 10 });
    expect(restored?.session.revision).toBe(7);
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
