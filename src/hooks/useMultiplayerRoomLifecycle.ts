import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import type { ToastMessage } from './useToast';
import { useAppData } from './useAppData';
import type { AppTranslationKey } from '../i18n/app';
import { isInAppBrowser } from '../components/modals/InAppBrowserGuide';
import { generateId } from '../utils/idGenerator';
import { createLocalScoreStateSyncAdapter, multiplayerLocalStore } from '../features/multiplayer/multiplayerLocalStore';
import { getOrCreateMultiplayerDeviceId, multiplayerDeliveryStore } from '../features/multiplayer/multiplayerDeliveryStore';
import { multiplayerParticipantBindingStore, participantBindingKey, saveParticipantBinding } from '../features/multiplayer/multiplayerParticipantBinding';
import { createMultiplayerP2PRuntimeTransport } from '../features/multiplayer/multiplayerP2PRuntimeTransport';
import {
  createMultiplayerHostRoomRuntime,
  createMultiplayerPlayerRoomRuntime,
  restoreMultiplayerHostRoomRuntime,
  restoreMultiplayerPlayerRoomRuntime,
} from '../features/multiplayer/multiplayerRoomRuntime';
import { isMultiplayerRoomReusableForQrScan, multiplayerSessionManager } from '../features/multiplayer/multiplayerSessionManager';
import type { BootstrapPackageMessage, SessionCompletedMessage } from '../features/multiplayer/protocol';
import { releaseMultiplayerRoomOwnership, retainMultiplayerCompletionRelay } from '../features/multiplayer/multiplayerPersistence';
import type { PersistedBootstrapImport } from '../features/multiplayer/multiplayerPersistence';
import type { EnterActiveSession } from '../utils/activeSessionNavigation';

const MULTIPLAYER_COMPLETION_RELAY_TTL_MS = 5 * 60 * 1000;
const MULTIPLAYER_PENDING_JOIN_STORAGE_KEY = 'boardgame-scorepad-pending-room-join';
const MULTIPLAYER_PENDING_JOIN_TTL_MS = 60 * 1000;
const MULTIPLAYER_STATE_CHANGE_EVENT = 'boardgame-scorepad-multiplayer-state-change';

type ScorePadWindow = Window & {
  __boardGameScorePadMultiplayerActive?: boolean;
  __boardGameScorePadMultiplayerJoinPending?: boolean;
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
  enterActiveSession: EnterActiveSession;
  showToast: (options: Omit<ToastMessage, 'id'>) => void;
  tApp: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
};

