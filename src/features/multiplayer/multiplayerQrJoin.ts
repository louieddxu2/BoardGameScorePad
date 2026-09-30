import Peer from 'peerjs';
import { createLocalScoreStateSyncAdapter } from './multiplayerLocalStore';
import { createMultiplayerP2PRuntimeTransport } from './multiplayerP2PRuntimeTransport';
import { multiplayerSessionManager } from './multiplayerSessionManager';
import type { PersistedBootstrapImport } from './multiplayerPersistence';
import type { BootstrapPackageMessage, SessionCompletedMessage } from './protocol';

type JoinTransport = ReturnType<typeof createMultiplayerP2PRuntimeTransport>;

/** Owns the network side of a fresh QR join; the caller owns its UI and deadline. */
export const startMultiplayerQrJoin = async (options: {
  roomId: string;
  isCurrent: () => boolean;
  isJoining: () => boolean;
  onRoomClosed: () => void;
  onJoining: () => void;
  onTransportCreated: (transport: JoinTransport) => void;
  applyExistingBootstrap: (message: BootstrapPackageMessage, persisted: PersistedBootstrapImport) => Promise<boolean>;
  onInitialBootstrap: (message: BootstrapPackageMessage, transport: JoinTransport) => Promise<void>;
  onJoinCompleted: () => void;
  onStartFailed: () => void;
}): Promise<void> => {
  if (!options.isCurrent()) return;
  const existingRoom = multiplayerSessionManager.get(options.roomId);
  if (existingRoom) {
    // A new QR scan always replaces the old runtime, including a reconnecting one.
    await multiplayerSessionManager.closeRoom(options.roomId);
    if (!options.isCurrent()) return;
    options.onRoomClosed();
  }

  options.onJoining();
  let transport: JoinTransport | null = null;
  const adapter = createLocalScoreStateSyncAdapter(options.roomId, 'player', {
    onRemoteBootstrap: async (message, persisted) => {
      if (await options.applyExistingBootstrap(message, persisted)) return;
      if (!options.isJoining() || !options.isCurrent() || !transport) return;
      await options.onInitialBootstrap(message, transport);
    },
    onRemoteCompletion: async (message: SessionCompletedMessage) => {
      const managedRoom = multiplayerSessionManager.get(options.roomId);
      if (managedRoom?.runtime?.role === 'player') {
        await managedRoom.runtime.receive(message);
        return;
      }
      if (options.isJoining() && options.isCurrent()) {
        transport?.stop?.();
        options.onJoinCompleted();
      }
    },
  });

  transport = createMultiplayerP2PRuntimeTransport({
    Peer,
    adapter,
    forceInitialSync: true,
    logger: (message) => console.info('[multiplayer]', message),
  });
  options.onTransportCreated(transport);
  try {
    transport.joinRoom?.(options.roomId);
  } catch (error) {
    console.warn('[multiplayer] Failed to start room join:', error);
    options.onStartFailed();
  }
};
