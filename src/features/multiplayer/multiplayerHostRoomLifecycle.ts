import Peer from 'peerjs';
import type { GameSession, GameTemplate } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { getOrCreateMultiplayerDeviceId, multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { createLocalScoreStateSyncAdapter, multiplayerLocalStore } from './multiplayerLocalStore';
import { createMultiplayerP2PRuntimeTransport } from './multiplayerP2PRuntimeTransport';
import { createMultiplayerHostRoomRuntime } from './multiplayerRoomRuntime';
import { multiplayerSessionManager } from './multiplayerSessionManager';
import { releaseMultiplayerRoomOwnership, retainMultiplayerCompletionRelay } from './multiplayerPersistence';

/** Bootstrap and start a host room while honoring the caller's cancellation token. */
export const openMultiplayerHostRoom = async ({
  readBoard, isCurrentRequest, onOpened, onOpenError, onSettled,
}: {
  readBoard: () => { currentSession: GameSession | null; activeTemplate: GameTemplate | null };
  isCurrentRequest: () => boolean;
  onOpened: (roomId: string) => void;
  onOpenError: () => void;
  onSettled: () => void;
}): Promise<void> => {
  let roomId: string | undefined;
  let transport: ReturnType<typeof createMultiplayerP2PRuntimeTransport> | undefined;
  let registered = false;
  let opened = false;
  try {
    const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
    const { currentSession: roomSession, activeTemplate: roomTemplate } = readBoard();
    if (!isCurrentRequest() || !roomSession || !roomTemplate) return;

    roomId = `scorepad-${generateId(12)}`;
    const createdRoomId = roomId;
    const adapter = createLocalScoreStateSyncAdapter(roomId, 'host');
    transport = createMultiplayerP2PRuntimeTransport({ Peer, adapter, logger: (message) => console.info('[multiplayer]', message) });
    const callbacks = multiplayerSessionManager.createRuntimeCallbacks(roomId);
    const runtime = await createMultiplayerHostRoomRuntime({
      roomId,
      hostDeviceId: deviceId,
      template: roomTemplate,
      session: roomSession,
      store: multiplayerLocalStore,
      deliveryStore: multiplayerDeliveryStore,
      transport,
      onSessionSnapshot: callbacks.onSessionSnapshot,
      onBoardSyncStatus: callbacks.onBoardSyncStatus,
      onParticipantClaims: (claims) => multiplayerSessionManager.setParticipantClaims(createdRoomId, claims),
    });
    // Closing or leaving during bootstrap must not start a late room.
    if (!isCurrentRequest()) return;
    multiplayerSessionManager.register(roomId, runtime, 'connecting');
    registered = true;
    transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(createdRoomId, connectionCount));
    runtime.start();
    onOpened(roomId);
    opened = true;
  } catch (error) {
    console.warn('[multiplayer] Failed to open room:', error);
    if (isCurrentRequest()) onOpenError();
  } finally {
    if (!opened && roomId) {
      try {
        if (!registered) transport?.stop?.();
        await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
      } catch (error) {
        console.warn('[multiplayer] Failed to clean up unopened room:', error);
      }
    }
    onSettled();
  }
};

/** Persist completion before letting the caller clear UI or schedule relay cleanup. */
export const completeMultiplayerHostRoom = async ({
  roomId, onReleased,
}: {
  roomId: string;
  onReleased: (retainedRelay: boolean) => void;
}): Promise<GameSession | undefined> => {
  const managedRoom = multiplayerSessionManager.get(roomId);
  if (!managedRoom?.runtime || managedRoom.runtime.role !== 'host') return;
  const completed = await managedRoom.runtime.controller.complete();
  const roomRecord = await multiplayerLocalStore.getRoom(roomId);
  if (!roomRecord) {
    const localSession = await releaseMultiplayerRoomOwnership({
      store: multiplayerLocalStore,
      roomId,
      session: completed.finalSession,
      completedAt: completed.completedAt,
    });
    await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    onReleased(false);
    return localSession;
  }

  await retainMultiplayerCompletionRelay({
    store: multiplayerLocalStore,
    room: roomRecord,
    template: completed.template,
    session: completed.finalSession,
    revision: completed.revision,
    completedAt: completed.completedAt,
  });
  onReleased(true);
  return completed.finalSession;
};
