
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppView, GameTemplate, ScoringRule } from './types';
import { useAppData } from './hooks/useAppData';
import { useMobileZoom } from './hooks/useMobileZoom';
import { useLandscapeOrientation } from './hooks/useLandscapeOrientation';
import { usePwaInstall } from './hooks/usePwaInstall';
import { Smartphone, Loader2 } from 'lucide-react';
import { getTargetHistoryDepth } from './config/historyStrategy'; // Import Strategy
import { hasActiveModals } from './hooks/useModalBackHandler'; // Modal 歷史協調
import { useToast } from './hooks/useToast';
import { useAppTranslation } from './i18n/app';
import { useAiTemplateShareConfirm } from './hooks/useAiTemplateShareConfirm';
import { parseDeepLinkFromHash } from './utils/deepLink';
import { fetchTemplateFromCloud } from './services/templateShareService';
import { cloudClient } from './services/cloudClient';
import { db } from './db';
import Peer from 'peerjs';
import { generateId } from './utils/idGenerator';
import { createLocalScoreStateSyncAdapter, multiplayerLocalStore } from './features/multiplayer/multiplayerLocalStore';
import { multiplayerDeliveryStore, getOrCreateMultiplayerDeviceId } from './features/multiplayer/multiplayerDeliveryStore';
import { multiplayerParticipantBindingStore, participantBindingKey } from './features/multiplayer/multiplayerParticipantBinding';
import { createMultiplayerP2PRuntimeTransport } from './features/multiplayer/multiplayerP2PRuntimeTransport';
import { createMultiplayerHostRoomRuntime, createMultiplayerPlayerRoomRuntime, restoreMultiplayerHostRoomRuntime, restoreMultiplayerPlayerRoomRuntime } from './features/multiplayer/multiplayerRoomRuntime';
import { multiplayerSessionManager } from './features/multiplayer/multiplayerSessionManager';
import { BootstrapPackageMessage } from './features/multiplayer/protocol';
import { createPlayerSessionCapabilities, hostSessionCapabilities } from './features/multiplayer/sessionCapabilities';
import { releaseMultiplayerRoomOwnership } from './features/multiplayer/multiplayerPersistence';

// Components
import TemplateEditor from './components/editor/TemplateEditor';
import SessionView from './components/session/SessionView';
import Dashboard from './components/dashboard/Dashboard';
import GameSetupModal from './components/dashboard/modals/GameSetupModal';
import HistoryReviewView from './components/history/HistoryReviewView';
import { InAppBrowserGuide, isInAppBrowser } from './components/modals/InAppBrowserGuide';
import { IOSPwaGuide, shouldTriggerIOSPwaGuide } from './components/modals/IOSPwaGuide';
import MultiplayerRoomModal from './components/session/modals/MultiplayerRoomModal';
import MultiplayerPlayerClaimModal from './components/session/modals/MultiplayerPlayerClaimModal';
import MultiplayerParticipantRoomModal from './components/session/modals/MultiplayerParticipantRoomModal';

type ActiveMultiplayerRoom = {
  roomId: string;
  role: 'host' | 'player';
  playerIds?: string[];
};

