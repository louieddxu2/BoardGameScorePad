import Peer from 'peerjs';
import { getOrCreateMultiplayerDeviceId, multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { createLocalScoreStateSyncAdapter, multiplayerLocalStore } from './multiplayerLocalStore';
import { multiplayerParticipantBindingStore, participantBindingKey } from './multiplayerParticipantBinding';
import { createMultiplayerP2PRuntimeTransport } from './multiplayerP2PRuntimeTransport';
import { restoreMultiplayerHostRoomRuntime, restoreMultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import type { MultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import { multiplayerSessionManager } from './multiplayerSessionManager';
import type { MultiplayerTabClaim } from './multiplayerTabCoordinator';
import type { BootstrapPackageMessage } from './protocol';
import type { PersistedBootstrapImport } from './multiplayerPersistence';

type RestoredRoom = { roomId: string; role: 'host' | 'player'; playerIds?: string[] };

/** Restores a persisted room while preserving the participant tab claim across awaits. */
export const restoreMultiplayerRoomForSession = async (options: {
  sessionId: string;
  claimParticipantTab: (roomId: string) => MultiplayerTabClaim;
  ownsParticipantClaim: (claim: MultiplayerTabClaim) => boolean;
  isCurrentParticipantClaim: (claim: MultiplayerTabClaim) => boolean;
  releaseParticipantTabClaim: (roomId: string) => void;
  onRoomRestored: (room: RestoredRoom) => void;
  applyRemoteBootstrap: (roomId: string, message: BootstrapPackageMessage, persisted: PersistedBootstrapImport) => Promise<boolean>;
  onParticipantCompletion: (roomId: string) => void;
}): Promise<boolean> => {
  let participantClaim: MultiplayerTabClaim | null = null;
  const isCurrentParticipantRestore = () => !participantClaim || options.isCurrentParticipantClaim(participantClaim);
  const rejectSupersededRestore = (runtime?: MultiplayerPlayerRoomRuntime | null) => {
    runtime?.stop();
    return false;
  };

  try {
    const room = await multiplayerLocalStore.getRoomBySessionId(options.sessionId);
    if (!room) return true;

    // A completed host relay remains available to reconnecting participants,
    // but no longer represents a room that can be restored into the UI.
    if (room.status === 'completed') return true;

    if (room.role === 'player') {
      participantClaim = options.claimParticipantTab(room.roomId);
      if (!isCurrentParticipantRestore()) return false;
    }

    const existingManagedRoom = multiplayerSessionManager.get(room.roomId);
    if (existingManagedRoom?.runtime) {
      if (room.role === 'host') {
        options.onRoomRestored({ roomId: room.roomId, role: 'host' });
      } else {
        const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
        if (!isCurrentParticipantRestore()) return false;
        const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(room.roomId, deviceId));
        if (!isCurrentParticipantRestore()) return false;
        const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
        options.onRoomRestored({ roomId: room.roomId, role: 'player', playerIds });
      }
      return true;
    }

    if (room.role === 'host') {
      const adapter = createLocalScoreStateSyncAdapter(room.roomId, 'host');
      const transport = createMultiplayerP2PRuntimeTransport({ Peer, adapter, logger: (message) => console.info('[multiplayer]', message) });
      const callbacks = multiplayerSessionManager.createRuntimeCallbacks(room.roomId);
      const runtime = await restoreMultiplayerHostRoomRuntime({
        roomId: room.roomId,
        store: multiplayerLocalStore,
        deliveryStore: multiplayerDeliveryStore,
        transport,
        onSessionSnapshot: callbacks.onSessionSnapshot,
        onParticipantClaims: (claims) => multiplayerSessionManager.setParticipantClaims(room.roomId, claims),
      });
      if (runtime) {
        multiplayerSessionManager.register(room.roomId, runtime, 'connecting');
        transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(room.roomId, connectionCount));
        runtime.start();
        options.onRoomRestored({ roomId: room.roomId, role: 'host' });
      }
      return true;
    }

    const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
    if (!isCurrentParticipantRestore()) return false;
    const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(room.roomId, deviceId));
    if (!isCurrentParticipantRestore()) return false;
    const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
    const adapter = createLocalScoreStateSyncAdapter(room.roomId, 'player', {
      onRemoteBootstrap: async (message, persisted) => {
        await options.applyRemoteBootstrap(room.roomId, message, persisted);
      },
      onRemoteCompletion: async (message) => {
        const managedRoom = multiplayerSessionManager.get(room.roomId);
        if (managedRoom?.runtime?.role === 'player') await managedRoom.runtime.receive(message);
      },
    });
    const transport = createMultiplayerP2PRuntimeTransport({ Peer, adapter, logger: (message) => console.info('[multiplayer]', message) });
    const callbacks = multiplayerSessionManager.createRuntimeCallbacks(room.roomId);
    const runtime = await restoreMultiplayerPlayerRoomRuntime({
      roomId: room.roomId,
      deviceId,
      store: multiplayerLocalStore,
      bindingStore: multiplayerParticipantBindingStore,
      deliveryStore: multiplayerDeliveryStore,
      transport,
      onSessionSnapshot: callbacks.onSessionSnapshot,
      onOwnershipReturned: callbacks.onOwnershipReturned,
      onCompletionReceived: () => options.onParticipantCompletion(room.roomId),
    });
    if (!isCurrentParticipantRestore()) return rejectSupersededRestore(runtime);
    if (runtime) {
      multiplayerSessionManager.register(room.roomId, runtime, 'connecting');
      transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(room.roomId, connectionCount));
      runtime.start();
      await runtime.restoreParticipantBinding();
      if (!isCurrentParticipantRestore()) return rejectSupersededRestore(runtime);
      options.onRoomRestored({ roomId: room.roomId, role: 'player', playerIds });
      return true;
    }
    options.releaseParticipantTabClaim(room.roomId);
    return false;
  } catch (error) {
    console.warn('[multiplayer] Failed to restore multiplayer room:', error);
    if (participantClaim && options.ownsParticipantClaim(participantClaim)) {
      options.releaseParticipantTabClaim(participantClaim.roomId);
    }
    return participantClaim === null;
  }
};
