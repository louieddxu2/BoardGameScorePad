import { GameSession, GameTemplate } from '../../types';
import { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { MultiplayerParticipantBindingStore, participantBindingKey, saveParticipantBinding } from './multiplayerParticipantBinding';
import { MultiplayerBootstrapStore, MultiplayerSnapshotStore, createMultiplayerRoomRecord, persistMultiplayerBootstrap } from './multiplayerPersistence';
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
}

export type MultiplayerRoomRuntimeStore = MultiplayerBootstrapStore & MultiplayerSnapshotStore;

export interface MultiplayerHostRoomRuntime {
  role: 'host';
  session: ReturnType<typeof createMultiplayerHostSession>;
  controller: ReturnType<typeof createMultiplayerRoomController>;
  start(): void;
  stop(): void;
  receive(message: unknown, connection: unknown): Promise<boolean>;
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
}

export const createMultiplayerHostRoomRuntime = async (options: {
  roomId: string;
  hostDeviceId: string;
  template: GameTemplate;
  session: GameSession;
  revision?: number;
  store: MultiplayerRoomRuntimeStore;
  deliveryStore: MultiplayerDeliveryStore;
  transport: MultiplayerRoomRuntimeTransport;
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
  });
  options.transport.setMessageReceiver?.(async (message, connection) => { await controller.receive(message, connection); });
  return {
    role: 'host', session: hostSession, controller,
    start: () => { options.transport.startHost?.(hostSession.room.roomId); },
    stop: () => { options.transport.stop?.(); },
    receive: (message, connection) => controller.receive(message, connection),
  };
};

export const createMultiplayerPlayerRoomRuntime = async (options: {
  bootstrapMessage: BootstrapPackageMessage;
  deviceId: string;
  store: MultiplayerRoomRuntimeStore;
  bindingStore: MultiplayerParticipantBindingStore;
  deliveryStore: MultiplayerDeliveryStore;
  transport: MultiplayerRoomRuntimeTransport;
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

  let replayAfterClaim = false;
  const controller = createMultiplayerPlayerRoomController({
    playerSession,
    deviceId: options.deviceId,
    deliveryStore: options.deliveryStore,
    snapshotStore: options.store,
    transport: options.transport,
    now,
    onClaimAccepted: async (playerId) => {
      await saveParticipantBinding({
        store: options.bindingStore,
        roomId: playerSession.room.roomId,
        sessionId: playerSession.session.id,
        deviceId: options.deviceId,
        playerId,
        now,
      });
      if (replayAfterClaim) {
        replayAfterClaim = false;
        await controller.replayPendingPatches();
      }
    },
  });
  options.transport.setMessageReceiver?.(async (message) => { await controller.receive(message); });

  return {
    role: 'player', session: playerSession, controller,
    start: () => { options.transport.joinRoom?.(playerSession.room.roomId); },
    stop: () => { options.transport.stop?.(); },
    async restoreParticipantBinding() {
      const binding = await options.bindingStore.get(participantBindingKey(playerSession.room.roomId, options.deviceId));
      if (!binding || binding.sessionId !== playerSession.session.id) return false;
      replayAfterClaim = true;
      controller.claimPlayer(binding.playerId);
      return true;
    },
    receive: (message) => controller.receive(message),
  };
};
