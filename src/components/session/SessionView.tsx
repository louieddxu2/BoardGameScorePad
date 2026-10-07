
import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { GameSession, GameTemplate } from '../../types';
import { useSessionState } from './hooks/useSessionState';
import { useSessionTemplateApplication } from './hooks/useSessionTemplateApplication';
import { measureSessionScreenshotLayout, useSessionGridAlignment, useSessionItemWidth } from './hooks/useSessionGridLayout';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useSessionMedia } from './hooks/useSessionMedia';
import { useSessionTouchDiagnostics, useSessionScoreHandlers } from './hooks/useSessionTouchDiagnostics';
import { useSessionAiFeedback } from './hooks/useSessionAiFeedback';
import { buildSessionDialogViews } from './parts/buildSessionDialogViews';
import type { SessionViewProps } from './sessionViewTypes';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { useSessionTranslation } from '../../i18n/session';
import { useCommonTranslation } from '../../i18n/common';

// Parts
import SessionHeader from './parts/SessionHeader';
import ScoreGrid from './parts/ScoreGrid';
import TotalsBar from './parts/TotalsBar';
import SessionViewportDiagnostics from './parts/SessionViewportDiagnostics';
import InputPanel from './parts/InputPanel';
// Modals
import ScreenshotModal from './modals/ScreenshotModal';
import { useAiSimpleGenerator } from '../../features/ai-generator/hooks/useAiSimpleGenerator';
import { useAiGenerator } from '../../features/ai-generator/hooks/useAiGenerator';
import { getSessionOccupiedBottom, getSessionPanelDockOffset } from '../../utils/sessionViewport';
import { useLatchedViewportOffset } from '../../hooks/useVisualViewportOffset';
import HistoryPhotoStrip from '../history/HistoryPhotoStrip';
import { useToolboxBoundaryGesture } from '../../hooks/useToolboxBoundaryGesture';
import { createPlayerSessionCapabilities, hostSessionCapabilities } from '../../features/multiplayer/sessionCapabilities';
import { multiplayerSessionManager } from '../../features/multiplayer/multiplayerSessionManager';
import { routeMultiplayerSessionUpdate } from '../../features/multiplayer/multiplayerSessionUpdateRouter';

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { template, zoomLevel, baseImage } = props;
  const { t: tSession } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();

  const [isOnlineSearchOpen, setIsOnlineSearchOpen] = React.useState(false);
  const [isAiPromptOpen, setIsAiPromptOpen] = React.useState(false);
  const [isAdvancedAiOpen, setIsAdvancedAiOpen] = React.useState(false);
  const [advancedInitialFiles, setAdvancedInitialFiles] = React.useState<File[]>([]);

  // 狀態提升：全域 AI 生成器
  const aiGenerator = useAiGenerator();
  const aiSimpleGenerator = useAiSimpleGenerator();
  const [elapsedTime, setElapsedTime] = React.useState<number>(0);
  const [multiplayerPreviewIndex, setMultiplayerPreviewIndex] = React.useState(-1);
  const manager = props.multiplayerManager ?? multiplayerSessionManager;
  const [managedRoomState, setManagedRoomState] = React.useState(() => props.multiplayerRoomId ? manager.get(props.multiplayerRoomId) : null);
  const session = managedRoomState?.session ?? props.session;

  const handleTemplateUpdate = React.useCallback(async (nextTemplate: GameTemplate) => {
    // The parent template save derives its session result from props.session,
    // which may lag behind the managed room's latest participant inputs.
    const previousSession = props.session;
    const result = await props.onUpdateTemplate(nextTemplate);
    const roomId = props.multiplayerRoomId;
    const runtime = managedRoomState?.runtime;
    if (!roomId || !runtime || runtime.role !== 'host' || !result.session) return result;

    const snapshot = await runtime.controller.applyLocalBoard(result.template, result.session, previousSession);
    if (snapshot) {
      props.onUpdateSession(snapshot.session, { alreadyPersisted: true });
      manager.publishSession(roomId, snapshot.session);
      return { ...result, session: snapshot.session };
    }
    return result;
  }, [managedRoomState?.runtime, manager, props.multiplayerRoomId, props.onUpdateTemplate, props.onUpdateSession, props.session]);

  const isAiWorking = aiGenerator.status === 'compressing' || 
                      aiGenerator.status === 'generating' || 
                      aiSimpleGenerator.simpleStatus === 'compressing' || 
                      aiSimpleGenerator.simpleStatus === 'generating';

  // 全域同步計時器
  React.useEffect(() => {
    let interval: any;
    const isGenerating =
      aiGenerator.status === 'compressing' ||
      aiGenerator.status === 'generating' ||
      aiSimpleGenerator.simpleStatus === 'compressing' ||
      aiSimpleGenerator.simpleStatus === 'generating';
    if (isGenerating) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [aiGenerator.status, aiSimpleGenerator.simpleStatus]);

  const handleOpenActiveAiPrompt = React.useCallback(() => {
    if (aiSimpleGenerator.simpleStatus !== 'idle') {
      setIsAiPromptOpen(true);
    } else if (aiGenerator.status !== 'idle') {
      setIsAdvancedAiOpen(true);
    } else {
      setIsAiPromptOpen(true);
    }
  }, [aiSimpleGenerator.simpleStatus, aiGenerator.status]);

  const sessionState = useSessionState({ ...props, session, onUpdateTemplate: handleTemplateUpdate });
  const [isToolboxInputFocused, setIsToolboxInputFocused] = useState(false);
  const capabilities = useMemo(() => {
    if (props.multiplayerCapabilities) return props.multiplayerCapabilities;
    const player = session.players[multiplayerPreviewIndex];
    return player ? createPlayerSessionCapabilities(player.id) : hostSessionCapabilities;
  }, [props.multiplayerCapabilities, session.players, multiplayerPreviewIndex]);
  const multiplayerPreviewLabel = capabilities.role === 'host'
    ? 'Multiplayer test: host'
    : `Multiplayer test: player ${session.players.findIndex(player => player.id === capabilities.playerId) + 1}`;
  const multiplayerPreviewPlayerNumber = capabilities.role === 'player'
    ? session.players.findIndex(player => player.id === capabilities.playerId) + 1
    : null;
  const { setUiState, keyboardOffset, isKeyboardOpen, closeFocusedPlayerNameInput } = sessionState;
  const stableKeyboardOffset = useLatchedViewportOffset(keyboardOffset, isToolboxInputFocused);
  const isNativeKeyboardCompensationActive = isKeyboardOpen && (
    sessionState.uiState.isInputFocused || isToolboxInputFocused
  );
  const isAndroid = typeof document !== 'undefined' && document.documentElement.dataset.android === 'true';
  const isStandalone = typeof document !== 'undefined' && document.documentElement.dataset.standalone === 'true';
  const isAndroidBrowser = isAndroid && !isStandalone;
  const sessionIdleDockOffset = isAndroidBrowser
    ? 'var(--app-safe-area-bottom)'
    : 'var(--bottom-ui-safe-gap)';
  const panelDockOffset = getSessionPanelDockOffset(stableKeyboardOffset, isNativeKeyboardCompensationActive, sessionIdleDockOffset);
  const occupiedBottom = getSessionOccupiedBottom(sessionState.panelHeight, stableKeyboardOffset, isNativeKeyboardCompensationActive, sessionIdleDockOffset);

  // No special local state needed for photo preview anymore
  const eventHandlers = useSessionEvents({
    ...props,
    session,
    onUpdateTemplate: handleTemplateUpdate,
    isMultiplayerRoomActive: Boolean(props.multiplayerRoomId),
  }, sessionState);

  // Media Logic
  const media = useSessionMedia({
    session,
    template,
    baseImage,
    onUpdateSession: props.onUpdateSession,
    onUpdateTemplate: handleTemplateUpdate,
    onUpdateImage: props.onUpdateImage,
    setUiState,
    isEditMode: sessionState.uiState.isEditMode
  });

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const handleResetScores = useCallback(async () => {
    if (isAiWorking || !capabilities.canManageSession) return;
    if (await confirm({
      title: tSession('session_reset_confirm_title'),
      message: tSession('session_reset_confirm_msg'),
      confirmText: tCommon('reset'),
      isDangerous: true
    })) {
      props.onResetScores();
      setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, previewValue: 0 }));
    }
  }, [capabilities.canManageSession, confirm, isAiWorking, props.onResetScores, setUiState, tCommon, tSession]);

  React.useEffect(() => {
    const roomId = props.multiplayerRoomId;
    if (!roomId) {
      setManagedRoomState(null);
      return undefined;
    }
    const refresh = () => setManagedRoomState(manager.get(roomId));
    manager.attachView(roomId);
    const unsubscribe = manager.subscribe(refresh);
    refresh();
    return () => {
      unsubscribe();
      manager.detachView(roomId);
    };
  }, [manager, props.multiplayerRoomId]);

  const handleSessionUpdate = useCallback(async (nextSession: GameSession) => {
    const roomId = props.multiplayerRoomId;
    const runtime = managedRoomState?.runtime;
    if (!roomId || !runtime) {
      props.onUpdateSession(nextSession);
      return;
    }
    const claimedPlayerIds = props.multiplayerCapabilities?.playerIds ??
      (props.multiplayerCapabilities?.playerId ? [props.multiplayerCapabilities.playerId] : []);
    const canonical = await routeMultiplayerSessionUpdate({
      previous: session,
      next: nextSession,
      runtime,
      claimedPlayerIds,
    });
    if (canonical) {
      props.onUpdateSession(canonical, { alreadyPersisted: true });
    }
  }, [managedRoomState?.runtime, props.multiplayerCapabilities, props.multiplayerRoomId, props.onUpdateSession, session]);

  const {
    editingCell,
    editingPlayerId,
    editingColumn,
    isEditingTitle,
    isAddColumnModalOpen,
    showShareMenu,
    screenshotModal,
    isInputFocused,
    isEditMode,
    previewValue,
    isPhotoGalleryOpen,
    isImageUploadModalOpen,
    isScannerOpen,
    isTextureMapperOpen,
    isGameSettingsOpen, // [New]
    isToolboxOpen
  } = sessionState.uiState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;

  const isInputInterfaceOpen =
    editingCell !== null ||
    editingPlayerId !== null ||
    editingColumn !== null ||
    isEditingTitle ||
    isInputFocused ||
    isToolboxInputFocused ||
    isAddColumnModalOpen ||
    isGameSettingsOpen ||
    isImageUploadModalOpen ||
    isPhotoGalleryOpen ||
    isScannerOpen ||
    isTextureMapperOpen ||
    screenshotModal.isOpen ||
    showShareMenu;

  const canAutoOpenToolbox = !!baseImage || template.columns.length >= 5;

  React.useEffect(() => {
    if (!isToolboxOpen) setIsToolboxInputFocused(false);
  }, [isToolboxOpen]);

  useToolboxBoundaryGesture({
    scrollContainerRef: sessionState.tableContainerRef,
    isToolboxOpen,
    canAutoOpenToolbox,
    isInputInterfaceOpen,
    onAutoOpen: eventHandlers.handleOpenToolbox,
    onAutoClose: eventHandlers.handleCloseToolbox,
  });

  const { sessionSurfaceRef, touchDiagnosticStateRef } = useSessionTouchDiagnostics(sessionState.uiState);

  // Winners Logic - Use pre-calculated winners from session to stabilize references
  const winners = useMemo(() => session.winnerIds || [], [session.winnerIds]);

  const isScoresEmpty = useMemo(() => {
    return session.players.every(p => {
      if (!p.scores) return true;
      return Object.values(p.scores).every(scoreData => {
        if (!scoreData) return true;
        return !scoreData.parts || scoreData.parts.length === 0;
      });
    });
  }, [session.players]);

  const leftColWidth = useSessionItemWidth(session.players.length);

  const { handleApplyTemplate, handleAiSuccess } = useSessionTemplateApplication({
    session,
    template,
    onUpdateTemplate: handleTemplateUpdate,
    onUpdateSession: handleSessionUpdate,
    setIsOnlineSearchOpen,
    setIsAiPromptOpen,
    showToast,
    tSession,
  });

  useSessionAiFeedback({ aiGenerator, aiSimpleGenerator, isAiPromptOpen, showToast, tSession });

  const { handleCellClickSafe, handleColumnHeaderClickSafe } = useSessionScoreHandlers({
    touchDiagnosticStateRef, isAiWorking, template, capabilities, eventHandlers,
    onRequestMultiplayerPlayerClaim: props.onRequestMultiplayerPlayerClaim
  });

  // Prepare Overlay Data for Photo Gallery
  const overlayData = useMemo(() => ({
    gameName: session.name || template.name, // [Identity Upgrade] Use Session Name
    date: session.startTime,
    players: session.players,
    winners: winners,
    scoringRule: session.scoringRule,
  }), [session.name, template.name, session.startTime, session.players, winners, session.scoringRule]);

  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
    const measuredLayout = measureSessionScreenshotLayout(template.columns);
    if (!measuredLayout) {
      showToast({ message: tSession('photo_msg_capture_fail'), type: 'error' });
      return;
    }

    setUiState(p => ({
      ...p,
      editingCell: null,
      editingPlayerId: null,
      previewValue: 0,
      screenshotModal: { isOpen: true, mode, layout: measuredLayout }
    }));

  }, [setUiState, showToast, template.columns]);

  useSessionGridAlignment(sessionState);

  const dialogViews = buildSessionDialogViews({
    props, session, template, baseImage, sessionState, setUiState, eventHandlers, media,
    isOnlineSearchOpen, setIsOnlineSearchOpen, isAiPromptOpen, setIsAiPromptOpen, isAdvancedAiOpen,
    setIsAdvancedAiOpen, advancedInitialFiles, setAdvancedInitialFiles, aiSimpleGenerator, aiGenerator,
    elapsedTime, handleApplyTemplate, handleAiSuccess, handleTemplateUpdate, overlayData, confirm, tSession, tCommon
  });

  return (
    <div 
      ref={sessionSurfaceRef}
      data-session-surface="true"
      className="flex flex-col h-full bg-app-bg text-txt-primary overflow-hidden relative"
      style={{
        '--internal-panel-height': isPanelOpen ? `${sessionState.panelHeight}` : '0px',
        '--totals-bar-height': '40px'
      } as React.CSSProperties}
    >
      {/* --- Modals --- */}

      {dialogViews.onlineSearch}

      {dialogViews.simpleAiPrompt}

      {dialogViews.advancedAiPrompt}

      {dialogViews.exit}

      {dialogViews.photoGallery}

      {dialogViews.camera}

      {dialogViews.imageFlow}

      {dialogViews.background}

      {dialogViews.gameSettings}

      {dialogViews.columnEditor}

      {dialogViews.addColumn}

      {/* Hidden inputs for photos */}
      <input ref={media.photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={media.handlePhotoSelect} />
      <input ref={media.galleryInputRef} type="file" accept="image/*" className="hidden" onChange={media.handlePhotoSelect} />

      {/* --- Main UI --- */}
      <SessionHeader
        templateName={session.name || template.name} // [Identity Upgrade] Use Session Name if available
        isEditingTitle={isEditingTitle}
        showShareMenu={showShareMenu}
        shareMenuZIndex={eventHandlers.shareMenuZIndex} // [NEW] Pass dynamic zIndex
        screenshotActive={screenshotModal.isOpen}
        isEditMode={isEditMode && capabilities.canEditTemplate}
        canEditTemplate={capabilities.canEditTemplate}
        canUseMediaTools={capabilities.canUseMediaTools}
        onCycleMultiplayerPreview={() => {
          setMultiplayerPreviewIndex((current) => current >= session.players.length - 1 ? -1 : current + 1);
          setUiState((current) => ({ ...current, editingCell: null, editingPlayerId: null, previewValue: 0 }));
        }}
        multiplayerPreviewLabel={multiplayerPreviewLabel}
        multiplayerPreviewPlayerNumber={multiplayerPreviewPlayerNumber}
        onOpenMultiplayerRoom={capabilities.role === 'host' ? props.onOpenMultiplayerRoom : undefined}
        onOpenMultiplayerParticipantRoom={capabilities.role === 'player' ? props.onOpenMultiplayerParticipantRoom : undefined}
        multiplayerConnectionStatus={managedRoomState?.role === 'player' ? managedRoomState.status : undefined}
        multiplayerConnectionCount={managedRoomState?.role === 'host' ? managedRoomState.connectionCount : undefined}
        hasUnpublishedBoardUpdate={managedRoomState?.role === 'host' ? managedRoomState.hasUnpublishedBoardUpdate : false}
        hasVisuals={!!template.globalVisuals}
        hasCloudImage={!!template.cloudImageId && !baseImage}
        onEditTitleToggle={(editing) => {
          setUiState(prev => {
            const newState = { ...prev, isEditingTitle: editing };
            if (editing) {
              newState.editingCell = null;
              newState.editingPlayerId = null;
              newState.previewValue = 0;
            }
            return newState;
          });
        }}
        onTitleSubmit={eventHandlers.handleTitleSubmit}
        onExit={() => {
          window.dispatchEvent(new CustomEvent('app-back-press'));
        }}
        onShareMenuToggle={(show) => {
          if (!capabilities.canUseMediaTools) return;
          setUiState(prev => ({ ...prev, showShareMenu: show }));
        }}
        onScreenshotRequest={handleScreenshotRequest}
        onToggleEditMode={() => {
          if (!capabilities.canEditTemplate) return;
          setUiState(prev => ({ ...prev, isEditMode: !prev.isEditMode }));
        }}
        onUploadImage={() => setUiState(p => ({ ...p, isImageUploadModalOpen: true, showShareMenu: false }))}
        onCloudDownload={media.handleCloudDownload}
        onOpenGallery={() => setUiState(p => ({
          ...p,
          isPhotoGalleryOpen: true,
          galleryParams: { mode: 'default' } // [Reset] Ensure manual open resets special modes
        }))}
        onTakePhoto={media.openCamera} // Direct call via media hook (sets default)
        photoCount={session.photos?.length || 0}
      />

      <div
        className="flex-1 overflow-hidden relative flex flex-col"
        onClick={eventHandlers.handleGlobalClick}
      >
        {editingPlayerId && isInputFocused && (
          <div
            className="absolute inset-0 z-40 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              closeFocusedPlayerNameInput();
            }}
          />
        )}

        <ScoreGrid
          session={session}
          template={template}
          editingCell={editingCell}
          editingPlayerId={editingPlayerId}
          onCellClick={handleCellClickSafe}
          onPlayerHeaderClick={(playerId, event) => {
            if (capabilities.role === 'player') {
              props.onRequestMultiplayerPlayerClaim?.(playerId);
              return;
            }
            if (!capabilities.canEditPlayers) return;
            eventHandlers.handlePlayerHeaderClick(playerId, event);
          }}
          canManageParticipantClaims={capabilities.role === 'player'}
          onColumnHeaderClick={handleColumnHeaderClickSafe}
          onUpdateTemplate={capabilities.canEditTemplate ? handleTemplateUpdate : () => undefined}
          onAddColumn={capabilities.canEditTemplate ? eventHandlers.handleAddBlankColumn : () => undefined}
          onOpenBatchAdd={capabilities.canEditTemplate && !isAiWorking ? () => {
            setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }));
          } : undefined}
          onOpenSettings={capabilities.canEditTemplate ? eventHandlers.handleOpenGameSettings : undefined}
          onToggleToolbox={capabilities.canOpenToolbox ? eventHandlers.handleToggleToolbox : undefined}
          isToolboxOpen={capabilities.canOpenToolbox && isToolboxOpen}
          scrollContainerRef={sessionState.tableContainerRef}
          contentRef={sessionState.gridContentRef}
          baseImage={baseImage || undefined}
          isEditMode={isEditMode && capabilities.canEditTemplate}
          zoomLevel={zoomLevel}
          previewValue={previewValue}
          onOpenOnlineSearch={capabilities.canOpenToolbox ? () => setIsOnlineSearchOpen(true) : undefined}
          onOpenAiPrompt={capabilities.canOpenToolbox ? handleOpenActiveAiPrompt : undefined}
          aiStatus={aiSimpleGenerator.simpleStatus !== 'idle' ? (aiSimpleGenerator.simpleStatus as any) : aiGenerator.status}
          simpleFlashStatus={aiSimpleGenerator.flashStatus}
          simpleGemmaStatus={aiSimpleGenerator.gemmaStatus}
          elapsedTime={elapsedTime}
          panelDockOffset={panelDockOffset}
          canEditScore={capabilities.canEditScore}
          participantClaimCounts={managedRoomState?.role === 'host' ? managedRoomState.participantClaims : undefined}
          editablePlayerIds={capabilities.role === 'player' ? capabilities.playerIds : undefined}
        />
      </div>

      {isScoresEmpty && (
        <div 
          className={`absolute left-0 right-0 z-40 pointer-events-none transition-all duration-300 ease-in-out ${
            (editingCell?.colId === '__TOTAL__' || isToolboxOpen) ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          style={{
            bottom: `calc(${occupiedBottom} + 40px + 8px)`,
            paddingLeft: `${leftColWidth}px`,
            paddingRight: '16px'
          }}
        >
          <div className="w-full p-3 rounded-xl border border-surface-border bg-surface-bg-alt/80 backdrop-blur-sm text-txt-secondary text-xs flex items-center justify-center gap-2 shadow-sm box-border">
            <ArrowDown className="w-4 h-4 text-brand-primary shrink-0 animate-bounce" />
            <span className="leading-relaxed font-semibold">
              {tSession('session_simple_promo_totals_hint')}
            </span>
          </div>
        </div>
      )}

      <div className={isAiWorking ? "pointer-events-none opacity-50 select-none filter grayscale-[20%] transition-all duration-300" : ""}>
        <TotalsBar
          players={session.players}
          winners={winners}
          isPanelOpen={isPanelOpen}
          panelHeight={occupiedBottom}
          scrollRef={sessionState.totalBarScrollRef}
          contentRef={sessionState.totalContentRef}
          isHidden={isInputFocused || isEditingTitle} // [Modified] Also hide when editing title
          template={template}
          baseImage={baseImage || undefined}
          editingCell={editingCell}
          previewValue={previewValue}
          onTotalClick={(playerId) => {
            if (isAiWorking) return;
            if (!capabilities.canEditTotal(playerId)) {
              return;
            }
            eventHandlers.handleCellClick(playerId, '__TOTAL__', { stopPropagation: () => { } } as any);
          }}
          onReset={capabilities.canManageSession ? handleResetScores : undefined}
          canEditTotal={capabilities.canEditTotal}
          zoomLevel={zoomLevel}
          scoringRule={session.scoringRule}
        />
      </div>

      <InputPanel
        sessionState={sessionState}
        eventHandlers={eventHandlers}
        session={session}
        template={template}
        savedPlayers={props.savedPlayers} // Updated Prop Name
        allSavedPlayers={props.allSavedPlayers}
        onUpdateSession={handleSessionUpdate}
        onUpdateSavedPlayer={props.onUpdateSavedPlayer} // Updated Prop Name
        onTakePhoto={capabilities.canUseMediaTools ? media.openScoreCamera : undefined}
        onScreenshotRequest={capabilities.canUseMediaTools ? handleScreenshotRequest : undefined}
        isVoiceEnabled={props.isVoiceEnabled}
        onToggleVoice={props.onToggleVoice}
        bottomOffset={panelDockOffset}
        canEditScore={capabilities.canEditScore}
        canEditTotal={capabilities.canEditTotal}
        canEditPlayers={capabilities.canEditPlayers}
        mediaOnlyTools={capabilities.role === 'player'}
        onToolboxInputFocusChange={setIsToolboxInputFocused}
        toolboxTopContent={session.photos?.length ? (
          <HistoryPhotoStrip
            photoIds={session.photos}
            onPhotoClick={(photoId) => setUiState(p => ({
              ...p,
              isPhotoGalleryOpen: true,
              galleryParams: {
                mode: 'default',
                initialPhotoId: photoId,
                entryMode: 'direct-lightbox',
              },
            }))}
          />
        ) : undefined}
      />

      <SessionViewportDiagnostics />

      <ScreenshotModal
        isOpen={screenshotModal.isOpen}
        onClose={() => setUiState(p => ({ ...p, screenshotModal: { ...p.screenshotModal, isOpen: false } }))}
        initialMode={screenshotModal.mode}
        session={session}
        template={template}
        zoomLevel={zoomLevel}
        layout={screenshotModal.layout}
        baseImage={baseImage || undefined}
        customWinners={winners}
      />
    </div>
  );
};

export default SessionView;