export const useMultiplayerRoomLifecycle = ({
  appData,
  enterActiveSession,
  showToast,
  tApp,
}: UseMultiplayerRoomLifecycleOptions) => {
  const [activeMultiplayerRoom, setActiveMultiplayerRoom] = useState<ActiveMultiplayerRoom | null>(null);
  const [isMultiplayerRoomModalOpen, setIsMultiplayerRoomModalOpen] = useState(false);
  const [isMultiplayerParticipantRoomModalOpen, setIsMultiplayerParticipantRoomModalOpen] = useState(false);
  const [pendingMultiplayerJoin, setPendingMultiplayerJoin] = useState<PendingMultiplayerJoin | null>(null);
  const [pendingMultiplayerClaimIds, setPendingMultiplayerClaimIds] = useState<string[] | null>(null);
  const [isJoiningMultiplayer, setIsJoiningMultiplayer] = useState(false);
  const [isMultiplayerTransitioning, setIsMultiplayerTransitioning] = useState(false);
  const [multiplayerVersion, setMultiplayerVersion] = useState(0);

  const appDataRef = useRef(appData);
  const showToastRef = useRef(showToast);
  const tAppRef = useRef(tApp);
  const activeMultiplayerRoomRef = useRef<ActiveMultiplayerRoom | null>(null);
  const pendingMultiplayerJoinRef = useRef<PendingMultiplayerJoin | null>(null);
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

  const setPendingJoin = useCallback((join: PendingMultiplayerJoin | null) => {
    pendingMultiplayerJoinRef.current = join;
    setPendingMultiplayerJoin(join);
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

  const rememberPendingRoomJoin = useCallback((roomId: string) => {
    try {
      sessionStorage.setItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY, JSON.stringify({ roomId, createdAt: Date.now() }));
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }, []);

  const getPendingRoomJoin = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { roomId?: unknown; createdAt?: unknown };
      if (typeof parsed.roomId !== 'string' || typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > MULTIPLAYER_PENDING_JOIN_TTL_MS) {
        sessionStorage.removeItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY);
        return null;
      }
      return parsed.roomId;
    } catch {
      return null;
    }
  }, []);

  const clearPendingRoomJoin = useCallback(() => {
    try {
      sessionStorage.removeItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }, []);

  const resetMultiplayerJoinState = useCallback((roomId: string, options?: { clearActiveRoom?: boolean }) => {
    const ownsStartedJoin = multiplayerJoinStartedRef.current === roomId;
    const ownsPendingJoin = pendingMultiplayerJoinRef.current?.roomId === roomId;
    const ownsActiveRoom = activeMultiplayerRoomRef.current?.roomId === roomId;
    const clearActiveRoom = options?.clearActiveRoom !== false;

    if (ownsStartedJoin || ownsPendingJoin) clearMultiplayerJoinTimeout();
    if (ownsStartedJoin) {
      multiplayerJoinStartedRef.current = null;
      isJoiningMultiplayerRef.current = false;
      setIsJoiningMultiplayer(false);
    }
    if (ownsPendingJoin) setPendingJoin(null);
    if (clearActiveRoom && ownsActiveRoom) setActiveRoom(null);

    if (ownsStartedJoin || ownsPendingJoin || (clearActiveRoom && ownsActiveRoom)) {
      clearPendingRoomJoin();
      clearRoomUrlQuery();
    }
  }, [clearMultiplayerJoinTimeout, clearPendingRoomJoin, clearRoomUrlQuery, setActiveRoom, setPendingJoin]);

  useEffect(() => () => clearMultiplayerJoinTimeout(), [clearMultiplayerJoinTimeout]);

  useEffect(() => () => {
    for (const timeoutId of completionRelayTimeoutsRef.current.values()) window.clearTimeout(timeoutId);
    completionRelayTimeoutsRef.current.clear();
  }, []);

  useEffect(() => multiplayerSessionManager.subscribe(() => setMultiplayerVersion((version) => version + 1)), []);

  useEffect(() => {
    const scorePadWindow = window as ScorePadWindow;
    scorePadWindow.__boardGameScorePadMultiplayerActive = Boolean(
      activeMultiplayerRoom || pendingMultiplayerJoin || isJoiningMultiplayer || isMultiplayerTransitioning
    );
    scorePadWindow.__boardGameScorePadMultiplayerJoinPending = Boolean(pendingMultiplayerJoin || isJoiningMultiplayer);
    window.dispatchEvent(new Event(MULTIPLAYER_STATE_CHANGE_EVENT));
  }, [activeMultiplayerRoom, isJoiningMultiplayer, isMultiplayerTransitioning, pendingMultiplayerJoin]);

  useEffect(() => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    const returned = multiplayerSessionManager.takeReturnedSession(activeMultiplayerRoom.roomId);
    if (!returned) return;

    setIsMultiplayerTransitioning(true);
    setPendingMultiplayerClaimIds(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
    void (async () => {
      try {
        const resumed = await appDataRef.current.resumeSessionById(returned.id);
        if (!resumed) throw new Error('returned_session_resume_failed');
        showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_ownership_returned'), type: 'success' });
      } catch (error) {
        console.warn('[multiplayer] Failed to restore returned local session:', error);
      } finally {
        // Keep the room active until the local session has been restored. This
        // prevents a fast back/exit action from racing the ownership handoff.
        setActiveRoom(null);
        setIsMultiplayerTransitioning(false);
      }
    })();
  }, [activeMultiplayerRoom, multiplayerVersion, setActiveRoom]);

  const applyRemoteBootstrapToPlayerRuntime = useCallback(async (
    roomId: string,
    bootstrapMessage: BootstrapPackageMessage,
    persisted: PersistedBootstrapImport,
  ) => {
    const managedRoom = multiplayerSessionManager.get(roomId);
    if (managedRoom?.runtime?.role !== 'player') return false;

    const runtime = managedRoom.runtime;
    const templateChanged = JSON.stringify(runtime.session.template) !== JSON.stringify(persisted.templateForSession);
    if (!runtime.applyBootstrap({
      template: persisted.templateForSession,
      session: persisted.session,
      revision: bootstrapMessage.package.revision,
    })) return true;
    multiplayerSessionManager.publishSession(roomId, persisted.session);
    if (templateChanged) await appDataRef.current.resumeSessionById(persisted.session.id);
    return true;
  }, []);

  useEffect(() => {
    if (!appData.isDbReady || isInAppBrowser()) return;
    const roomIdFromUrl = new URLSearchParams(window.location.search).get('room');
    const roomId = roomIdFromUrl ?? getPendingRoomJoin();
    if (!roomId) return;

    // A second scan of the same QR code must not create a second PeerJS
    // handshake. Keep the existing picker visible, or let the current attempt
    // finish; otherwise its loading layer can cover the picker indefinitely.
    const pendingJoin = pendingMultiplayerJoinRef.current;
    if (pendingJoin?.roomId === roomId) {
      clearRoomUrlQuery();
      isJoiningMultiplayerRef.current = false;
      setIsJoiningMultiplayer(false);
      return;
    }
    if (isJoiningMultiplayerRef.current && multiplayerJoinStartedRef.current === roomId) {
      clearRoomUrlQuery();
      return;
    }
    if (pendingJoin && pendingJoin.roomId !== roomId) {
      pendingJoin.transport.stop?.();
      setPendingJoin(null);
    }

    // A QR URL is a one-time join intent, not a persistent reconnect route.
    // Consume it before any async handshake so a reload cannot replay the same
    // join after the user has already left the session.
    rememberPendingRoomJoin(roomId);
    clearRoomUrlQuery();
    let cancelled = false;
    let activeTransport: ReturnType<typeof createMultiplayerP2PRuntimeTransport> | null = null;

    const isCurrentJoin = () => !cancelled && multiplayerJoinStartedRef.current === roomId;
    const getStoredPlayerIds = async () => {
      const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
      const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(roomId, deviceId));
      return binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
    };

    const startJoin = async () => {
      // A destructive exit may have stopped the runtime before its IndexedDB
      // purge finished. Wait before reusing the same QR room so a late purge
      // cannot delete a newly imported bootstrap.
      await multiplayerSessionManager.waitForRoomCleanup(roomId);
      const existingRoom = multiplayerSessionManager.get(roomId);
      let existingPlayerIds: string[] = [];

      if (isMultiplayerRoomReusableForQrScan(existingRoom)) {
        if (existingRoom.role === 'player') {
          existingPlayerIds = await getStoredPlayerIds();
          if (!existingPlayerIds.length && activeMultiplayerRoomRef.current?.roomId === roomId) {
            existingPlayerIds = activeMultiplayerRoomRef.current.playerIds ?? [];
          }
        }

        if (!isCurrentJoin()) return;
        if (existingRoom.role === 'host' || existingPlayerIds.length > 0) {
          clearMultiplayerJoinTimeout();
          isJoiningMultiplayerRef.current = false;
          setIsJoiningMultiplayer(false);
          setActiveRoom({ roomId, role: existingRoom.role, playerIds: existingPlayerIds });

          let resumed = await appDataRef.current.resumeSessionById(existingRoom.session.id);
          if (!resumed && existingRoom.session.status === 'active') {
            // The room manager can outlive a delayed IndexedDB observer update.
            // Restore its canonical snapshot before giving up on the QR intent.
            await multiplayerLocalStore.putSession(existingRoom.session);
            resumed = await appDataRef.current.resumeSessionById(existingRoom.session.id);
          }
          if (resumed && isCurrentJoin()) {
            clearPendingRoomJoin();
            enterActiveSession('qr-join');
            return;
          }
        }

        await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
        if (!isCurrentJoin()) return;
        if (activeMultiplayerRoomRef.current?.roomId === roomId) setActiveRoom(null);
      } else if (existingRoom) {
        await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
        if (!isCurrentJoin()) return;
        if (activeMultiplayerRoomRef.current?.roomId === roomId) setActiveRoom(null);
      }

      clearMultiplayerJoinTimeout();
      isJoiningMultiplayerRef.current = true;
      setIsJoiningMultiplayer(true);

      const handleRemoteCompletion = async (message: SessionCompletedMessage) => {
        const managedRoom = multiplayerSessionManager.get(roomId);
        if (managedRoom?.runtime?.role === 'player') {
          await managedRoom.runtime.receive(message);
          return;
        }

        if (isJoiningMultiplayerRef.current && isCurrentJoin()) {
          clearMultiplayerJoinTimeout();
          activeTransport?.stop?.();
          resetMultiplayerJoinState(roomId);
          showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_room_ended'), type: 'info' });
        }
      };

      const adapter = createLocalScoreStateSyncAdapter(roomId, 'player', {
        onRemoteBootstrap: async (bootstrapMessage, persisted) => {
          if (await applyRemoteBootstrapToPlayerRuntime(roomId, bootstrapMessage, persisted)) return;
          if (!isJoiningMultiplayerRef.current || !isCurrentJoin()) return;

          // Take ownership of the already-running QR transport as soon as the
          // bootstrap arrives. The player picker should only choose claims;
          // it must not delay creation of the runtime that owns reconnects and
          // connection state.
          const existingRuntime = multiplayerSessionManager.get(roomId)?.runtime;
          if (!existingRuntime) {
            const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
            const callbacks = multiplayerSessionManager.createRuntimeCallbacks(roomId);
            const runtime = await createMultiplayerPlayerRoomRuntime({
              bootstrapMessage,
              deviceId,
              store: multiplayerLocalStore,
              bindingStore: multiplayerParticipantBindingStore,
              deliveryStore: multiplayerDeliveryStore,
              transport: activeTransport!,
              onSessionSnapshot: callbacks.onSessionSnapshot,
              onOwnershipReturned: callbacks.onOwnershipReturned,
            });
            multiplayerSessionManager.register(roomId, runtime, 'connecting');
            activeTransport?.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount));
          }

          clearMultiplayerJoinTimeout();
          isJoiningMultiplayerRef.current = false;
          setIsJoiningMultiplayer(false);
          if (activeTransport) {
            multiplayerJoinStartedRef.current = null;
            setPendingJoin({ roomId, bootstrapMessage, transport: activeTransport });
          }
        },
        onRemoteCompletion: handleRemoteCompletion,
      });

      activeTransport = createMultiplayerP2PRuntimeTransport({
        Peer,
        adapter,
        forceInitialSync: true,
        logger: (message) => console.info('[multiplayer]', message),
      });
      try {
        activeTransport.joinRoom?.(roomId);
      } catch (error) {
        console.warn('[multiplayer] Failed to start room join:', error);
        activeTransport.stop?.();
        resetMultiplayerJoinState(roomId);
        showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
        return;
      }

      multiplayerJoinTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        const managedRoom = multiplayerSessionManager.get(roomId);

        const failCurrentJoin = async () => {
          activeTransport?.stop?.();
          await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
          if (!isCurrentJoin()) return;
          resetMultiplayerJoinState(roomId);
          showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
        };

        if (managedRoom?.role === 'player' && managedRoom.runtime) {
          clearMultiplayerJoinTimeout();
          isJoiningMultiplayerRef.current = false;
          setIsJoiningMultiplayer(false);
          void getStoredPlayerIds().then(async (playerIds) => {
            if (!isCurrentJoin()) return;
            if (!playerIds.length) {
              // A runtime without an accepted binding still needs the initial
              // player picker; do not silently enter an uneditable board.
              await failCurrentJoin();
              return;
            }
            setActiveRoom({ roomId, role: 'player', playerIds });
            let resumed = false;
            try {
              resumed = await appDataRef.current.resumeSessionById(managedRoom.session?.id ?? managedRoom.runtime!.session.session.id);
            } catch (error) {
              console.warn('[multiplayer] Failed to resume player session after join timeout:', error);
            }
            if (!resumed) {
              await failCurrentJoin();
              return;
            }
            if (!isCurrentJoin()) return;
            resetMultiplayerJoinState(roomId, { clearActiveRoom: false });
            enterActiveSession('qr-join');
          }).catch((error) => {
            console.warn('[multiplayer] Failed to finish timed-out room join:', error);
            void failCurrentJoin();
          });
          return;
        }
        if (isCurrentJoin()) {
          void failCurrentJoin();
        }
      }, 15000);
    };

    multiplayerJoinStartedRef.current = roomId;
    void startJoin().catch(async (error) => {
      if (cancelled) return;
      console.warn('[multiplayer] Failed to join room:', error);
      activeTransport?.stop?.();
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
      if (!isCurrentJoin()) return;
      resetMultiplayerJoinState(roomId);
      showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
    });

    return () => {
      cancelled = true;
      clearMultiplayerJoinTimeout();
      if (multiplayerJoinStartedRef.current === roomId && !multiplayerSessionManager.get(roomId)) {
        activeTransport?.stop?.();
        multiplayerJoinStartedRef.current = null;
        isJoiningMultiplayerRef.current = false;
        setIsJoiningMultiplayer(false);
        setPendingJoin(null);
      }
    };
  }, [appData.isDbReady, applyRemoteBootstrapToPlayerRuntime, clearMultiplayerJoinTimeout, clearPendingRoomJoin, clearRoomUrlQuery, enterActiveSession, getPendingRoomJoin, rememberPendingRoomJoin, resetMultiplayerJoinState, setActiveRoom, setPendingJoin]);

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
          onRemoteBootstrap: async (bootstrapMessage, persisted) => {
            await applyRemoteBootstrapToPlayerRuntime(room.roomId, bootstrapMessage, persisted);
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
  }, [applyRemoteBootstrapToPlayerRuntime, setActiveRoom]);

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
    const pendingJoin = pendingMultiplayerJoinRef.current;
    if (!pendingJoin) return;
    const { roomId, bootstrapMessage, transport } = pendingJoin;
    const isCurrentPendingJoin = () => pendingMultiplayerJoinRef.current?.roomId === roomId && pendingMultiplayerJoinRef.current.transport === transport;

    try {
      const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
      if (!isCurrentPendingJoin()) return;

      const managedRuntime = multiplayerSessionManager.get(roomId)?.runtime;
      let runtime = managedRuntime?.role === 'player' ? managedRuntime : null;
      if (!runtime) {
        const callbacks = multiplayerSessionManager.createRuntimeCallbacks(roomId);
        runtime = await createMultiplayerPlayerRoomRuntime({
          bootstrapMessage,
          deviceId,
          store: multiplayerLocalStore,
          bindingStore: multiplayerParticipantBindingStore,
          deliveryStore: multiplayerDeliveryStore,
          transport,
          onSessionSnapshot: callbacks.onSessionSnapshot,
          onOwnershipReturned: callbacks.onOwnershipReturned,
        });
        multiplayerSessionManager.register(roomId, runtime, 'connecting');
        transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount));
      }
      if (!isCurrentPendingJoin()) {
        await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
        return;
      }

      const normalizedPlayerIds = [...new Set(playerIds)];
      await saveParticipantBinding({
        store: multiplayerParticipantBindingStore,
        roomId,
        sessionId: runtime.session.session.id,
        deviceId,
        playerIds: normalizedPlayerIds,
      });
      if (!isCurrentPendingJoin()) {
        await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
        return;
      }

      // Persist the intended claims before sending them. If the connection drops
      // during the first claim, the transport's reconnect hook can send them
      // again instead of leaving this device connected but unable to edit.
      if (!await runtime.restoreParticipantBinding()) throw new Error('participant_binding_restore_failed');
      if (!isCurrentPendingJoin()) {
        await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
        return;
      }

      setActiveRoom({ roomId, role: 'player', playerIds: normalizedPlayerIds });
      clearRoomUrlQuery();
      const resumed = await appDataRef.current.resumeSessionById(runtime.session.session.id);
      if (!resumed) throw new Error('participant_session_resume_failed');
      if (!isCurrentPendingJoin()) return;
      setPendingJoin(null);
      clearPendingRoomJoin();
      enterActiveSession('qr-join');
    } catch (error) {
      if (!isCurrentPendingJoin()) return;
      console.warn('[multiplayer] Failed to finish player join:', error);
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
      resetMultiplayerJoinState(roomId);
      showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
    }
  }, [clearPendingRoomJoin, clearRoomUrlQuery, enterActiveSession, resetMultiplayerJoinState, setActiveRoom, setPendingJoin]);

  const handleRequestMultiplayerPlayerClaim = useCallback((_playerId: string) => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    setPendingMultiplayerClaimIds([...(activeMultiplayerRoom.playerIds ?? [])]);
  }, [activeMultiplayerRoom]);

  const handleConfirmMultiplayerPlayerClaims = useCallback((playerIds: string[]) => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    const managedRoom = multiplayerSessionManager.get(activeMultiplayerRoom.roomId);
    if (managedRoom?.runtime?.role !== 'player') return;

    const nextPlayerIds = [...new Set(playerIds)];
    if (!managedRoom.runtime.controller.setPlayerClaims(nextPlayerIds)) return;
    setActiveRoom({ ...activeMultiplayerRoom, playerIds: nextPlayerIds });
    setPendingMultiplayerClaimIds(null);
  }, [activeMultiplayerRoom, setActiveRoom]);

  const handleCancelMultiplayerPlayerClaims = useCallback(() => setPendingMultiplayerClaimIds(null), []);

  const handleCancelMultiplayerJoin = useCallback(() => {
    const pendingJoin = pendingMultiplayerJoinRef.current;
    if (pendingJoin?.roomId && multiplayerSessionManager.get(pendingJoin.roomId)?.runtime) {
      void multiplayerSessionManager.closeRoom(pendingJoin.roomId, { deleteLocalRoom: true });
    } else {
      pendingJoin?.transport.stop?.();
    }
    if (pendingJoin) resetMultiplayerJoinState(pendingJoin.roomId);
  }, [resetMultiplayerJoinState]);

  const prepareMultiplayerSessionExit = useCallback(() => {
    // Remove the QR join route before any persistence or transport work. This
    // makes an in-flight SW update or page reload land on the dashboard rather
    // than replaying the room join.
    clearRoomUrlQuery();
    clearPendingRoomJoin();
    multiplayerJoinStartedRef.current = null;
    clearMultiplayerJoinTimeout();
    setIsMultiplayerTransitioning(true);
  }, [clearMultiplayerJoinTimeout, clearPendingRoomJoin, clearRoomUrlQuery]);

  const finalizeMultiplayerSessionExit = useCallback(() => {
    const activeRoom = activeMultiplayerRoomRef.current;
    if (activeRoom?.role === 'host') {
      multiplayerSessionManager.detachView(activeRoom.roomId);
      // Keep the host runtime and local room record for explicit resume from
      // the active-session card, but do not keep the dashboard marked active.
      setActiveRoom(null);
      setIsMultiplayerRoomModalOpen(false);
    }

    setIsMultiplayerTransitioning(false);
  }, [setActiveRoom]);

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
    const activeRoom = activeMultiplayerRoomRef.current;
    if (!activeRoom || activeRoom.role !== 'host') return;
    const managedRoom = multiplayerSessionManager.get(activeRoom.roomId);
    if (!managedRoom?.runtime || managedRoom.runtime.role !== 'host') return;
    const completed = await managedRoom.runtime.controller.complete();
    const roomRecord = await multiplayerLocalStore.getRoom(activeRoom.roomId);
    const roomId = activeRoom.roomId;
    if (!roomRecord) {
      const localSession = await releaseMultiplayerRoomOwnership({
        store: multiplayerLocalStore,
        roomId,
        session: completed.finalSession,
        completedAt: completed.completedAt,
      });
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
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
      void multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    }, MULTIPLAYER_COMPLETION_RELAY_TTL_MS);
    completionRelayTimeoutsRef.current.set(roomId, timeoutId);
    clearRoomUrlQuery();
    clearPendingRoomJoin();
    setActiveRoom(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
    setIsMultiplayerRoomModalOpen(false);
    return completed.finalSession;
  }, [clearPendingRoomJoin, clearRoomUrlQuery, setActiveRoom]);

  const releaseParticipantMultiplayerRoom = useCallback(async (options?: { deleteLocalRoom?: boolean; awaitLocalCleanup?: boolean }) => {
    const activeRoom = activeMultiplayerRoomRef.current;
    if (!activeRoom || activeRoom.role !== 'player') return;
    const managedRoom = multiplayerSessionManager.get(activeRoom.roomId);
    if (managedRoom?.runtime?.role === 'player') {
      managedRoom.runtime.leaveRoom();
    }
    await multiplayerSessionManager.closeRoom(activeRoom.roomId, {
      deleteLocalRoom: options?.deleteLocalRoom,
      awaitLocalCleanup: options?.awaitLocalCleanup,
    });
    multiplayerJoinStartedRef.current = null;
    clearMultiplayerJoinTimeout();
    isJoiningMultiplayerRef.current = false;
    setIsJoiningMultiplayer(false);
    clearRoomUrlQuery();
    clearPendingRoomJoin();
    setActiveRoom(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
  }, [clearMultiplayerJoinTimeout, clearPendingRoomJoin, clearRoomUrlQuery, setActiveRoom]);

  const releaseMultiplayerRoomForSession = useCallback(async (sessionId: string) => {
    const room = await multiplayerLocalStore.getRoomBySessionId(sessionId);
    if (!room) return;

    const managedRoom = multiplayerSessionManager.get(room.roomId);
    if (managedRoom?.runtime?.role === 'player') {
      managedRoom.runtime.leaveRoom();
    }
    await multiplayerSessionManager.closeRoom(room.roomId, { deleteLocalRoom: true });
    if (activeMultiplayerRoomRef.current?.roomId !== room.roomId) return;

    multiplayerJoinStartedRef.current = null;
    clearMultiplayerJoinTimeout();
    isJoiningMultiplayerRef.current = false;
    setIsJoiningMultiplayer(false);
    clearPendingRoomJoin();
    setActiveRoom(null);
    setIsMultiplayerRoomModalOpen(false);
    setIsMultiplayerParticipantRoomModalOpen(false);
  }, [clearMultiplayerJoinTimeout, clearPendingRoomJoin, setActiveRoom]);

  return {
    activeMultiplayerRoom,
    activeMultiplayerRoomState: multiplayerRoomState,
    isMultiplayerTransitioning,
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
    prepareMultiplayerSessionExit,
    finalizeMultiplayerSessionExit,
    handlePublishMultiplayerBoardUpdate,
    releaseHostMultiplayerRoom,
    releaseParticipantMultiplayerRoom,
    releaseMultiplayerRoomForSession,
  };
};