type PendingMultiplayerJoin = {
  roomId: string;
  bootstrapMessage: BootstrapPackageMessage;
  transport: ReturnType<typeof createMultiplayerP2PRuntimeTransport>;
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isCloudImporting, setIsCloudImporting] = useState(false);
  const [activeMultiplayerRoom, setActiveMultiplayerRoom] = useState<ActiveMultiplayerRoom | null>(null);
  const [isMultiplayerRoomModalOpen, setIsMultiplayerRoomModalOpen] = useState(false);
  const [isMultiplayerParticipantRoomModalOpen, setIsMultiplayerParticipantRoomModalOpen] = useState(false);
  const [pendingMultiplayerJoin, setPendingMultiplayerJoin] = useState<PendingMultiplayerJoin | null>(null);
  const [isJoiningMultiplayer, setIsJoiningMultiplayer] = useState(false);
  const [multiplayerVersion, setMultiplayerVersion] = useState(0);

  // Custom Hook for all data logic
  const appData = useAppData();

  const { showToast } = useToast();
  const { t: tApp } = useAppTranslation();

  const clearMultiplayerJoinTimeout = useCallback(() => {
    if (multiplayerJoinTimeoutRef.current === null) return;
    window.clearTimeout(multiplayerJoinTimeoutRef.current);
    multiplayerJoinTimeoutRef.current = null;
  }, []);

  // Hook for encapsulated AI Template Sharing confirmation
  const { captureAiTemplateForSharing } = useAiTemplateShareConfirm(view);

  // Local UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);

  // For "Create from Search" flow
  const [editorInitialName, setEditorInitialName] = useState<string | undefined>(undefined);

  // Ref to ignore popstates triggered by our own history manipulation (pruning)
  const ignorePopstateRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const multiplayerJoinStartedRef = useRef<string | null>(null);
  const multiplayerJoinTimeoutRef = useRef<number | null>(null);
  const isJoiningMultiplayerRef = useRef(false);
  const isOpeningRoomRef = useRef(false);
  const activeMultiplayerRoomRef = useRef<ActiveMultiplayerRoom | null>(null);

  // Hardware & Environment Side Effects Hooks
  const zoomLevel = useMobileZoom();
  const showLandscapeOverlay = useLandscapeOrientation();
  const { isInstalled, canInstall, handleInstallClick } = usePwaInstall();

  useEffect(() => () => clearMultiplayerJoinTimeout(), [clearMultiplayerJoinTimeout]);

  useEffect(() => multiplayerSessionManager.subscribe(() => setMultiplayerVersion((version) => version + 1)), []);

  useEffect(() => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    const roomId = activeMultiplayerRoom.roomId;

    // 情況 A：Host 正常結束，歸還 session 擁有權
    const returned = multiplayerSessionManager.peekReturnedSession(roomId);
    if (returned) {
      activeMultiplayerRoomRef.current = null;
      setActiveMultiplayerRoom(null);
      void appData.resumeSessionById(returned.id);
      return;
    }

    // 情況 B：Host 異常斷線偵測
    const roomState = multiplayerSessionManager.get(roomId);
    if (!roomState) {
      activeMultiplayerRoomRef.current = null;
      setActiveMultiplayerRoom(null);
      return;
    }
    if (roomState.status !== 'disconnected') return;

    // 給 5 秒延遲，允許短暫斷線自動恢復
    const disconnectTimer = window.setTimeout(() => {
      const currentState = multiplayerSessionManager.get(roomId);
      // 如果已重連或房間已不存在，不處理
      if (!currentState || currentState.status === 'connected') return;
      // 確認仍然斷線，清除狀態並提示
      multiplayerSessionManager.closeRoom(roomId);
      activeMultiplayerRoomRef.current = null;
      setActiveMultiplayerRoom(null);
      showToast({ message: tApp('app_toast_multiplayer_host_disconnected'), type: 'warning' });
    }, 5000);

    return () => window.clearTimeout(disconnectTimer);
  }, [activeMultiplayerRoom, appData, multiplayerVersion, showToast, tApp]);

  const clearRoomUrlQuery = useCallback(() => {
    if (!window.location.search.includes('room')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!appData.isDbReady || isInAppBrowser()) return;
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (!roomId) return;

    const existingRoom = multiplayerSessionManager.get(roomId);

    // 情況 A：既有連線仍在且有效 (connected) -> 照既有的連上
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
        const nextRoom: ActiveMultiplayerRoom = {
          roomId,
          role: existingRoom.role,
          playerIds: existingPlayerIds || (activeMultiplayerRoomRef.current?.playerIds ?? [])
        };
        activeMultiplayerRoomRef.current = nextRoom;
        setActiveMultiplayerRoom(nextRoom);
      }
      void appData.resumeSessionById(existingRoom.session.id).then(() => {
        setView(AppView.ACTIVE_SESSION);
        clearRoomUrlQuery();
      });
      return;
    }

    // 情況 B：既有連線無效/舊連線殘留 -> 徹底把既有連線清空再連上
    if (existingRoom) {
      multiplayerSessionManager.closeRoom(roomId);
    }

    if (multiplayerJoinStartedRef.current === roomId && isJoiningMultiplayerRef.current) return;
    multiplayerJoinStartedRef.current = roomId;
    clearMultiplayerJoinTimeout();
    isJoiningMultiplayerRef.current = true;
    setIsJoiningMultiplayer(true);

    let activeTransport: ReturnType<typeof createMultiplayerP2PRuntimeTransport> | null = null;
    const adapter = createLocalScoreStateSyncAdapter(roomId, 'player', {
      onRemoteBootstrap: async (bootstrapMessage, persisted) => {
        clearMultiplayerJoinTimeout();
        isJoiningMultiplayerRef.current = false;
        setIsJoiningMultiplayer(false);
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
          if (templateChanged) await appData.resumeSessionById(persisted.session.id);
          return;
        }
        if (activeTransport) {
          setPendingMultiplayerJoin({ roomId, bootstrapMessage, transport: activeTransport });
        }
      },
    });

    activeTransport = createMultiplayerP2PRuntimeTransport({ Peer, adapter, logger: (message) => console.info('[multiplayer]', message) });
    activeTransport.joinRoom?.(roomId);

    multiplayerJoinTimeoutRef.current = window.setTimeout(() => {
      // 已經成功連線為 player，不需要超時處理
      if (multiplayerSessionManager.get(roomId)?.role === 'player') return;
      // ref 仍指向當前 roomId → 這是真正的超時，執行完整清理
      if (multiplayerJoinStartedRef.current === roomId) {
        activeTransport?.stop?.();
        multiplayerJoinStartedRef.current = null;
        clearRoomUrlQuery();
        showToast({ message: tApp('app_toast_multiplayer_join_timeout'), type: 'warning' });
      }
      // 無論如何都確保清除 Spinner
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
  }, [appData, appData.isDbReady, clearMultiplayerJoinTimeout, clearRoomUrlQuery, showToast, tApp]);

  const [isIOSPwaGuideVisible, setIsIOSPwaGuideVisible] = useState(false);

  // --- Session Preview Logic (for Modal) ---
  const pendingSessionPreview = useMemo(() => {
    if (!pendingTemplate || !appData.activeSessionIds.includes(pendingTemplate.id)) return null;
    return appData.getSessionPreview(pendingTemplate.id);
  }, [pendingTemplate, appData.activeSessionIds]);

  // --- Restore View State ---
  useEffect(() => {
    if (appData.currentSession && appData.activeTemplate) {
      setView(AppView.ACTIVE_SESSION);
    }
  }, [appData.currentSession, appData.activeTemplate]);

  // --- Deep Link (Built-in template -> Setup Modal) ---
  useEffect(() => {
    if (isInAppBrowser()) return;

    if (deepLinkHandledRef.current || !appData.isDbReady) return;

    const parsed = parseDeepLinkFromHash(window.location.hash);
    deepLinkHandledRef.current = true;
    const clearDeepLinkHash = () => {
      if (!window.location.hash) return;
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    };

    if (!parsed) {
      clearDeepLinkHash();
      setView(AppView.DASHBOARD);
      return;
    }

    const openByDeepLink = async () => {
      if (parsed.source === 'builtin') {
        const lang = tApp('app_lang_code') || 'zh-TW'; // Assume app_lang_code returns 'en' or similar based on i18n
        const isEn = lang.startsWith('en');

        // Ensure shortId doesn't already have EN- prefix if passed manually
        const baseShortId = parsed.shortId.startsWith('EN-') ? parsed.shortId.substring(3) : parsed.shortId;
        const enShortId = `EN-${baseShortId}`;

        // Two-way fallback logic
        const primaryId = isEn ? enShortId : baseShortId;
        const fallbackId = isEn ? baseShortId : enShortId;

        let template = await appData.getBuiltinTemplateByShortId(primaryId);
        if (!template) {
          template = await appData.getBuiltinTemplateByShortId(fallbackId);
        }

        if (!template) {
          clearDeepLinkHash();
          setView(AppView.DASHBOARD);
          showToast({ message: tApp('app_toast_link_template_missing'), type: 'warning' });
          return;
        }

        clearDeepLinkHash();
        setView(AppView.DASHBOARD);
        setPendingTemplate(template);
        return;
      }

      if (parsed.source === 'cloud') {
        const checkCloudCache = async () => {
          // 1. Check if we already have a mapping for this cloudId
          const cached = await db.templateShareCache.where('cloudId').equals(parsed.cloudId).first();
          if (cached) {
            const localTemplate = await db.templates.get(cached.templateId);
            // 2. Ensure the local template exists and its updatedAt matches our cache
            // (If the user modified it, we might want to offer a fresh download, but for now we prioritize the existing one)
            if (localTemplate && (localTemplate.updatedAt || localTemplate.createdAt) === cached.templateUpdatedAt) {
              return localTemplate;
            }
          }
          return null;
        };

        const existingTemplate = await checkCloudCache();
        if (existingTemplate) {
          clearDeepLinkHash();
          setView(AppView.DASHBOARD);
          setPendingTemplate(existingTemplate);
          return;
        }

        setIsCloudImporting(true);
        const shared = await fetchTemplateFromCloud(parsed.cloudId);
        if (!shared) {
          setIsCloudImporting(false);
          clearDeepLinkHash();
          setView(AppView.DASHBOARD);
          showToast({ message: tApp('app_toast_cloud_link_expired'), type: 'warning' });
          return;
        }

        const payloadTemplate = shared.payload as Partial<GameTemplate>;
        if (!payloadTemplate || !Array.isArray(payloadTemplate.columns)) {
          setIsCloudImporting(false);
          clearDeepLinkHash();
          setView(AppView.DASHBOARD);
          showToast({ message: tApp('app_toast_link_open_failed'), type: 'error' });
          return;
        }

        const localTemplateId = `Cloud-${parsed.cloudId}`;
        const cloudTime = shared.createdAt;

        const localTemplate: GameTemplate = {
          ...payloadTemplate,
          id: localTemplateId,
          name: shared.name || payloadTemplate.name || tApp('app_cloud_template_default_name'),
          columns: payloadTemplate.columns,
          createdAt: cloudTime,
          updatedAt: cloudTime,
          hasImage: false,
          imageId: undefined,
          cloudImageId: undefined,
          sourceTemplateId: payloadTemplate.sourceTemplateId,
          bggId: payloadTemplate.bggId || '',
          supportedColors: payloadTemplate.supportedColors || []
        } as GameTemplate;

        await appData.saveTemplate(localTemplate, { skipCloud: true, preserveTimestamps: true });

        // Update Share Cache so next time it's instant
        await db.templateShareCache.put({
          templateId: localTemplateId,
          templateUpdatedAt: cloudTime,
          cloudId: parsed.cloudId
        });

        setIsCloudImporting(false);
        clearDeepLinkHash();
        setView(AppView.DASHBOARD);
        setPendingTemplate(localTemplate);
      }
    };

    openByDeepLink().catch((error) => {
      console.error('Failed to open deep link:', error);
      setIsCloudImporting(false);
      clearDeepLinkHash();
      setView(AppView.DASHBOARD);
      showToast({ message: tApp('app_toast_link_open_failed'), type: 'error' });
    });
  }, [appData.isDbReady, appData.getBuiltinTemplateByShortId, showToast, tApp]);

  // --- History Wall Logic (Strategy Pattern) ---
  const historyWallDepth = useRef(0);

  const replenishWall = useCallback(() => {
    const targetDepth = getTargetHistoryDepth(view, pendingTemplate !== null);

    if (historyWallDepth.current < targetDepth) {
      let countToAdd = targetDepth - historyWallDepth.current;

      if (view === AppView.ACTIVE_SESSION || view === AppView.HISTORY_REVIEW) {
        countToAdd = 1;
      }

      if (countToAdd > 0) {
        const baseTime = performance.now();
        for (let i = 0; i < countToAdd; i++) {
          window.history.pushState({ wallSignature: `${baseTime}-${i}-${Math.random()}` }, '');
        }
        historyWallDepth.current += countToAdd;
      }
    }
  }, [view, pendingTemplate]);

  const transitionToDashboard = useCallback(() => {
    const targetDepth = 1;
    const currentDepth = historyWallDepth.current;

    if (currentDepth > targetDepth) {
      const delta = currentDepth - targetDepth;
      ignorePopstateRef.current = true;
      window.history.go(-delta);
      historyWallDepth.current = targetDepth;
      setTimeout(() => {
        ignorePopstateRef.current = false;
      }, 100);
    }
    setView(AppView.DASHBOARD);
    cloudClient.clearCache(); // 清除雲端檢索快取！
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      // [Fix] Modal 開啟時不補牆，避免 capture 階段塞入的歷史狀態
      // 干擾 useModalBackHandler cleanup 的 history.back()
      if (hasActiveModals()) return;
      replenishWall();
    };

    const handleModalStackChange = () => {
      // Proactively replenish the history wall immediately when all modals are closed,
      // without relying on the user's manual physical click/touch interaction.
      if (!hasActiveModals()) {
        replenishWall();
      }
    };

    window.addEventListener('click', handleInteraction, { capture: true });
    window.addEventListener('touchstart', handleInteraction, { capture: true });
    window.addEventListener('modal-stack-changed', handleModalStackChange);

    return () => {
      window.removeEventListener('click', handleInteraction, { capture: true });
      window.removeEventListener('touchstart', handleInteraction, { capture: true });
      window.removeEventListener('modal-stack-changed', handleModalStackChange);
    };
  }, [replenishWall]);

  useEffect(() => {
    replenishWall();
  }, [replenishWall]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (ignorePopstateRef.current) {
        ignorePopstateRef.current = false;
        return;
      }

      // [Silent Back] 由 useModalBackHandler 的 UI 關閉清理觸發，非使用者按返回鍵。
      // 不遞減牆壁深度（被消除的是 modal 條目，不是牆壁條目）。
      if ((window as any).__silentBack) {
        return;
      }

      // [Modal 協調] 有 modal 正在透過 useModalBackHandler 管理歷史，
      // 由 modal 系統自行處理，App.tsx 不介入（不遞減牆壁、不切換視圖）。
      if (hasActiveModals()) {
        return;
      }

      historyWallDepth.current = Math.max(0, historyWallDepth.current - 1);

      let handled = false;

      if (pendingTemplate) {
        setPendingTemplate(null);
        handled = true;
      }
      else if (view === AppView.TEMPLATE_CREATOR) {
        setView(AppView.DASHBOARD);
        setEditorInitialName(undefined);
        handled = true;
      }
      else if (view === AppView.ACTIVE_SESSION || view === AppView.HISTORY_REVIEW) {
        window.dispatchEvent(new CustomEvent('app-back-press'));
        handled = true;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, pendingTemplate, tApp, showToast]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (view === AppView.ACTIVE_SESSION) {
        e.preventDefault();
        e.returnValue = tApp('msg_confirm_exit_session');
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [view]);

  // --- Navigation Handlers ---

  const initSetup = (template: GameTemplate) => {
    setPendingTemplate(template);
  };

  const tryRestoreMultiplayerRoom = useCallback(async (sessionId: string) => {
    try {
      const room = await multiplayerLocalStore.getRoomBySessionId(sessionId);
      if (!room) return;

      const existingManagedRoom = multiplayerSessionManager.get(room.roomId);
      if (existingManagedRoom?.runtime) {
        if (room.role === 'host') {
          const nextRoom: ActiveMultiplayerRoom = { roomId: room.roomId, role: 'host' };
          activeMultiplayerRoomRef.current = nextRoom;
          setActiveMultiplayerRoom(nextRoom);
        } else {
          const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
          const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(room.roomId, deviceId));
          const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);
          const nextRoom: ActiveMultiplayerRoom = { roomId: room.roomId, role: 'player', playerIds };
          activeMultiplayerRoomRef.current = nextRoom;
          setActiveMultiplayerRoom(nextRoom);
        }
        return;
      }

      if (room.role === 'host') {
        const adapter = createLocalScoreStateSyncAdapter(room.roomId, 'host');
        const transport = createMultiplayerP2PRuntimeTransport({
          Peer,
          adapter,
          logger: (message) => console.info('[multiplayer]', message),
        });
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
          transport.setConnectionChangeHandler?.((connectionCount) =>
            multiplayerSessionManager.setConnectionCount(room.roomId, connectionCount)
          );
          runtime.start();
          const nextRoom: ActiveMultiplayerRoom = { roomId: room.roomId, role: 'host' };
          activeMultiplayerRoomRef.current = nextRoom;
          setActiveMultiplayerRoom(nextRoom);
        }
      } else if (room.role === 'player') {
        const deviceId = await getOrCreateMultiplayerDeviceId(multiplayerDeliveryStore);
        const binding = await multiplayerParticipantBindingStore.get(participantBindingKey(room.roomId, deviceId));
        const playerIds = binding?.playerIds ?? (binding?.playerId ? [binding.playerId] : []);

        const adapter = createLocalScoreStateSyncAdapter(room.roomId, 'player');
        const transport = createMultiplayerP2PRuntimeTransport({
          Peer,
          adapter,
          logger: (message) => console.info('[multiplayer]', message),
        });
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
          transport.setConnectionChangeHandler?.((connectionCount) =>
            multiplayerSessionManager.setConnectionCount(room.roomId, connectionCount)
          );
          runtime.start();
          await runtime.restoreParticipantBinding();
          const nextRoom: ActiveMultiplayerRoom = { roomId: room.roomId, role: 'player', playerIds };
          activeMultiplayerRoomRef.current = nextRoom;
          setActiveMultiplayerRoom(nextRoom);
        }
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to restore multiplayer room:', err);
    }
  }, []);

  const handleResumeGame = async () => {
    if (pendingTemplate) {
      const activeSession = appData.activeSessions?.find(s => s.templateId === pendingTemplate.id);
      const success = await appData.resumeSession(pendingTemplate.id);
      if (success) {
        let sessionId = activeSession?.id;
        if (!sessionId) {
          const s = await db.sessions.where('templateId').equals(pendingTemplate.id).and(x => x.status === 'active').first();
          sessionId = s?.id;
        }
        if (sessionId) {
          await tryRestoreMultiplayerRoom(sessionId);
        }
        setView(AppView.ACTIVE_SESSION);
        setPendingTemplate(null);
      }
    }
  };

  const handleDirectResume = async (templateId: string) => {
    const activeSession = appData.activeSessions?.find(s => s.templateId === templateId);
    const success = await appData.resumeSession(templateId);
    if (success) {
      let sessionId = activeSession?.id;
      if (!sessionId) {
        const s = await db.sessions.where('templateId').equals(templateId).and(x => x.status === 'active').first();
        sessionId = s?.id;
      }
      if (sessionId) {
        await tryRestoreMultiplayerRoom(sessionId);
      }
      setPendingTemplate(null);
      setView(AppView.ACTIVE_SESSION);
    }
  };

  const handleOpenMultiplayerRoom = useCallback(async () => {
    if (isOpeningRoomRef.current) return;
    if (activeMultiplayerRoom?.role === 'host') {
      setIsMultiplayerRoomModalOpen(true);
      return;
    }
    if (!appData.currentSession || !appData.activeTemplate) return;

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
        template: appData.activeTemplate,
        session: appData.currentSession,
        store: multiplayerLocalStore,
        deliveryStore: multiplayerDeliveryStore,
        transport,
        onSessionSnapshot: callbacks.onSessionSnapshot,
        onParticipantClaims: (claims) => multiplayerSessionManager.setParticipantClaims(roomId, claims),
      });
      multiplayerSessionManager.register(roomId, runtime, 'connecting');
      transport.setConnectionChangeHandler?.((connectionCount) => multiplayerSessionManager.setConnectionCount(roomId, connectionCount));
      runtime.start();
      const nextRoom: ActiveMultiplayerRoom = { roomId, role: 'host' };
      activeMultiplayerRoomRef.current = nextRoom;
      setActiveMultiplayerRoom(nextRoom);
      setIsMultiplayerRoomModalOpen(true);
    } finally {
      isOpeningRoomRef.current = false;
    }
  }, [activeMultiplayerRoom?.role, appData.activeTemplate, appData.currentSession]);

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
    const nextRoom: ActiveMultiplayerRoom = { roomId, role: 'player', playerIds };
    activeMultiplayerRoomRef.current = nextRoom;
    setActiveMultiplayerRoom(nextRoom);
    setPendingMultiplayerJoin(null);
    clearRoomUrlQuery();
    const resumed = await appData.resumeSessionById(runtime.session.session.id);
    if (resumed) setView(AppView.ACTIVE_SESSION);
  }, [appData, clearRoomUrlQuery, pendingMultiplayerJoin]);

  const handleCancelMultiplayerJoin = useCallback(() => {
    pendingMultiplayerJoin?.transport.stop?.();
    setPendingMultiplayerJoin(null);
    isJoiningMultiplayerRef.current = false;
    setIsJoiningMultiplayer(false);
    multiplayerJoinStartedRef.current = null;
    clearRoomUrlQuery();
  }, [clearRoomUrlQuery, pendingMultiplayerJoin]);

  const multiplayerRoomState = activeMultiplayerRoom ? multiplayerSessionManager.get(activeMultiplayerRoom.roomId) : null;
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
    await releaseMultiplayerRoomOwnership({
      store: multiplayerLocalStore,
      roomId: activeMultiplayerRoom.roomId,
      session: completed.finalSession,
      completedAt: completed.completedAt,
    });
    multiplayerSessionManager.closeRoom(activeMultiplayerRoom.roomId);
    clearRoomUrlQuery();
    activeMultiplayerRoomRef.current = null;
    setActiveMultiplayerRoom(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
    setIsMultiplayerRoomModalOpen(false);
    return completed.finalSession;
  }, [activeMultiplayerRoom, clearRoomUrlQuery]);

  const releaseParticipantMultiplayerRoom = useCallback(async (options?: { deleteLocalRoom?: boolean }) => {
    if (!activeMultiplayerRoom || activeMultiplayerRoom.role !== 'player') return;
    const roomId = activeMultiplayerRoom.roomId;
    if (options?.deleteLocalRoom) {
      await multiplayerLocalStore.deleteRoom(roomId);
    }
    multiplayerSessionManager.closeRoom(roomId);
    multiplayerJoinStartedRef.current = null;
    clearMultiplayerJoinTimeout();
    isJoiningMultiplayerRef.current = false;
    setIsJoiningMultiplayer(false);
    clearRoomUrlQuery();
    activeMultiplayerRoomRef.current = null;
    setActiveMultiplayerRoom(null);
    setIsMultiplayerParticipantRoomModalOpen(false);
  }, [activeMultiplayerRoom, clearMultiplayerJoinTimeout, clearRoomUrlQuery]);

  const handleCloseMultiplayerRoom = useCallback(async () => {
    try {
      const releasedSession = await releaseHostMultiplayerRoom();
      if (releasedSession) await appData.resumeSessionById(releasedSession.id);
    } catch (err) {
      console.warn('[multiplayer] Failed to close host room:', err);
    }
  }, [appData, releaseHostMultiplayerRoom]);

  const handleLeaveMultiplayerRoom = useCallback(async () => {
    try {
      await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
    } catch (err) {
      console.warn('[multiplayer] Failed to leave participant room:', err);
    }
  }, [releaseParticipantMultiplayerRoom]);

  const handleStartNewGame = async (count: number, options: { startTimeStr: string, scoringRule: ScoringRule }) => {
    if (pendingTemplate) {
      if (appData.activeSessionIds.includes(pendingTemplate.id)) {
        await appData.discardSession(pendingTemplate.id);
      }

      // Normal start doesn't trigger auto-fill (as user has opportunity to set manually in setup modal)
      await appData.startSession(pendingTemplate, count, options);
      setView(AppView.ACTIVE_SESSION);
      setPendingTemplate(null);
    }
  };

  // [New] Direct Start Handler (Bypasses Setup Modal)
  // [Updated] Integrate Auto-Fill logic directly in startSession
  const handleQuickStart = async (template: GameTemplate, playerCount: number, location: string, locationId?: string, extra?: { startTimeStr?: string, scoringRule?: ScoringRule }) => {
    if (appData.activeSessionIds.includes(template.id)) {
      await appData.discardSession(template.id);
    }

    // 1. Start Session (Async) - Includes Auto-Fill Logic
    await appData.startSession(template, playerCount, {
      startTimeStr: extra?.startTimeStr,
      scoringRule: extra?.scoringRule || template.defaultScoringRule || 'HIGHEST_WINS',
      location: location,
      locationId: locationId
    });

    // 2. Switch View (Session is already populated with players)
    setView(AppView.ACTIVE_SESSION);
  };

  const handleExitSession = useCallback(async (location?: string) => {
    try {
      if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: false });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release participant room on exit:', err);
    } finally {
      appData.exitSession(location !== undefined ? { location } : undefined);
      transitionToDashboard();
    }
  }, [activeMultiplayerRoom, appData, releaseParticipantMultiplayerRoom, transitionToDashboard]);

  const handleSaveToHistory = useCallback(async (location?: string) => {
    try {
      if (activeMultiplayerRoom?.role === 'host') {
        await releaseHostMultiplayerRoom();
      } else if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release room on save:', err);
    } finally {
      captureAiTemplateForSharing(appData.activeTemplate);
      await appData.saveToHistory(location);
      transitionToDashboard();
      
      // Trigger iOS PWA guide if applicable
      if (shouldTriggerIOSPwaGuide()) {
        setIsIOSPwaGuideVisible(true);
      }
    }
  }, [activeMultiplayerRoom, appData, transitionToDashboard, captureAiTemplateForSharing, releaseHostMultiplayerRoom, releaseParticipantMultiplayerRoom]);

  const handleDiscard = useCallback(async () => {
    try {
      if (activeMultiplayerRoom?.role === 'host') {
        await releaseHostMultiplayerRoom();
      } else if (activeMultiplayerRoom?.role === 'player') {
        await releaseParticipantMultiplayerRoom({ deleteLocalRoom: true });
      }
    } catch (err) {
      console.warn('[multiplayer] Failed to release room on discard:', err);
    } finally {
      if (appData.activeTemplate) {
        await appData.discardSession(appData.activeTemplate.id);
        transitionToDashboard();
      }
    }
  }, [activeMultiplayerRoom, appData, transitionToDashboard, releaseHostMultiplayerRoom, releaseParticipantMultiplayerRoom]);

  const handleTemplateSave = async (template: GameTemplate) => {
    await appData.saveTemplate(template);
    const defaultCount = appData.sessionPlayerCount || template.lastPlayerCount || 4;

    await appData.startSession(template, defaultCount, {
      startTimeStr: undefined,
      scoringRule: template.defaultScoringRule || 'HIGHEST_WINS'
    });

    setView(AppView.ACTIVE_SESSION);
    setEditorInitialName(undefined);
  };

  const handleBatchImport = (templates: GameTemplate[]) => {
    templates.forEach(t => appData.saveTemplate(t));
    setView(AppView.DASHBOARD);
  };

  const handleHistorySelect = async (record: any) => {
    await appData.viewHistory(record.id);
    setView(AppView.HISTORY_REVIEW);
  };

  const handleHistoryExit = () => {
    appData.viewHistory(null);
    transitionToDashboard();
  };

  return (
    <div className="h-full bg-app-bg text-txt-primary font-sans overflow-hidden transition-colors duration-300 relative">

      {isCloudImporting && (
        <div className="modal-backdrop z-[10000] animate-in fade-in duration-300">
          <div className="modal-container items-center justify-center p-8 text-center border-none shadow-none bg-transparent">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mb-6 animate-bounce">
              <Smartphone size={32} />
            </div>
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
              <p className="text-lg font-bold text-txt-primary tracking-wide">{tApp('msg_loading_cloud_data')}</p>
            </div>
          </div>
        </div>
      )}

      <div
        id="landscape-overlay"
        className={`fixed inset-0 z-[9999] bg-app-bg flex-col items-center justify-center text-center p-10 ${showLandscapeOverlay ? 'flex' : 'hidden'}`}
      >
        <div className="animate-rotate-phone mb-4 text-brand-primary">
          <Smartphone size={64} strokeWidth={1.5} className="rotate-90" />
        </div>
        <h2 className="text-xl font-bold text-txt-primary mb-2">{tApp('rotate_device')}</h2>
        <p className="text-txt-muted text-sm">{tApp('rotate_device_desc')}</p>
      </div>

      <div className={`absolute inset-0 z-0 flex flex-col ${view !== AppView.DASHBOARD ? 'invisible pointer-events-none' : ''}`}>
        <Dashboard
          isVisible={view === AppView.DASHBOARD}
          currentView={view}
          userTemplates={appData.templates}
          userTemplatesCount={appData.userTemplatesCount}
          systemOverrides={appData.systemOverrides}
          systemTemplates={appData.systemTemplates}
          systemTemplatesCount={appData.systemTemplatesCount}
          pinnedIds={appData.pinnedIds}
          newBadgeIds={appData.newBadgeIds}
          activeSessionIds={appData.activeSessionIds}
          activeSessions={appData.activeSessions}
          historyRecords={appData.historyRecords}
          historyStatsRecords={appData.historyStatsRecords}
          historyGameEntries={appData.historyGameEntries}
          historyCount={appData.historyCount}
          savedPlayers={appData.savedPlayers}
          searchQuery={appData.searchQuery}
          setSearchQuery={appData.setSearchQuery}
          themeMode={appData.themeMode}
          onToggleTheme={appData.toggleTheme}
          onTemplateSelect={initSetup}
          onDirectResume={handleDirectResume}
          onDiscardSession={appData.discardSession}
          onClearAllActiveSessions={appData.clearAllActiveSessions}
          getSessionPreview={appData.getSessionPreview}
          onTemplateCreate={(name) => {
            setEditorInitialName(name);
            setView(AppView.TEMPLATE_CREATOR);
          }}
          onTemplateDelete={appData.deleteTemplate}
          onTemplateSave={appData.saveTemplate}
          onBatchImport={handleBatchImport}
          onTogglePin={appData.togglePin}
          onTogglePinOption={appData.togglePinOption}
          onClearNewBadges={appData.clearNewBadges}
          onRestoreSystem={appData.restoreSystemTemplate}
          onGetFullTemplate={appData.getTemplate}
          onDeleteHistory={appData.deleteHistoryRecord}
          onHistorySelect={handleHistorySelect}
          isInstalled={isInstalled}
          canInstall={canInstall}
          onInstallClick={handleInstallClick}
          onImportSession={appData.importSession}
          onImportHistory={appData.importHistoryRecord}
          onImportSettings={appData.importSystemSettings}
          onBgStatsImport={appData.importBgStatsData}
          onGetLocalData={appData.getSystemExportData}
          savedLocations={appData.savedLocations}
          savedGames={appData.savedGames}
          isSetupModalOpen={!!pendingTemplate}
          gameOptions={appData.gameOptions}
          onQuickStart={handleQuickStart}
        />
      </div>

      {view === AppView.TEMPLATE_CREATOR && (
        <div className="absolute inset-0 z-50 bg-app-bg">
          <TemplateEditor
            onSave={handleTemplateSave}
            onCancel={() => {
              setView(AppView.DASHBOARD);
              setEditorInitialName(undefined);
            }}
            allTemplates={[...appData.systemTemplates, ...appData.templates]}
            initialName={editorInitialName}
          />
        </div>
      )}

      {view === AppView.ACTIVE_SESSION && appData.currentSession && appData.activeTemplate && (
        <div className="absolute inset-0 z-40 bg-app-bg animate-in fade-in duration-300">
          <SessionView
            key={appData.currentSession.id}
            session={appData.currentSession}
            template={appData.activeTemplate}
            savedPlayers={appData.savedPlayers}
            savedLocations={appData.savedLocations}
            zoomLevel={zoomLevel}
            baseImage={appData.sessionImage}
            onUpdateSession={appData.updateSession}
            onUpdateSavedPlayer={appData.updateSavedPlayer}
            onUpdateImage={appData.setSessionImage}
            onResetScores={appData.resetSessionScores}
            onUpdateTemplate={appData.updateActiveTemplate}
            onExit={handleExitSession}
            onSaveToHistory={handleSaveToHistory}
            onDiscard={handleDiscard}
            isVoiceEnabled={appData.isVoiceEnabled}
            onToggleVoice={appData.toggleVoice}
            multiplayerRoomId={activeMultiplayerRoom?.roomId}
            multiplayerManager={multiplayerSessionManager}
            multiplayerCapabilities={activeMultiplayerRoom?.role === 'player' ? createPlayerSessionCapabilities(activeMultiplayerRoom.playerIds ?? []) : hostSessionCapabilities}
            onOpenMultiplayerRoom={activeMultiplayerRoom?.role !== 'player' ? handleOpenMultiplayerRoom : undefined}
            onOpenMultiplayerParticipantRoom={activeMultiplayerRoom?.role === 'player' ? () => setIsMultiplayerParticipantRoomModalOpen(true) : undefined}
          />
        </div>
      )}

      {view === AppView.HISTORY_REVIEW && appData.viewingHistoryRecord && (
        <div className="absolute inset-0 z-40 bg-app-bg animate-in fade-in duration-300">
          <HistoryReviewView
            record={appData.viewingHistoryRecord}
            onExit={handleHistoryExit}
            zoomLevel={zoomLevel}
          />
        </div>
      )}

      {pendingTemplate && (
        <GameSetupModal
          template={pendingTemplate}
          previewSession={pendingSessionPreview}
          sessionPlayerCount={appData.sessionPlayerCount}
          onClose={() => setPendingTemplate(null)}
          onStart={handleStartNewGame}
          onResume={handleResumeGame}
        />
      )}

      {isJoiningMultiplayer && (
        <div className="modal-backdrop z-[10000]">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        </div>
      )}

      {isMultiplayerRoomModalOpen && activeMultiplayerRoom?.role === 'host' && (
        <MultiplayerRoomModal
          isOpen
          joinUrl={multiplayerJoinUrl}
          connectionCount={multiplayerRoomState?.connectionCount ?? 0}
          hasUnpublishedBoardUpdate={multiplayerRoomState?.hasUnpublishedBoardUpdate ?? false}
          onPublishBoardUpdate={handlePublishMultiplayerBoardUpdate}
          onCloseRoom={handleCloseMultiplayerRoom}
          onClose={() => setIsMultiplayerRoomModalOpen(false)}
        />
      )}

      {isMultiplayerParticipantRoomModalOpen && activeMultiplayerRoom?.role === 'player' && (
        <MultiplayerParticipantRoomModal
          isOpen
          onLeave={handleLeaveMultiplayerRoom}
          onClose={() => setIsMultiplayerParticipantRoomModalOpen(false)}
        />
      )}

      {pendingMultiplayerJoin && (
        <MultiplayerPlayerClaimModal
          isOpen
          players={pendingMultiplayerJoin.bootstrapMessage.package.session.players}
          onConfirm={handleConfirmMultiplayerPlayers}
          onClose={handleCancelMultiplayerJoin}
        />
      )}
      
      <InAppBrowserGuide />
      {isIOSPwaGuideVisible && <IOSPwaGuide onClose={() => setIsIOSPwaGuideVisible(false)} />}
    </div>
  );
};

export default App;
