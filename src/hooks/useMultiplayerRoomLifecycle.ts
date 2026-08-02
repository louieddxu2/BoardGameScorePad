import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Peer from 'peerjs';
import { AppView } from '../types';
import type { ToastMessage } from './useToast';
import { useAppData } from './useAppData';
import type { AppTranslationKey } from '../i18n/app';
import { isInAppBrowser } from '../components/modals/InAppBrowserGuide';
import { generateId } from '../utils/idGenerator';
import { createLocalScoreStateSyncAdapter, multiplayerLocalStore } from '../features/multiplayer/multiplayerLocalStore';
import { getOrCreateMultiplayerDeviceId, multiplayerDeliveryStore } from '../features/multiplayer/multiplayerDeliveryStore';
import { multiplayerParticipantBindingStore, participantBindingKey } from '../features/multiplayer/multiplayerParticipantBinding';
import { createMultiplayerP2PRuntimeTransport } from '../features/multiplayer/multiplayerP2PRuntimeTransport';
import {
  createMultiplayerHostRoomRuntime,
  createMultiplayerPlayerRoomRuntime,
  restoreMultiplayerHostRoomRuntime,
  restoreMultiplayerPlayerRoomRuntime,
} from '../features/multiplayer/multiplayerRoomRuntime';
import { multiplayerSessionManager } from '../features/multiplayer/multiplayerSessionManager';
import type { BootstrapPackageMessage, SessionCompletedMessage } from '../features/multiplayer/protocol';
import { releaseMultiplayerRoomOwnership, retainMultiplayerCompletionRelay } from '../features/multiplayer/multiplayerPersistence';

const MULTIPLAYER_COMPLETION_RELAY_TTL_MS = 5 * 60 * 1000;
const MULTIPLAYER_STATE_CHANGE_EVENT = 'boardgame-scorepad-multiplayer-state-change';

type ScorePadWindow = Window & {
  __boardGameScorePadMultiplayerActive?: boolean;
};

export type ActiveMultiplayerRoom = {
  roomId: string;
  role: 'host' | 'player';
  playerIds?: string[];
};

export type PendingMultiplayerJoin = {
  roomId: string;
  bootstrapMessage: BootstrapPackageMessage;
  transport: ReturnType<typeof createMultiplayerP2PRuntimeTransport>;
};

type UseMultiplayerRoomLifecycleOptions = {
  appData: ReturnType<typeof useAppData>;
  setView: Dispatch<SetStateAction<AppView>>;
  showToast: (options: Omit<ToastMessage, 'id'>) => void;
  tApp: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
};

