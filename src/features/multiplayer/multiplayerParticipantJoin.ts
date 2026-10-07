import { getOrCreateMultiplayerDeviceId, multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { multiplayerLocalStore } from './multiplayerLocalStore';
import { multiplayerParticipantBindingStore, saveParticipantBinding } from './multiplayerParticipantBinding';
import type { createMultiplayerP2PRuntimeTransport } from './multiplayerP2PRuntimeTransport';
import { createMultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import type { MultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import { createPostBootstrapConnectionCountHandler } from './multiplayerConnectionCountHandoff';
import { multiplayerSessionManager } from './multiplayerSessionManager';
import type { BootstrapPackageMessage } from './protocol';

type JoinTransport = ReturnType<typeof createMultiplayerP2PRuntimeTransport>;

export const createMultiplayerParticipantRuntime = (options: {
  roomId: string;
  bootstrapMessage: BootstrapPackageMessage;
  deviceId: string;
  transport: JoinTransport;
  onParticipantCompletion: (roomId: string) => void;
}) => {
  const callbacks = multiplayerSessionManager.createRuntimeCallbacks(options.roomId);
  return createMultiplayerPlayerRoomRuntime({
    bootstrapMessage: options.bootstrapMessage,
    deviceId: options.deviceId,
    store: multiplayerLocalStore,
    bindingStore: multiplayerParticipantBindingStore,
    deliveryStore: multiplayerDeliveryStore,
    transport: options.transport,
    onSessionSnapshot: callbacks.onSessionSnapshot,
    onOwnershipReturned: callbacks.onOwnershipReturned,
    onCompletionReceived: () => options.onParticipantCompletion(options.roomId),
  });
};

/** Apply bootstrap through the existing runtime, reloading only changed templates. */
export const applyMultiplayerParticipantBootstrap = async (options: {
  roomId: string;
  bootstrapMessage: BootstrapPackageMessage;
  resumeSession: (sessionId: string) => Promise<boolean>;
}): Promise<boolean> => {
  const { roomId, bootstrapMessage, resumeSession } = options;
  const managedRoom = multiplayerSessionManager.get(roomId);
  if (managedRoom?.status === 'ownership-returned') return true;
  if (managedRoom?.runtime?.role !== 'player') return false;

  const runtime = managedRoom.runtime;
  const previousTemplate = runtime.session.template;
  if (!await runtime.receive(bootstrapMessage)) return true;
  const templateChanged = JSON.stringify(previousTemplate) !== JSON.stringify(runtime.session.template);
  if (templateChanged) await resumeSession(runtime.session.session.id);
  return true;
};

/** Share in-flight runtime creation; the caller owns the map and join generation. */
export const ensureMultiplayerParticipantRuntime = (options: {
  creations: Map<string, Promise<MultiplayerPlayerRoomRuntime | null>>;
  roomId: string;
  bootstrapMessage: BootstrapPackageMessage;
  transport: JoinTransport;
  isStillCurrent: () => boolean;
  onParticipantCompletion: (roomId: string) => void;
}): Promise<MultiplayerPlayerRoomRuntime | null> => {
  const { creations, roomId, bootstrapMessage, transport, isStillCurrent, onParticipantCompletion } = options;
  const existingRuntime = multiplayerSessionManager.get(roomId)?.runtime;
  if (existingRuntime?.role === 'player') return Promise.resolve(existingRuntime);

  const inFlight = creations.get(roomId);
  if (inFlight) return inFlight;

  const creation = (async () => {
    const runtimeAfterLock = multiplayerSessionManager.get(roomId)?.runtime;
    if (runtimeAfterLock?.role === 'player') return runtimeAfterLock;

    const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
    const runtime = await createMultiplayerParticipantRuntime({
      roomId, bootstrapMessage, deviceId, transport,
      onParticipantCompletion,
    });
    if (!isStillCurrent()) {
      runtime.stop();
      return null;
    }
    multiplayerSessionManager.register(roomId, runtime, 'connected');
    transport.setConnectionChangeHandler?.(createPostBootstrapConnectionCountHandler(
      (connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount),
    ));
    return runtime;
  })();

  creations.set(roomId, creation);
  const clearCreation = () => {
    if (creations.get(roomId) === creation) {
      creations.delete(roomId);
    }
  };
  // Handle both outcomes without hiding the original rejection from callers.
  // An ignored finally() would create another rejected promise.
  void creation.then(clearCreation, clearCreation);
  return creation;
};

/** Completes player selection without owning React state or changing the QR deadline. */
export const confirmMultiplayerParticipantJoin = async (options: {
  pendingJoin: { roomId: string; bootstrapMessage: BootstrapPackageMessage; transport: JoinTransport };
  playerIds: string[];
  isCurrent: () => boolean;
  onParticipantCompletion: (roomId: string) => void;
  onRoomSelected: (playerIds: string[]) => void;
  resumeSession: (sessionId: string) => Promise<boolean>;
  onJoined: () => void;
}): Promise<void> => {
  const { roomId, bootstrapMessage, transport } = options.pendingJoin;
  const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
  if (!options.isCurrent()) return;

  const managedRuntime = multiplayerSessionManager.get(roomId)?.runtime;
  let runtime = managedRuntime?.role === 'player' ? managedRuntime : null;
  if (!runtime) {
    runtime = await createMultiplayerParticipantRuntime({
      roomId, bootstrapMessage, deviceId, transport,
      onParticipantCompletion: options.onParticipantCompletion,
    });
    multiplayerSessionManager.register(roomId, runtime, 'connecting');
    transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount));
  }
  if (!options.isCurrent()) {
    await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    return;
  }

  const normalizedPlayerIds = [...new Set(options.playerIds)];
  await saveParticipantBinding({
    store: multiplayerParticipantBindingStore,
    roomId,
    sessionId: runtime.session.session.id,
    deviceId,
    playerIds: normalizedPlayerIds,
  });
  if (!options.isCurrent()) {
    await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    return;
  }

  // Persist the intended claims before sending them, so reconnect can replay them.
  if (!await runtime.restoreParticipantBinding()) throw new Error('participant_binding_restore_failed');
  if (!options.isCurrent()) {
    await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    return;
  }

  options.onRoomSelected(normalizedPlayerIds);
  if (!await options.resumeSession(runtime.session.session.id)) throw new Error('participant_session_resume_failed');
  if (!options.isCurrent()) return;
  options.onJoined();
};
