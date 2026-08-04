
import React, { useCallback, useRef, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { GameSession, GameTemplate, SavedListItem } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useSessionMedia } from './hooks/useSessionMedia';
import { installTouchDiagnostics, recordScoreHandlerDecision } from './touchDiagnostics';
import type { TouchDiagnosticState } from './touchDiagnostics';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { useSessionTranslation } from '../../i18n/session';
import { useCommonTranslation } from '../../i18n/common';
import { calculateWinners } from '../../utils/templateUtils'; // [Refactor]

// Parts
import SessionHeader from './parts/SessionHeader';
import ScoreGrid from './parts/ScoreGrid';
import TotalsBar from './parts/TotalsBar';
import InputPanel from './parts/InputPanel';
// Modals
import ScreenshotModal from './modals/ScreenshotModal';
import ColumnConfigEditor from '../shared/ColumnConfigEditor';
import AddColumnModal from './modals/AddColumnModal';
import SessionExitModal from './modals/SessionExitModal';
import PhotoGalleryModal from './modals/PhotoGalleryModal';
import SessionBackgroundModal from './modals/SessionBackgroundModal';
import SessionImageFlow from './SessionImageFlow';
import CameraView from '../scanner/CameraView';
import GameSettingsEditor from '../shared/GameSettingsEditor';
import SearchTemplateOnlineModal from '../dashboard/modals/SearchTemplateOnlineModal';
import AiPromptModal from '../../features/ai-generator/components/AiPromptModal';
import AiSimplePromptModal from '../../features/ai-generator/components/AiSimplePromptModal';
import { useAiSimpleGenerator } from '../../features/ai-generator/hooks/useAiSimpleGenerator';
import { db } from '../../db';
import { useAiGenerator } from '../../features/ai-generator/hooks/useAiGenerator';
import { markPendingAiShare } from '../../utils/pendingAiShare';
import { getSessionOccupiedBottom, getSessionPanelDockOffset } from '../../utils/sessionViewport';
import { useToolboxBoundaryGesture } from '../../hooks/useToolboxBoundaryGesture';
import { createPlayerSessionCapabilities, hostSessionCapabilities, SessionCapabilities } from '../../features/multiplayer/sessionCapabilities';
import { MultiplayerSessionManager, multiplayerSessionManager } from '../../features/multiplayer/multiplayerSessionManager';
import { routeMultiplayerSessionUpdate } from '../../features/multiplayer/multiplayerSessionUpdateRouter';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  savedPlayers: SavedListItem[]; // Renamed from playerHistory
  allSavedPlayers?: SavedListItem[];
  savedLocations?: SavedListItem[]; // Renamed from locationHistory
  zoomLevel: number;
  baseImage: string | null;
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => Promise<{ template: GameTemplate; session: GameSession | null }>;
  onUpdateSavedPlayer: (name: string) => void; // Renamed from onUpdatePlayerHistory
  onUpdateImage: (img: string | Blob | null) => void;
  onExit: (location?: string) => void;
  onResetScores: () => void;
  onSaveToHistory: (location?: string) => void;
  onDiscard: () => void;
  isVoiceEnabled?: boolean;
  onToggleVoice?: () => void;
  multiplayerCapabilities?: SessionCapabilities;
  multiplayerRoomId?: string;
  multiplayerManager?: MultiplayerSessionManager;
  onOpenMultiplayerRoom?: () => void;
  onOpenMultiplayerParticipantRoom?: () => void;
  onRequestMultiplayerPlayerClaim?: (playerId: string) => void;
}

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
    const result = await props.onUpdateTemplate(nextTemplate);
    const roomId = props.multiplayerRoomId;
    const runtime = managedRoomState?.runtime;
    if (!roomId || !runtime || runtime.role !== 'host' || !result.session) return result;

    const snapshot = await runtime.controller.applyLocalBoard(result.template, result.session);
    if (snapshot) {
      manager.publishSession(roomId, snapshot.session);
      manager.setUnpublishedBoardUpdate(roomId, true);
    }
    return result;
  }, [managedRoomState?.runtime, manager, props.multiplayerRoomId, props.onUpdateTemplate]);

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

  const sessionState = useSessionState({ ...props, onUpdateTemplate: handleTemplateUpdate });
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
  const { setUiState, keyboardOffset, closeFocusedPlayerNameInput } = sessionState;
  const panelDockOffset = getSessionPanelDockOffset(keyboardOffset);
  const occupiedBottom = getSessionOccupiedBottom(sessionState.panelHeight, keyboardOffset);

  // No special local state needed for photo preview anymore
  const eventHandlers = useSessionEvents({ ...props, onUpdateTemplate: handleTemplateUpdate }, sessionState);

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
      manager.publishSession(roomId, canonical);
      props.onUpdateSession(canonical);
    }
  }, [managedRoomState?.runtime, manager, props.multiplayerCapabilities, props.multiplayerRoomId, props.onUpdateSession, session]);

  const {
    editingCell,
    editingPlayerId,
    editingColumn,
    isEditingTitle,
    isSessionExitModalOpen,
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
    isAddColumnModalOpen ||
    isGameSettingsOpen ||
    isImageUploadModalOpen ||
    isPhotoGalleryOpen ||
    isScannerOpen ||
    isTextureMapperOpen ||
    screenshotModal.isOpen ||
    showShareMenu;

  const canAutoOpenToolbox = !!baseImage || template.columns.length >= 5;

  const handleAutoOpenToolbox = useCallback(() => {
    setUiState(prev => ({
      ...prev,
      isToolboxOpen: true,
      editingCell: null,
      editingPlayerId: null,
      previewValue: 0,
    }));
  }, [setUiState]);

  const handleAutoCloseToolbox = useCallback(() => {
    setUiState(prev => ({ ...prev, isToolboxOpen: false }));
  }, [setUiState]);

  useToolboxBoundaryGesture({
    scrollContainerRef: sessionState.tableContainerRef,
    isToolboxOpen,
    canAutoOpenToolbox,
    isInputInterfaceOpen,
    onAutoOpen: handleAutoOpenToolbox,
    onAutoClose: handleAutoCloseToolbox,
  });

  const sessionSurfaceRef = useRef<HTMLDivElement>(null);
  const touchDiagnosticStateRef = useRef<TouchDiagnosticState>({
    editingCell: null,
    editingPlayerId: null,
    isInputFocused: false,
    isToolboxOpen: false,
    isEditMode: false,
  });

  React.useEffect(() => {
    touchDiagnosticStateRef.current = {
      editingCell: editingCell ? `${editingCell.playerId}:${editingCell.colId}` : null,
      editingPlayerId,
      isInputFocused,
      isToolboxOpen,
      isEditMode,
    };
  }, [editingCell, editingPlayerId, isInputFocused, isToolboxOpen, isEditMode]);

  React.useEffect(() => {
    const surface = sessionSurfaceRef.current;
    if (!surface) return undefined;
    return installTouchDiagnostics(surface, () => touchDiagnosticStateRef.current);
  }, []);

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

  const isInitialSimpleScorepad = template.columns.length === 0 && isScoresEmpty;

  const [containerWidth, setContainerWidth] = React.useState(0);
  React.useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const leftColWidth = useMemo(() => {
    if (containerWidth > 0) {
      return Math.max(70, containerWidth / (session.players.length + 2));
    }
    return 70;
  }, [containerWidth, session.players.length]);



  // 安全套用社群範本 (重置分數格，更新 columns，安全原地刷新)
  const handleApplyTemplate = useCallback(async (fetched: any) => {
    let payloadObj: any = null;
    try {
      payloadObj = typeof fetched.payload === 'string'
        ? JSON.parse(fetched.payload)
        : fetched.payload;
    } catch (e) {
      console.error("Failed to parse template payload", e);
      return;
    }

    if (!payloadObj) return;

    // 1. 複製玩家並清空所有輸入分數 (原地清空)
    const newPlayers = session.players.map(p => ({
      ...p,
      scores: {}
    }));

    // 2. 原地覆寫模板屬性
    const updatedTemplate: GameTemplate = {
      ...template,
      columns: payloadObj.columns || [],
      defaultScoringRule: payloadObj.defaultScoringRule || template.defaultScoringRule,
      supportedColors: payloadObj.supportedColors || template.supportedColors,
      globalVisuals: payloadObj.globalVisuals || template.globalVisuals,
      imageId: payloadObj.imageId || template.imageId,
      cloudImageId: payloadObj.cloudImageId || template.cloudImageId,
      hasImage: payloadObj.hasImage !== undefined ? payloadObj.hasImage : template.hasImage,
      description: payloadObj.description || template.description,
      updatedAt: Date.now()
    };

    // 3. 重新建立會話物件，並重設 winners
    const updatedSession: GameSession = {
      ...session,
      players: newPlayers,
      winnerIds: [], // 清空 winners
      scoringRule: updatedTemplate.defaultScoringRule,
    };

    // 4. 原地驅動 React 狀態流更新（IndexedDB 寫入由上層 onUpdate 自動非同步完成）
    await handleTemplateUpdate(updatedTemplate);
    await handleSessionUpdate(updatedSession);

    // 5. 標記偏好，記錄此範本以防止重覆推薦
    try {
      db.templatePrefs.put({
        templateId: updatedTemplate.id,
        lastPlayerCount: session.players.length,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error("Failed to record prefs", e);
    }

    // 6. 關閉彈窗並彈出提示
    setIsOnlineSearchOpen(false);
    showToast({ message: tSession('toast_apply_template_success'), type: 'success' });
  }, [handleSessionUpdate, handleTemplateUpdate, session, template, showToast, tSession]);

  // 安全套用 AI 產生之範本
  const handleAiSuccess = useCallback(async (result: Partial<GameTemplate>) => {
    if (!result.columns || result.columns.length === 0) return;

    // 1. 複製玩家並清空所有輸入分數 (原地清空)
    const newPlayers = session.players.map(p => ({
      ...p,
      scores: {}
    }));

    // 2. 原地覆寫模板欄位
    const updatedTemplate: GameTemplate = {
      ...template,
      columns: result.columns,
      defaultScoringRule: result.defaultScoringRule || template.defaultScoringRule,
      updatedAt: Date.now(),
    };

    // 3. 重新建立會話物件，並重設 winners
    const updatedSession: GameSession = {
      ...session,
      players: newPlayers,
      winnerIds: [],
      scoringRule: updatedTemplate.defaultScoringRule,
    };

    // 4. 原地驅動 React 狀態更新
    await handleTemplateUpdate(updatedTemplate);
    await handleSessionUpdate(updatedSession);

    // 5. 記憶體標記：待首次結束遊戲 Save to History 時詢問分享
    markPendingAiShare(template.id);

    // 6. 關閉彈窗與拍照介面，彈出提示
    setIsAiPromptOpen(false);
    setIsOnlineSearchOpen(false);
    showToast({ message: tSession('toast_ai_apply_success'), type: 'success' });
  }, [handleSessionUpdate, handleTemplateUpdate, session, template, showToast, tSession]);

  React.useEffect(() => {
    if (aiGenerator.status === 'error') {
      if (!isAiPromptOpen) {
        showToast({ message: tSession('toast_ai_generation_failed') || 'AI generation failed, please try again.', type: 'error' });
        aiGenerator.reset();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiGenerator.status, showToast, tSession, aiGenerator.reset]);

  const aiStatusRef = React.useRef(aiGenerator.status);
  React.useEffect(() => {
    aiStatusRef.current = aiGenerator.status;
  }, [aiGenerator.status]);

  // 元件卸載監聽：AI 生成中若按「上一頁」回到 Dashboard 則彈出中斷提示 Toast 並重置 (0 歷史堆疊風險)
  React.useEffect(() => {
    const currentReset = aiGenerator.reset;
    const currentSimpleReset = aiSimpleGenerator.resetSimple;
    return () => {
      if (aiStatusRef.current === 'compressing' || aiStatusRef.current === 'generating') {
        showToast({ message: tSession('toast_ai_generation_interrupted') || '🔮 AI scoreboard generation aborted.', type: 'info' });
        currentReset();
      }
      currentSimpleReset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellClickSafe = useCallback((playerId: string, colId: string, e: React.MouseEvent) => {
    if (isAiWorking) {
      recordScoreHandlerDecision({
        event: e.nativeEvent,
        state: touchDiagnosticStateRef.current,
        playerId,
        columnId: colId,
        accepted: false,
        reason: 'ai-working',
      });
      return;
    }
    const column = template.columns.find((item) => item.id === colId);
    const canEdit = capabilities.canEditScore(playerId, column);
    if (!canEdit) {
      recordScoreHandlerDecision({
        event: e.nativeEvent,
        state: touchDiagnosticStateRef.current,
        playerId,
        columnId: colId,
        accepted: false,
        reason: 'capability-rejected',
      });
      return;
    }
    recordScoreHandlerDecision({
      event: e.nativeEvent,
      state: touchDiagnosticStateRef.current,
      playerId,
      columnId: colId,
      accepted: true,
      reason: 'accepted',
    });
    eventHandlers.handleCellClick(playerId, colId, e);
  }, [isAiWorking, eventHandlers.handleCellClick, template.columns, capabilities, props.onRequestMultiplayerPlayerClaim]);

  const handleColumnHeaderClickSafe = useCallback((e: React.MouseEvent, col: any) => {
    if (isAiWorking) {
      return;
    }
    if (!capabilities.canEditTemplate) return;
    eventHandlers.handleColumnHeaderClick(e, col);
  }, [isAiWorking, eventHandlers.handleColumnHeaderClick, capabilities]);

  // Prepare Overlay Data for Photo Gallery
  const overlayData = useMemo(() => ({
    gameName: session.name || template.name, // [Identity Upgrade] Use Session Name
    date: session.startTime,
    players: session.players,
    winners: winners
  }), [session.name, template.name, session.startTime, session.players, winners]);

  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
    const playerHeaderRowEl = document.querySelector('#live-player-header-row') as HTMLElement;
    const itemHeaderEl = playerHeaderRowEl?.querySelector('div:first-child') as HTMLElement;
    const playerHeaderEls = playerHeaderRowEl?.querySelectorAll('[data-player-header-id]');
    const totalsRowEl = document.querySelector('#live-totals-bar') as HTMLElement;

    if (!playerHeaderRowEl || !itemHeaderEl || !playerHeaderEls || playerHeaderEls.length === 0) {
      showToast({ message: tSession('photo_msg_capture_fail'), type: 'error' });
      return;
    }

    const measuredLayout: ScreenshotLayout = {
      itemWidth: itemHeaderEl.offsetWidth,
      playerWidths: {},
      playerHeaderHeight: playerHeaderRowEl.offsetHeight,
      rowHeights: {},
      totalRowHeight: totalsRowEl ? totalsRowEl.offsetHeight : undefined
    };

    playerHeaderEls.forEach(el => {
      const playerId = el.getAttribute('data-player-header-id');
      if (playerId) measuredLayout.playerWidths[playerId] = (el as HTMLElement).offsetWidth;
    });

    template.columns.forEach(col => {
      const rowEl = document.getElementById(`row-${col.id}`) as HTMLElement;
      if (rowEl) measuredLayout.rowHeights[col.id] = rowEl.offsetHeight;
    });

    setUiState(p => ({
      ...p,
      editingCell: null,
      editingPlayerId: null,
      previewValue: 0,
      screenshotModal: { isOpen: true, mode, layout: measuredLayout }
    }));

  }, [setUiState, showToast, template.columns]);

  // Sync Scroll & Width Observers (same as before)
  React.useEffect(() => {
    const grid = sessionState.tableContainerRef.current;
    const bar = sessionState.totalBarScrollRef.current;
    if (!grid || !bar) return;
    const handleScroll = () => { if (bar.scrollLeft !== grid.scrollLeft) bar.scrollLeft = grid.scrollLeft; };
    grid.addEventListener('scroll', handleScroll, { passive: true });
    return () => grid.removeEventListener('scroll', handleScroll);
  }, [sessionState.tableContainerRef, sessionState.totalBarScrollRef]);

  React.useEffect(() => {
    const gridContent = sessionState.gridContentRef.current;
    const totalContent = sessionState.totalContentRef.current;
    if (!gridContent || !totalContent) return;
    const observer = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          if (entry.target === gridContent) {
            const gridWidth = gridContent.offsetWidth;
            const stickyHeader = document.querySelector('#live-player-header-row > div:first-child') as HTMLElement;
            const headerOffset = stickyHeader ? stickyHeader.offsetWidth : 70;
            const newTotalWidth = `${Math.max(0, gridWidth - headerOffset)}px`;
            if (totalContent.style.width !== newTotalWidth) totalContent.style.width = newTotalWidth;
          }
        }
      });
    });
    observer.observe(gridContent);
    return () => observer.disconnect();
  }, [sessionState.gridContentRef, sessionState.totalContentRef]);

  // [New] Check if we are in "Score Camera" mode (Single Shot)
  // This mode is triggered when galleryParams.mode is 'lightbox_overlay'
  const isScoreCameraMode = sessionState.uiState.galleryParams?.mode === 'lightbox_overlay';

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

      {/* Search Template Online Modal */}
      <SearchTemplateOnlineModal
        isOpen={isOnlineSearchOpen}
        onClose={() => setIsOnlineSearchOpen(false)}
        gameName={session.name || template.name}
        onDirectStart={() => setIsOnlineSearchOpen(false)}
        onAiClick={() => {
          setIsOnlineSearchOpen(false);
          setIsAiPromptOpen(true);
        }}
        onSelectTemplate={handleApplyTemplate}
      />

      {/* AI Simple Prompt Scan Modal (全新新建獨立極簡彈窗) */}
      <AiSimplePromptModal
        isOpen={isAiPromptOpen}
        onClose={() => setIsAiPromptOpen(false)}
        onDirectStart={() => setIsAiPromptOpen(false)}
        onAiSuccess={handleAiSuccess}
        gameName={session.name || template.name}
        aiSimpleGenerator={aiSimpleGenerator}
        onSwitchToAdvanced={(files) => {
          setAdvancedInitialFiles(files);
          setIsAiPromptOpen(false);
          // 🛡️ 延遲 200ms 開啟進階彈窗，結清前一個 modal 的非同步 history.back()，確保歷史紀錄堆疊 100% 穩定流暢
          setTimeout(() => {
            setIsAdvancedAiOpen(true);
          }, 200);
        }}
      />

      {/* AI Advanced Prompt Scan Modal (100% 原裝進階彈窗，不改動任何 props 屬性) */}
      <AiPromptModal
        isOpen={isAdvancedAiOpen}
        onClose={() => setIsAdvancedAiOpen(false)}
        onDirectStart={() => setIsAdvancedAiOpen(false)}
        onAiSuccess={handleAiSuccess}
        gameName={session.name || template.name}
        aiGenerator={aiGenerator}
        elapsedTime={elapsedTime}
        initialFiles={advancedInitialFiles}
        onInitialFilesConsumed={() => setAdvancedInitialFiles([])}
      />

      {/* Exit Modal */}
      <SessionExitModal
        isOpen={isSessionExitModalOpen}
        onClose={() => setUiState(p => ({ ...p, isSessionExitModalOpen: false }))}
        onSaveActive={(loc) => props.onExit(loc)} // Pass location back
        onSaveHistory={props.onSaveToHistory}
        onDiscard={props.onDiscard}
        savedLocations={props.savedLocations} // Updated Prop Name
        initialLocation={session.location} // Pass current session location
      />

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        isOpen={isPhotoGalleryOpen}
        onClose={() => setUiState(p => ({ ...p, isPhotoGalleryOpen: false }))}
        photoIds={session.photos || []}
        onUploadPhoto={media.openPhotoLibrary}
        onTakePhoto={media.openCamera} // Standard camera (from within gallery)
        onDeletePhoto={media.handleDeletePhoto}
        overlayData={overlayData} // Pass context for score overlay
        autoEnterMode={sessionState.uiState.galleryParams?.mode} // [New] Pass auto-open mode
      />

      {/* [New] General Camera Overlay */}
      {media.isCameraOpen && (
        <CameraView
          onCapture={media.handleCameraBatchCapture}
          onClose={() => media.closeCamera()}
          singleShot={isScoreCameraMode} // [FIXED] Pass dynamic singleShot prop
        />
      )}

      {/* Image Processing Flow (Scanner & Texture Mapper) */}
      <SessionImageFlow
        uiState={sessionState.uiState}
        setUiState={setUiState}
        template={template}
        baseImage={baseImage}
        onScannerConfirm={media.handleScannerConfirm}
        onUpdateTemplate={handleTemplateUpdate}
      />

      {/* Background Settings Modal */}
      <SessionBackgroundModal
        isOpen={isImageUploadModalOpen && !isScannerOpen && !isTextureMapperOpen}
        onClose={() => setUiState(p => ({ ...p, isImageUploadModalOpen: false }))}
        hasCloudImage={!!template.cloudImageId}
        isConnected={media.isConnected}
        onCloudDownload={media.handleCloudDownload}
        onScannerCamera={media.openScannerCamera}
        onUploadClick={media.openBackgroundUpload}
        onRemoveBackground={media.handleRemoveBackground}
        fileInputRef={media.fileInputRef}
        onFileChange={media.handleFileUpload}
      />

      {/* Game Settings Editor (New) */}
      <GameSettingsEditor
        isOpen={isGameSettingsOpen}
        template={template}
        onSave={eventHandlers.handleSaveGameSettings}
        onClose={() => setUiState(p => ({ ...p, isGameSettingsOpen: false }))}
      />

      {editingColumn && (
        <ColumnConfigEditor
          column={editingColumn}
          allColumns={template.columns}
          onSave={eventHandlers.handleSaveColumn}
          onDelete={async () => {
            if (await confirm({
              title: tSession('session_delete_col_title'),
              message: tSession('session_delete_col_msg'),
              confirmText: tCommon('delete'),
              isDangerous: true
            })) {
              const newCols = template.columns.filter(c => c.id !== editingColumn.id);
              void handleTemplateUpdate({ ...template, columns: newCols });
              setUiState(p => ({ ...p, editingColumn: null }));
            }
          }}
          onClose={() => setUiState(prev => ({ ...prev, editingColumn: null }))}
          baseImage={baseImage || undefined}
        />
      )}

      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        columns={template.columns}
        onClose={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: false }))}
        onAddBlank={eventHandlers.handleAddBlankColumn}
        onCopy={eventHandlers.handleCopyColumns}
      />

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
        canManageSession={capabilities.canManageSession}
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
        onAddColumn={() => {
          if (isAiWorking || !capabilities.canEditTemplate) return;
          setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }));
        }}
        onReset={async () => {
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
        }}
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
            if (capabilities.role === 'player' && !capabilities.playerIds?.includes(playerId)) {
              props.onRequestMultiplayerPlayerClaim?.(playerId);
              return;
            }
            if (!capabilities.canEditPlayers) return;
            eventHandlers.handlePlayerHeaderClick(playerId, event);
          }}
          canRequestPlayerClaim={capabilities.role === 'player'}
          onColumnHeaderClick={handleColumnHeaderClickSafe}
          onUpdateTemplate={capabilities.canEditTemplate ? handleTemplateUpdate : () => undefined}
          onAddColumn={capabilities.canEditTemplate ? eventHandlers.handleAddBlankColumn : () => undefined}
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
      />

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
