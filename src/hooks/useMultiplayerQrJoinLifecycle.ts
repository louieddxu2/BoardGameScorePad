import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { ToastMessage } from './useToast';
import type { AppTranslationKey } from '../i18n/app';
import type { EnterActiveSession } from '../utils/activeSessionNavigation';
import type { ActiveMultiplayerRoom, PendingMultiplayerJoin } from './multiplayerRoomLifecycleTypes';
import type { createMultiplayerP2PRuntimeTransport } from '../features/multiplayer/multiplayerP2PRuntimeTransport';
import type { MultiplayerPlayerRoomRuntime } from '../features/multiplayer/multiplayerRoomRuntime';
import type { createMultiplayerTabCoordinator, MultiplayerTabClaim } from '../features/multiplayer/multiplayerTabCoordinator';
import type { BootstrapPackageMessage } from '../features/multiplayer/protocol';
import { isInAppBrowser } from '../components/modals/InAppBrowserGuide';
import { multiplayerSessionManager } from '../features/multiplayer/multiplayerSessionManager';
import { startMultiplayerQrJoin } from '../features/multiplayer/multiplayerQrJoin';
import { MULTIPLAYER_UPDATE_ROOM_QUERY_PARAM, consumeMultiplayerJoinAfterUpdate } from '../features/multiplayer/multiplayerJoinResume';

type JoinTransport = ReturnType<typeof createMultiplayerP2PRuntimeTransport>;
const MULTIPLAYER_JOIN_DEADLINE_MS = 3_000;

interface MultiplayerQrJoinLifecycleOptions {
  isDbReady: boolean;
  enterActiveSession: EnterActiveSession;
  activeMultiplayerRoomRef: MutableRefObject<ActiveMultiplayerRoom | null>;
  pendingMultiplayerJoinRef: MutableRefObject<PendingMultiplayerJoin | null>;
  multiplayerJoinStartedRef: MutableRefObject<string | null>;
  multiplayerJoinTimeoutRef: MutableRefObject<number | null>;
  isJoiningMultiplayerRef: MutableRefObject<boolean>;
  participantTransportRef: MutableRefObject<JoinTransport | null>;
  tabCoordinatorRef: MutableRefObject<ReturnType<typeof createMultiplayerTabCoordinator> | null>;
  playerRuntimeCreationsRef: MutableRefObject<Map<string, Promise<MultiplayerPlayerRoomRuntime | null>>>;
  showToastRef: MutableRefObject<(options: Omit<ToastMessage, 'id'>) => void>;
  tAppRef: MutableRefObject<(key: AppTranslationKey, params?: Record<string, string | number>) => string>;
  setActiveRoom: (room: ActiveMultiplayerRoom | null) => void;
  setPendingJoin: (join: PendingMultiplayerJoin | null) => void;
  setPendingMultiplayerClaimIds: (ids: string[] | null) => void;
  setIsMultiplayerParticipantRoomModalOpen: (open: boolean) => void;
  setIsMultiplayerTransitioning: (transitioning: boolean) => void;
  setIsJoiningMultiplayer: (joining: boolean) => void;
  clearMultiplayerJoinTimeout: () => void;
  clearPendingRoomJoin: () => void;
  clearRoomUrlQuery: () => void;
  rememberPendingRoomJoin: (roomId: string) => void;
  claimParticipantTab: (roomId: string) => MultiplayerTabClaim;
  releaseParticipantTabClaim: (roomId?: string) => void;
  resetMultiplayerJoinState: (roomId: string, options?: { clearActiveRoom?: boolean }) => void;
  applyRemoteBootstrapToPlayerRuntime: (roomId: string, message: BootstrapPackageMessage) => Promise<boolean>;
  ensurePlayerRuntime: (roomId: string, message: BootstrapPackageMessage, transport: JoinTransport, isCurrent: () => boolean) => Promise<MultiplayerPlayerRoomRuntime | null>;
}

