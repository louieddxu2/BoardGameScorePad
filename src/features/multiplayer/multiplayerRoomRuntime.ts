import { GameSession, GameTemplate, MultiplayerRoomRecord } from '../../types';
import { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { MultiplayerParticipantBindingStore, participantBindingKey, saveParticipantBinding } from './multiplayerParticipantBinding';
import { MultiplayerBootstrapStore, MultiplayerCompletionReleaseStore, MultiplayerSnapshotStore, createMultiplayerRoomRecord, persistMultiplayerBootstrap, releaseMultiplayerRoomOwnership } from './multiplayerPersistence';
import { MultiplayerRoomTransport, createMultiplayerPlayerRoomController, createMultiplayerRoomController } from './multiplayerRoomController';
import { createMultiplayerHostSession, createMultiplayerPlayerSessionFromBootstrap } from './multiplayerSession';
import { BootstrapPackageMessage } from './protocol';

/**
 * Runtime composition for a multiplayer room. It deliberately has no PeerJS,
 * QR, or UI dependency: callers provide the established handshake transport.
 */
export interface MultiplayerRoomRuntimeTransport extends MultiplayerRoomTransport {
  startHost?(roomId: string): unknown;
  joinRoom?(roomId: string): unknown;
  stop?(): void;
  setMessageReceiver?(receiver: (message: unknown, connection?: unknown) => void | Promise<void>): void;
  setConnectionOpenHandler?(handler: () => void | Promise<void>): void;
  setConnectionChangeHandler?(handler: (connectionCount: number) => void | Promise<void>): void;
  getConnectionCount?(): number;
}

export type MultiplayerRoomRuntimeStore = MultiplayerBootstrapStore & MultiplayerSnapshotStore;
export type MultiplayerPlayerRoomStore = MultiplayerRoomRuntimeStore & Pick<MultiplayerCompletionReleaseStore, 'deleteRoom'>;
export type MultiplayerRoomRecoveryStore = MultiplayerRoomRuntimeStore & {
  getRoom(roomId: string): Promise<MultiplayerRoomRecord | undefined>;
  getSession(sessionId: string): Promise<GameSession | undefined>;
};

export interface MultiplayerHostRoomRuntime {
  role: 'host';
  session: ReturnType<typeof createMultiplayerHostSession>;
  controller: ReturnType<typeof createMultiplayerRoomController>;
  start(): void;
  stop(): void;
  receive(message: unknown, connection: unknown): Promise<boolean>;
  getConnectionCount(): number;
}

export interface MultiplayerPlayerRoomRuntime {
  role: 'player';
  session: ReturnType<typeof createMultiplayerPlayerSessionFromBootstrap>;
  controller: ReturnType<typeof createMultiplayerPlayerRoomController>;
  start(): void;
  stop(): void;
  /** Reclaims the previously selected player; pending edits replay only after acceptance. */
  restoreParticipantBinding(): Promise<boolean>;
  receive(message: unknown): Promise<boolean>;
  getConnectionCount(): number;
}

export const createMultiplayerHostRoomRuntime = async (options: {
  roomId: string;
  hostDeviceId: string;
  template: GameTemplate;
  session: GameSession;
  revision?: number;
  createdAt?: number;
  store: MultiplayerRoomRuntimeStore;
  deliveryStore: MultiplayerDeliveryStore;
  transport: MultiplayerRoomRuntimeTransport;
  onSessionSnapshot?: (session: GameSession) => void | Promise<void>;
  now?: () => number;
}): Promise<MultiplayerHostRoomRuntime> => {
  const now = options.now ?? Date.now;
  const hostSession = createMultiplayerHostSession(options);
  await options.store.putTemplate(hostSession.template);
  await options.store.putSession(hostSession.session);
  await options.store.putRoom(createMultiplayerRoomRecord({
    room: hostSession.room,
    session: hostSession.session,
    revision: hostSession.revision,
    role: 'host',
    updatedAt: now(),
  }));
  const controller = createMultiplayerRoomController({
    role: 'host', hostSession, deliveryStore: options.deliveryStore,
    snapshotStore: options.store, transport: options.transport, now,
    onSnapshot: async (snapshot) => { await options.onSessionSnapshot?.(snapshot.session); },
  });
  options.transport.setMessageReceiver?.(async (message, connection) => { await controller.receive(message, connection); });
  return {
    role: 'host', session: hostSession, controller,
    start: () => { options.transport.startHost?.(hostSession.room.roomId); },
    stop: () => { options.transport.stop?.(); },
    receive: (message, connection) => controller.receive(message, connection),
    getConnectionCount: () => options.transport.getConnectionCount?.() ?? 0,
  };
};

/** Rehydrates an existing host room without changing its room identity or revision. */
export const restoreMultiplayerHostRoomRuntime = async (options: {
  roomId: string;
  store: MultiplayerRoomRecoveryStore;
  deliveryStore: MultiplayerDeliveryStore;
  transport: MultiplayerRoomRuntimeTransport;
  now?: () => number;
}): Promise<MultiplayerHostRoomRuntime | null> => {
  const room = await options.store.getRoom(options.roomId);
  if (!room || room.role !== 'host') return null;
  const [session, template] = await Promise.all([
    options.store.getSession(room.sessionId),
    options.store.getTemplate(room.templateId),
  ]);
  if (!session || !template || session.status !== 'active') return null;
  return createMultiplayerHostRoomRuntime({
    roomId: room.roomId,
    hostDeviceId: room.hostDeviceId,
    template,
    session,
    revision: room.revision,
    createdAt: room.createdAt,
    store: options.store,
    deliveryStore: options.deliveryStore,
    transport: options.transport,
    now: options.now,
  });
};

export const createMultiplayerPlayerRoomRuntime = async (options: {
  bootstrapMessage: BootstrapPackageMessage;
  deviceId: string;
  store: MultiplayerPlayerRoomStore;
  bindingStore: MultiplayerParticipantBindingStore;
  deliveryStore: MultiplayerDeliveryStore;
  transport: MultiplayerRoomRuntimeTransport;
  onOwnershipReturned?: (session: GameSession) => void | Promise<void>;
  onSessionSnapshot?: (session: GameSession) => void | Promise<void>;
  now?: () => number;
}): Promise<MultiplayerPlayerRoomRuntime> => {
  const now = options.now ?? Date.now;
  const localTemplate = await options.store.getTemplate(options.bootstrapMessage.package.template.id);
  const playerSession = createMultiplayerPlayerSessionFromBootstrap({
    bootstrapMessage: options.bootstrapMessage,
    localTemplate,
    now,
  });
  await persistMultiplayerBootstrap(options.bootstrapMessage, options.store, 'player');

  let pendingReplayClaims = new Set<string>();
  const controller = createMultiplayerPlayerRoomController({
    playerSession,
    deviceId: options.deviceId,
    deliveryStore: options.deliveryStore,
    snapshotStore: options.store,
    transport: options.transport,
    now,
    onClaimAccepted: async (playerId) => {
      const existing = await options.bindingStore.get(participantBindingKey(playerSession.room.roomId, options.deviceId));
      const playerIds = new Set(existing?.playerIds ?? (existing?.playerId ? [existing.playerId] : []));
      playerIds.add(playerId);
      await saveParticipantBinding({
        store: options.bindingStore,
        roomId: playerSession.room.roomId,
        sessionId: playerSession.session.id,
        deviceId: options.deviceId,
        playerIds: [...playerIds],
        now,
      });
      pendingReplayClaims.delete(playerId);
      if (pendingReplayClaims.size === 0) {
        await controller.replayPendingPatches();
      }
    },
    onCompleted: async (message) => {
      const localSession = await releaseMultiplayerRoomOwnership({
        store: options.store,
        roomId: playerSession.room.roomId,
        session: message.finalSession,
        completedAt: message.completedAt,
      });
      const pending = await options.deliveryStore.listOutbox(playerSession.room.roomId, playerSession.session.id);
      await Promise.all(pending.map((record) => options.deliveryStore.deleteOutbox(record.id)));
      await options.bindingStore.delete(participantBindingKey(playerSession.room.roomId, options.deviceId));
      options.transport.stop?.();
      await options.onOwnershipReturned?.(localSession);
    },
    onSnapshot: async (snapshot) => { await options.onSessionSnapshot?.(snapshot.session); },
  });
  const restoreParticipantBinding = async () => {
    const binding = await options.bindingStore.get(participantBindingKey(playerSession.room.roomId, options.deviceId));
    const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
    if (!binding || binding.sessionId !== playerSession.session.id || !playerIds.length) return false;
    pendingReplayClaims = new Set(playerIds);
    for (const playerId of playerIds) controller.claimPlayer(playerId);
    return true;
  };
  options.transport.setMessageReceiver?.(async (message) => { await controller.receive(message); });
  options.transport.setConnectionOpenHandler?.(async () => { await restoreParticipantBinding(); });

  return {
    role: 'player', session: playerSession, controller,
    start: () => { options.transport.joinRoom?.(playerSession.room.roomId); },
    stop: () => { options.transport.stop?.(); },
    restoreParticipantBinding,
    receive: (message) => controller.receive(message),
    getConnectionCount: () => options.transport.getConnectionCount?.() ?? 0,
  };
};
