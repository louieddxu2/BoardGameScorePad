
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppView, GameTemplate } from './types';
import { useAppData } from './hooks/useAppData';
import { useMobileZoom } from './hooks/useMobileZoom';
import { useLandscapeOrientation } from './hooks/useLandscapeOrientation';
import { usePwaInstall } from './hooks/usePwaInstall';
import { getTargetHistoryDepth } from './config/historyStrategy'; // Import Strategy
import { hasActiveModals } from './hooks/useModalBackHandler'; // Modal 歷史協調
import { useToast } from './hooks/useToast';
import { useAppTranslation } from './i18n/app';
import { useAiTemplateShareConfirm } from './hooks/useAiTemplateShareConfirm';
import { parseDeepLinkFromHash } from './utils/deepLink';
import { fetchTemplateFromCloud } from './services/templateShareService';
import { cloudClient } from './services/cloudClient';
import { db } from './db';
import { useMultiplayerRoomLifecycle } from './hooks/useMultiplayerRoomLifecycle';
import { useAppSessionActions } from './hooks/useAppSessionActions';

import AppWorkspace from './components/app/AppWorkspace';
import { isInAppBrowser } from './components/modals/InAppBrowserGuide';
import { shouldTriggerIOSPwaGuide } from './components/modals/IOSPwaGuide';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isCloudImporting, setIsCloudImporting] = useState(false);

  // Custom Hook for all data logic
  const appData = useAppData();

  const { showToast } = useToast();
  const { t: tApp } = useAppTranslation();

  const multiplayerLifecycle = useMultiplayerRoomLifecycle({ appData, setView, showToast, tApp });
  const {
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
  } = multiplayerLifecycle;

  // Hook for encapsulated AI Template Sharing confirmation
  const { captureAiTemplateForSharing } = useAiTemplateShareConfirm(view);

  // Local UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);

  // For "Create from Search" flow
  const [editorInitialName, setEditorInitialName] = useState<string | undefined>(undefined);

  // Ref to ignore popstates triggered by our own history manipulation (pruning)
  const ignorePopstateRef = useRef(false);
  const deepLinkHandledRef = useRef(false);

  // Hardware & Environment Side Effects Hooks
  const zoomLevel = useMobileZoom();
  const showLandscapeOverlay = useLandscapeOrientation();
  const { isInstalled, canInstall, handleInstallClick } = usePwaInstall();

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

  const actions = useAppSessionActions({
    appData,
    activeMultiplayerRoom,
    releaseHostMultiplayerRoom,
    releaseParticipantMultiplayerRoom,
    tryRestoreMultiplayerRoom,
    transitionToDashboard,
    captureAiTemplateForSharing,
    shouldTriggerIOSPwaGuide,
    setView,
    setPendingTemplate,
    setEditorInitialName,
    setIsIOSPwaGuideVisible,
  });

  return (
    <AppWorkspace
      view={view}
      appData={appData}
      pendingTemplate={pendingTemplate}
      pendingSessionPreview={pendingSessionPreview}
      editorInitialName={editorInitialName}
      isCloudImporting={isCloudImporting}
      showLandscapeOverlay={showLandscapeOverlay}
      zoomLevel={zoomLevel}
      isInstalled={isInstalled}
      canInstall={canInstall}
      isIOSPwaGuideVisible={isIOSPwaGuideVisible}
      setView={setView}
      setPendingTemplate={setPendingTemplate}
      setEditorInitialName={setEditorInitialName}
      setIsIOSPwaGuideVisible={setIsIOSPwaGuideVisible}
      handleInstallClick={handleInstallClick}
      tApp={tApp}
      actions={actions}
      multiplayer={multiplayerLifecycle}
    />
  );
};

export default App;