// Own only the QR-join effect. The parent retains all shared state and refs,
// and the original effect dependencies keep cancellation/retry timing unchanged.
export const useMultiplayerQrJoinLifecycle = ({
  isDbReady,
  enterActiveSession,
  activeMultiplayerRoomRef,
  pendingMultiplayerJoinRef,
  multiplayerJoinStartedRef,
  multiplayerJoinTimeoutRef,
  isJoiningMultiplayerRef,
  participantTransportRef,
  tabCoordinatorRef,
  playerRuntimeCreationsRef,
  showToastRef,
  tAppRef,
  setActiveRoom,
  setPendingJoin,
  setPendingMultiplayerClaimIds,
  setIsMultiplayerParticipantRoomModalOpen,
  setIsMultiplayerTransitioning,
  setIsJoiningMultiplayer,
  clearMultiplayerJoinTimeout,
  clearPendingRoomJoin,
  clearRoomUrlQuery,
  rememberPendingRoomJoin,
  claimParticipantTab,
  releaseParticipantTabClaim,
  resetMultiplayerJoinState,
  applyRemoteBootstrapToPlayerRuntime,
  ensurePlayerRuntime,
}: MultiplayerQrJoinLifecycleOptions) => {
  useEffect(() => {
    if (!isDbReady || isInAppBrowser()) return;
    const searchParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = searchParams.get('room');
    let roomIdFromUpdate: string | null = null;
    if (!roomIdFromUrl) {
      try {
        const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
        roomIdFromUpdate = consumeMultiplayerJoinAfterUpdate({
          storage: sessionStorage,
          legacyRoomId: searchParams.get(MULTIPLAYER_UPDATE_ROOM_QUERY_PARAM),
          isReloadNavigation: navigation?.type === 'reload',
        });
      } catch {
        roomIdFromUpdate = null;
      }
    }
    const roomId = roomIdFromUrl ?? roomIdFromUpdate;
    if (!roomId) {
      clearPendingRoomJoin();
      clearRoomUrlQuery();
      return;
    }
    const tabClaim = claimParticipantTab(roomId);
    multiplayerSessionManager.supersedeRoomCleanup(roomId);
    playerRuntimeCreationsRef.current.delete(roomId);

    // Every QR scan is a fresh intent. The tab claim above invalidates every
    // callback captured by the previous attempt, including for the same room.
    const pendingJoin = pendingMultiplayerJoinRef.current;
    if (pendingJoin) {
      pendingJoin.transport.stop?.();
      const pendingRuntime = multiplayerSessionManager.get(pendingJoin.roomId)?.runtime;
      if (pendingRuntime?.role === 'player') pendingRuntime.leaveRoom();
      void multiplayerSessionManager.closeRoom(pendingJoin.roomId);
      setPendingJoin(null);
    }
    const activeParticipantRoom = activeMultiplayerRoomRef.current?.role === 'player'
      ? activeMultiplayerRoomRef.current
      : null;
    if (activeParticipantRoom) {
      const activeRuntime = multiplayerSessionManager.get(activeParticipantRoom.roomId)?.runtime;
      if (activeRuntime?.role === 'player') activeRuntime.leaveRoom();
      void multiplayerSessionManager.closeRoom(activeParticipantRoom.roomId);
      setActiveRoom(null);
    }
    participantTransportRef.current = null;
    setPendingMultiplayerClaimIds(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
    setIsMultiplayerTransitioning(false);

    // A QR URL is a one-time join intent, not a persistent reconnect route.
    // Consume it before any async handshake so a reload cannot replay the same
    // join after the user has already left the session.
    rememberPendingRoomJoin(roomId);
    clearRoomUrlQuery();
    let cancelled = false;
    let activeTransport: ReturnType<typeof createMultiplayerP2PRuntimeTransport> | null = null;

    const isCurrentJoin = () => !cancelled && multiplayerJoinStartedRef.current === roomId && tabCoordinatorRef.current?.isCurrent(tabClaim) === true;
    const failCurrentJoin = () => {
      if (!isCurrentJoin()) return;
      activeTransport?.stop?.();
      releaseParticipantTabClaim(roomId);
      resetMultiplayerJoinState(roomId);
      showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_join_timeout'), type: 'warning' });
      // Room cleanup can be serialized behind an earlier purge. It must not
      // delay the user-visible three-second failure boundary.
      void multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true });
    };
    const startJoin = async () => {
      if (!isCurrentJoin()) return;
      await startMultiplayerQrJoin({
        roomId,
        isCurrent: isCurrentJoin,
        isJoining: () => isJoiningMultiplayerRef.current,
        onRoomClosed: () => {
          if (activeMultiplayerRoomRef.current?.roomId === roomId) setActiveRoom(null);
        },
        onJoining: () => {
          isJoiningMultiplayerRef.current = true;
          setIsJoiningMultiplayer(true);
        },
        onTransportCreated: (transport) => {
          activeTransport = transport;
          participantTransportRef.current = transport;
        },
        applyExistingBootstrap: (message) => applyRemoteBootstrapToPlayerRuntime(roomId, message),
        onInitialBootstrap: async (bootstrapMessage, transport) => {
          // The runtime takes ownership of the QR transport before player selection.
          const runtime = await ensurePlayerRuntime(roomId, bootstrapMessage, transport, isCurrentJoin);
          if (!runtime || !isCurrentJoin()) return;

          clearMultiplayerJoinTimeout();
          isJoiningMultiplayerRef.current = false;
          setIsJoiningMultiplayer(false);
          multiplayerJoinStartedRef.current = null;
          setPendingJoin({ roomId, bootstrapMessage, transport });
        },
        onJoinCompleted: () => {
          clearMultiplayerJoinTimeout();
          releaseParticipantTabClaim(roomId);
          resetMultiplayerJoinState(roomId);
          showToastRef.current({ message: tAppRef.current('app_toast_multiplayer_room_ended'), type: 'info' });
        },
        onStartFailed: failCurrentJoin,
      });
    };

    multiplayerJoinStartedRef.current = roomId;
    clearMultiplayerJoinTimeout();
    multiplayerJoinTimeoutRef.current = window.setTimeout(() => {
      failCurrentJoin();
    }, MULTIPLAYER_JOIN_DEADLINE_MS);
    void startJoin().catch((error) => {
      if (cancelled) return;
      console.warn('[multiplayer] Failed to join room:', error);
      failCurrentJoin();
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
  }, [isDbReady, applyRemoteBootstrapToPlayerRuntime, claimParticipantTab, clearMultiplayerJoinTimeout, clearPendingRoomJoin, clearRoomUrlQuery, ensurePlayerRuntime, enterActiveSession, releaseParticipantTabClaim, rememberPendingRoomJoin, resetMultiplayerJoinState, setActiveRoom, setPendingJoin]);
};