export const useMultiplayerRoomLifecycle = ({
  appData,
  setView,
  showToast,
  tApp,
}: UseMultiplayerRoomLifecycleOptions) => {
  const [activeMultiplayerRoom, setActiveMultiplayerRoom] = useState<ActiveMultiplayerRoom | null>(null);
  const [isMultiplayerRoomModalOpen, setIsMultiplayerRoomModalOpen] = useState(false);
  const [isMultiplayerParticipantRoomModalOpen, setIsMultiplayerParticipantRoomModalOpen] = useState(false);
  const [pendingMultiplayerJoin, setPendingMultiplayerJoin] = useState<PendingMultiplayerJoin | null>(null);
  const [pendingMultiplayerClaimIds, setPendingMultiplayerClaimIds] = useState<string[] | null>(null);
  const [isJoiningMultiplayer, setIsJoiningMultiplayer] = useState(false);
  const [multiplayerVersion, setMultiplayerVersion] = useState(0);

  const appDataRef = useRef(appData);
  const showToastRef = useRef(showToast);
  const tAppRef = useRef(tApp);
  const activeMultiplayerRoomRef = useRef<ActiveMultiplayerRoom | null>(null);
  const multiplayerJoinStartedRef = useRef<string | null>(null);
  const multiplayerJoinTimeoutRef = useRef<number | null>(null);
  const completionRelayTimeoutsRef = useRef(new Map<string, number>());
  const isJoiningMultiplayerRef = useRef(false);
  const isOpeningRoomRef = useRef(false);

  appDataRef.current = appData;
  showToastRef.current = showToast;
  tAppRef.current = tApp;

  const setActiveRoom = useCallback((room: ActiveMultiplayerRoom | null) => {
    activeMultiplayerRoomRef.current = room;
    setActiveMultiplayerRoom(room);
  }, []);

  const clearMultiplayerJoinTimeout = useCallback(() => {
    if (multiplayerJoinTimeoutRef.current === null) return;
    window.clearTimeout(multiplayerJoinTimeoutRef.current);
    multiplayerJoinTimeoutRef.current = null;
  }, []);

  const clearRoomUrlQuery = useCallback(() => {
    if (!window.location.search.includes('room')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => () => clearMultiplayerJoinTimeout(), [clearMultiplayerJoinTimeout]);

  useEffect(() => () => {
    for (const timeoutId of completionRelayTimeoutsRef.current.values()) window.clearTimeout(timeoutId);
    completionRelayTimeoutsRef.current.clear();
  }, []);

  useEffect(() => multiplayerSessionManager.subscribe(() => setMultiplayerVersion((version) => version + 1)), []);

  useEffect(() => {
    const scorePadWindow = window as ScorePadWindow;
    scorePadWindow.__boardGameScorePadMultiplayerActive = Boolean(
      activeMultiplayerRoom || pendingMultiplayerJoin || isJoiningMultiplayer
    );
    window.dispatchEvent(new Event(MULTIPLAYER_STATE_CHANGE_EVENT));
  }, [activeMultiplayerRoom, isJoiningMultiplayer, pendingMultiplayerJoin]);

  useEffect(() => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    const returned = multiplayerSessionManager.takeReturnedSession(activeMultiplayerRoom.roomId);
    if (!returned) return;

    setActiveRoom(null);
    void appDataRef.current.resumeSessionById(returned.id);
    showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_ownership_returned'), type: 'success' });
  }, [activeMultiplayerRoom, multiplayerVersion, setActiveRoom]);

  useEffect(() => {
    if (!appData.isDbReady || isInAppBrowser()) return;
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (!roomId) return;

    const existingRoom = multiplayerSessionManager.get(roomId);
    if (existingRoom && existingRoom.status === 'connected' && existingRoom.session) {
      multiplayerJoinStartedRef.current = roomId;
      clearMultiplayerJoinTimeout();
      isJoiningMultiplayerRef.current = false;
      setIsJoiningMultiplayer(false);
      if (activeMultiplayerRoomRef.current?.roomId !== roomId) {
        const runtimeSession = existingRoom.runtime?.session as { claimedPlayerIds?: string | string[] } | undefined;
        const rawPlayerIds = runtimeSession?.claimedPlayerIds;
        const existingPlayerIds = rawPlayerIds
          ? (Array.isArray(rawPlayerIds) ? rawPlayerIds : [rawPlayerIds])
          : undefined;
        setActiveRoom({
          roomId,
          role: existingRoom.role,
          playerIds: existingPlayerIds || (activeMultiplayerRoomRef.current?.playerIds ?? []),
        });
      }
      void appDataRef.current.resumeSessionById(existingRoom.session.id).then(() => {
        setView(AppView.ACTIVE_SESSION);
        clearRoomUrlQuery();
      });
      return;
    }

    if (existingRoom) {
      multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    }

    if (multiplayerJoinStartedRef.current === roomId && isJoiningMultiplayerRef.current) return;
    multiplayerJoinStartedRef.current = roomId;
    clearMultiplayerJoinTimeout();
    isJoiningMultiplayerRef.current = true;
    setIsJoiningMultiplayer(true);

    let activeTransport: ReturnType<typeof createMultiplayerP2PRuntimeTransport> | null = null;
    const handleRemoteCompletion = async (message: SessionCompletedMessage) => {
      const managedRoom = multiplayerSessionManager.get(roomId);
      if (managedRoom?.runtime?.role === 'player') {
        await managedRoom.runtime.receive(message);
        return;
      }

      if (isJoiningMultiplayerRef.current && multiplayerJoinStartedRef.current === roomId) {
        clearMultiplayerJoinTimeout();
        activeTransport?.stop?.();
        multiplayerJoinStartedRef.current = null;
        isJoiningMultiplayerRef.current = false;
        setIsJoiningMultiplayer(false);
        setPendingMultiplayerJoin(null);
        clearRoomUrlQuery();
        showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_room_ended'), type: 'info' });
      }
    };

    const adapter = createLocalScoreStateSyncAdapter(roomId, 'player', {
      onRemoteBootstrap: async (bootstrapMessage, persisted) => {
        const managedRoom = multiplayerSessionManager.get(roomId);
        if (managedRoom?.runtime?.role === 'player') {
          const runtime = managedRoom.runtime;
          const templateChanged = JSON.stringify(runtime.session.template) !== JSON.stringify(persisted.templateForSession);
          if (!runtime.applyBootstrap({
            template: persisted.templateForSession,
            session: persisted.session,
            revision: bootstrapMessage.package.revision,
          })) return;
          multiplayerSessionManager.publishSession(roomId, persisted.session);
          if (templateChanged) await appDataRef.current.resumeSessionById(persisted.session.id);
          return;
        }
        if (!isJoiningMultiplayerRef.current || multiplayerJoinStartedRef.current !== roomId) return;
        clearMultiplayerJoinTimeout();
        isJoiningMultiplayerRef.current = false;
        setIsJoiningMultiplayer(false);
        if (activeTransport) setPendingMultiplayerJoin({ roomId, bootstrapMessage, transport: activeTransport });
      },
      onRemoteCompletion: handleRemoteCompletion,
    });

    activeTransport = createMultiplayerP2PRuntimeTransport({
      Peer,
      adapter,
      logger: (message) => console.info('[multiplayer]', message),
    });
    try {
      activeTransport.joinRoom?.(roomId);
    } catch (error) {
      console.warn('[multiplayer] Failed to start room join:', error);
      activeTransport.stop?.();
      multiplayerJoinStartedRef.current = null;
      isJoiningMultiplayerRef.current = false;
      setIsJoiningMultiplayer(false);
      setPendingMultiplayerJoin(null);
      clearRoomUrlQuery();
      showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
    }

    multiplayerJoinTimeoutRef.current = window.setTimeout(() => {
      const managedRoom = multiplayerSessionManager.get(roomId);
      if (managedRoom?.role === 'player' && managedRoom.runtime) {
        clearMultiplayerJoinTimeout();
        isJoiningMultiplayerRef.current = false;
        setIsJoiningMultiplayer(false);
        const runtimeSession = managedRoom.runtime.session as { session: { id: string }; claimedPlayerIds?: string | string[] };
        const rawPlayerIds = runtimeSession.claimedPlayerIds;
        const playerIds = rawPlayerIds
          ? (Array.isArray(rawPlayerIds) ? rawPlayerIds : [rawPlayerIds])
          : [];
        setActiveRoom({ roomId, role: 'player', playerIds });
        void appDataRef.current.resumeSessionById(runtimeSession.session.id).then(() => {
          setView(AppView.ACTIVE_SESSION);
          clearRoomUrlQuery();
        });
        return;
      }
      if (multiplayerJoinStartedRef.current === roomId) {
        activeTransport?.stop?.();
        multiplayerJoinStartedRef.current = null;
        clearRoomUrlQuery();
        showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
      }
      isJoiningMultiplayerRef.current = false;
      setIsJoiningMultiplayer(false);
    }, 15000);

    return () => {
      clearMultiplayerJoinTimeout();
      if (multiplayerJoinStartedRef.current === roomId && !multiplayerSessionManager.get(roomId)) {
        activeTransport?.stop?.();
        isJoiningMultiplayerRef.current = false;
        setIsJoiningMultiplayer(false);
        setPendingMultiplayerJoin(null);
      }
    };
  }, [appData.isDbReady, clearMultiplayerJoinTimeout, clearRoomUrlQuery, setActiveRoom, setView]);

  const tryRestoreMultiplayerRoom = useCallback(async (sessionId: string) => {
    try {
      const room = await multiplayerLocalStore.getRoomBySessionId(sessionId);
      if (!room) return;

      const existingManagedRoom = multiplayerSessionManager.get(room.roomId);
      if (existingManagedRoom?.runtime) {
        if (room.role === 'host') {
          setActiveRoom({ roomId: room.roomId, role: 'host' });
        } else {
          const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
          const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(room.roomId, deviceId));
          const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
          setActiveRoom({ roomId: room.roomId, role: 'player', playerIds });
        }
        return;
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
          setActiveRoom({ roomId: room.roomId, role: 'host' });
        }
      } else {
        const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
        const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(room.roomId, deviceId));
        const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
        const adapter = createLocalScoreStateSyncAdapter(room.roomId, 'player', {
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
        });
        if (runtime) {
          multiplayerSessionManager.register(room.roomId, runtime, 'connecting');
          transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(room.roomId, connectionCount));
          runtime.start();
          await runtime.restoreParticipantBinding();
          setActiveRoom({ roomId: room.roomId, role: 'player', playerIds });
        }
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to restore multiplayer room:', err);
    }
  }, [setActiveRoom]);

  const handleOpenMultiplayerRoom = useCallback(async () => {
    if (isOpeningRoomRef.current) return;
    if (activeMultiplayerRoom?.role === 'host') {
      setIsMultiplayerRoomModalOpen(true);
      return;
    }
    if (!appDataRef.current.currentSession || !appDataRef.current.activeTemplate) return;

    isOpeningRoomRef.current = true;
    try {
      const roomId = `scorepad-${generateId(12)}`;
      const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
      const adapter = createLocalScoreStateSyncAdapter(roomId, 'host');
      const transport = createMultiplayerP2PRuntimeTransport({ Peer, adapter, logger: (message) => console.info('[multiplayer]', message) });
      const callbacks = multiplayerSessionManager.createRuntimeCallbacks(roomId);
      const runtime = await createMultiplayerHostRoomRuntime({
        roomId,
        hostDeviceId: deviceId,
        template: appDataRef.current.activeTemplate,
        session: appDataRef.current.currentSession,
        store: multiplayerLocalStore,
        deliveryStore: multiplayerDeliveryStore,
        transport,
        onSessionSnapshot: callbacks.onSessionSnapshot,
        onParticipantClaims: (claims) => multiplayerSessionManager.setParticipantClaims(roomId, claims),
      });
      multiplayerSessionManager.register(roomId, runtime, 'connecting');
      transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount));
      runtime.start();
      setActiveRoom({ roomId, role: 'host' });
      setIsMultiplayerRoomModalOpen(true);
    } finally {
      isOpeningRoomRef.current = false;
    }
  }, [activeMultiplayerRoom?.role, setActiveRoom]);

  const handleConfirmMultiplayerPlayers = useCallback(async (playerIds: string[]) => {
    if (!pendingMultiplayerJoin) return;
    const { roomId, bootstrapMessage, transport } = pendingMultiplayerJoin;
    const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
    const callbacks = multiplayerSessionManager.createRuntimeCallbacks(roomId);
    const runtime = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage,
      deviceId,
      store: multiplayerLocalStore,
      bindingStore: multiplayerParticipantBindingStore,
      deliveryStore: multiplayerDeliveryStore,
      transport,
      onSessionSnapshot: callbacks.onSessionSnapshot,
      onOwnershipReturned: callbacks.onOwnershipReturned,
    });
    multiplayerSessionManager.register(roomId, runtime, 'connected');
    transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount));
    for (const playerId of playerIds) runtime.controller.claimPlayer(playerId);
    setActiveRoom({ roomId, role: 'player', playerIds });
    setPendingMultiplayerJoin(null);
    clearRoomUrlQuery();
    const resumed = await appDataRef.current.resumeSessionById(runtime.session.session.id);
    if (resumed) setView(AppView.ACTIVE_SESSION);
  }, [clearRoomUrlQuery, pendingMultiplayerJoin, setActiveRoom, setView]);

  const handleRequestMultiplayerPlayerClaim = useCallback((playerId: string) => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    if (activeMultiplayerRoom.playerIds?.includes(playerId)) return;
    setPendingMultiplayerClaimIds([playerId]);
  }, [activeMultiplayerRoom]);

  const handleConfirmMultiplayerPlayerClaims = useCallback((playerIds: string[]) => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    const managedRoom = multiplayerSessionManager.get(activeMultiplayerRoom.roomId);
    if (managedRoom?.runtime?.role !== 'player') return;

    const existingPlayerIds = activeMultiplayerRoom.playerIds ?? [];
    const nextPlayerIds = [...new Set([...existingPlayerIds, ...playerIds])];
    for (const playerId of nextPlayerIds) {
      if (!existingPlayerIds.includes(playerId)) managedRoom.runtime.controller.claimPlayer(playerId);
    }
    setActiveRoom({ ...activeMultiplayerRoom, playerIds: nextPlayerIds });
    setPendingMultiplayerClaimIds(null);
  }, [activeMultiplayerRoom, setActiveRoom]);

  const handleCancelMultiplayerPlayerClaims = useCallback(() => setPendingMultiplayerClaimIds(null), []);

  const handleCancelMultiplayerJoin = useCallback(() => {
    pendingMultiplayerJoin?.transport.stop?.();
    setPendingMultiplayerJoin(null);
    isJoiningMultiplayerRef.current = false;
    setIsJoiningMultiplayer(false);
    multiplayerJoinStartedRef.current = null;
    clearRoomUrlQuery();
  }, [clearRoomUrlQuery, pendingMultiplayerJoin]);

  const multiplayerRoomState = activeMultiplayerRoom
    ? multiplayerSessionManager.get(activeMultiplayerRoom.roomId)
    : null;
  const multiplayerJoinUrl = activeMultiplayerRoom?.role === 'host'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(activeMultiplayerRoom.roomId)}`
    : '';

  const handlePublishMultiplayerBoardUpdate = useCallback(async () => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'host') return;
    const managedRoom = multiplayerSessionManager.get(activeMultiplayerRoom.roomId);
    if (managedRoom?.runtime?.role !== 'host') return;
    await managedRoom.runtime.controller.publishBoard();
    multiplayerSessionManager.setUnpublishedBoardUpdate(activeMultiplayerRoom.roomId, false);
  }, [activeMultiplayerRoom]);

  const releaseHostMultiplayerRoom = useCallback(async () => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'host') return;
    const managedRoom = multiplayerSessionManager.get(activeMultiplayerRoom.roomId);
    if (!managedRoom?.runtime || managedRoom.runtime.role !== 'host') return;
    const completed = await managedRoom.runtime.controller.complete();
    const roomRecord = await multiplayerLocalStore.getRoom(activeMultiplayerRoom.roomId);
    const roomId = activeMultiplayerRoom.roomId;
    if (!roomRecord) {
      const localSession = await releaseMultiplayerRoomOwnership({
        store: multiplayerLocalStore,
        roomId,
        session: completed.finalSession,
        completedAt: completed.completedAt,
      });
      multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
      clearRoomUrlQuery();
      setActiveRoom(null);
      setIsMultiplayerParticipantRoomModalOpen(false);
      setIsMultiplayerRoomModalOpen(false);
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
    const timeoutId = window.setTimeout(() => {
      completionRelayTimeoutsRef.current.delete(roomId);
      multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    }, MULTIPLAYER_COMPLETION_RELAY_TTL_MS);
    completionRelayTimeoutsRef.current.set(roomId, timeoutId);
    clearRoomUrlQuery();
    setActiveRoom(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
    setIsMultiplayerRoomModalOpen(false);
    return completed.finalSession;
  }, [activeMultiplayerRoom, clearRoomUrlQuery, setActiveRoom]);

  const releaseParticipantMultiplayerRoom = useCallback(async (options?: { deleteLocalRoom?: boolean }) => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    multiplayerSessionManager.closeRoom(activeMultiplayerRoom.roomId, { deleteLocalRoom: options?.deleteLocalRoom });
    multiplayerJoinStartedRef.current = null;
    clearMultiplayerJoinTimeout();
    isJoiningMultiplayerRef.current = false;
    setIsJoiningMultiplayer(false);
    clearRoomUrlQuery();
    setActiveRoom(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
  }, [activeMultiplayerRoom, clearMultiplayerJoinTimeout, clearRoomUrlQuery, setActiveRoom]);

  return {
    activeMultiplayerRoom,
    activeMultiplayerRoomState: multiplayerRoomState,
    multiplayerJoinUrl,
    pendingMultiplayerJoin,
    pendingMultiplayerClaimIds,
    isJoiningMultiplayer,
    isMultiplayerRoomModalOpen,
    setIsMultiplayerRoomModalOpen,
    isMultiplayerParticipantRoomModalOpen,
    setIsMultiplayerParticipantRoomModalOpen,
    tryRestoreMultiplayerRoom,
    handleOpenMultiplayerRoom,
    handleConfirmMultiplayerPlayers,
    handleRequestMultiplayerPlayerClaim,
    handleConfirmMultiplayerPlayerClaims,
    handleCancelMultiplayerPlayerClaims,
    handleCancelMultiplayerJoin,
    handlePublishMultiplayerBoardUpdate,
    releaseHostMultiplayerRoom,
    releaseParticipantMultiplayerRoom,
  };
};
