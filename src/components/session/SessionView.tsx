
import React, { useCallback, useRef, useMemo } from 'react';
import { GameSession, GameTemplate, SavedListItem } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useSessionMedia } from './hooks/useSessionMedia';
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
import { db } from '../../db';
import { useAiGenerator } from '../../features/ai-generator/hooks/useAiGenerator';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  savedPlayers: SavedListItem[]; // Renamed from playerHistory
  savedLocations?: SavedListItem[]; // Renamed from locationHistory
  zoomLevel: number;
  baseImage: string | null;
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdateSavedPlayer: (name: string) => void; // Renamed from onUpdatePlayerHistory
  onUpdateImage: (img: string | Blob | null) => void;
  onExit: (location?: string) => void;
  onResetScores: () => void;
  onSaveToHistory: (location?: string) => void;
  onDiscard: () => void;
  isVoiceEnabled?: boolean;
  onToggleVoice?: () => void;
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateTemplate } = props;
  const { t: tSession } = useSessionTranslation();
  const { t: tCommon } = useCommonTranslation();

  const [isOnlineSearchOpen, setIsOnlineSearchOpen] = React.useState(false);
  const [isAiPromptOpen, setIsAiPromptOpen] = React.useState(false);

  // 狀態提升：全域 AI 生成器
  const aiGenerator = useAiGenerator();
  const [elapsedTime, setElapsedTime] = React.useState<number>(0);

  // 全域同步計時器
  React.useEffect(() => {
    let interval: any;
    if (aiGenerator.status === 'generating') {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [aiGenerator.status]);

  const sessionState = useSessionState(props);
  const { setUiState } = sessionState;

  // No special local state needed for photo preview anymore
  const eventHandlers = useSessionEvents(props, sessionState);

  // Media Logic
  const media = useSessionMedia({
    session,
    template,
    baseImage,
    onUpdateSession: props.onUpdateSession,
    onUpdateTemplate: props.onUpdateTemplate,
    onUpdateImage: props.onUpdateImage,
    setUiState,
    isEditMode: sessionState.uiState.isEditMode
  });

  const { showToast } = useToast();
  const { confirm } = useConfirm();

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
    isGameSettingsOpen // [New]
  } = sessionState.uiState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;

  // Winners Logic - Use pre-calculated winners from session to stabilize references
  const winners = useMemo(() => session.winnerIds || [], [session.winnerIds]);



  // 安全套用社群範本 (重置分數格，更新 columns，安全原地刷新)
  const handleApplyTemplate = useCallback((fetched: any) => {
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
    props.onUpdateTemplate(updatedTemplate);
    props.onUpdateSession(updatedSession);

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
  }, [session, template, props.onUpdateTemplate, props.onUpdateSession, showToast, tSession]);

  // 安全套用 AI 產生之範本
  const handleAiSuccess = useCallback((result: Partial<GameTemplate>) => {
    if (!result.columns || result.columns.length === 0) return;

    // 1. 複製玩家並清空所有輸入分數 (原地清空)
    const newPlayers = session.players.map(p => ({
      ...p,
      scores: {}
    }));

    // 2. 原地覆寫模板欄位 (並標記 isAiGenerated: true)
    const updatedTemplate: GameTemplate = {
      ...template,
      columns: result.columns,
      defaultScoringRule: result.defaultScoringRule || template.defaultScoringRule,
      updatedAt: Date.now(),
      isAiGenerated: true // 標記為 AI 生成，待儲存回到 Dashboard 時詢問分享！
    };

    // 3. 重新建立會話物件，並重設 winners
    const updatedSession: GameSession = {
      ...session,
      players: newPlayers,
      winnerIds: [],
      scoringRule: updatedTemplate.defaultScoringRule,
    };

    // 4. 原地驅動 React 狀態更新
    props.onUpdateTemplate(updatedTemplate);
    props.onUpdateSession(updatedSession);

    // 5. 關閉彈窗與拍照介面，彈出提示 (移除背景自動上傳，改至離開 Dashboard 時詢問)
    setIsAiPromptOpen(false);
    setIsOnlineSearchOpen(false);
    showToast({ message: tSession('toast_ai_apply_success'), type: 'success' });
  }, [session, template, props.onUpdateTemplate, props.onUpdateSession, showToast, tSession]);

  // 背景 AI 智慧建立成功/失敗監聽：嚴格隔離情況 A（背景自動套用）與情況 B（前台手動確認）
  React.useEffect(() => {
    if (aiGenerator.status === 'success') {
      if (!isAiPromptOpen && aiGenerator.generatedResult) {
        handleAiSuccess(aiGenerator.generatedResult.template);
        aiGenerator.reset();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiGenerator.status, aiGenerator.generatedResult, handleAiSuccess, aiGenerator.reset]);

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
    return () => {
      if (aiStatusRef.current === 'compressing' || aiStatusRef.current === 'generating') {
        showToast({ message: tSession('toast_ai_generation_interrupted') || '🔮 AI scoreboard generation aborted.', type: 'info' });
        currentReset();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellClickSafe = useCallback((playerId: string, colId: string, e: React.MouseEvent) => {
    if (aiGenerator.status === 'compressing' || aiGenerator.status === 'generating') {
      return;
    }
    eventHandlers.handleCellClick(playerId, colId, e);
  }, [aiGenerator.status, eventHandlers.handleCellClick]);

  const handleColumnHeaderClickSafe = useCallback((e: React.MouseEvent, col: any) => {
    if (aiGenerator.status === 'compressing' || aiGenerator.status === 'generating') {
      return;
    }
    eventHandlers.handleColumnHeaderClick(e, col);
  }, [aiGenerator.status, eventHandlers.handleColumnHeaderClick]);

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
    <div className="flex flex-col h-full bg-app-bg text-txt-primary overflow-hidden relative">
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

      {/* AI Prompt Scan Modal */}
      <AiPromptModal
        isOpen={isAiPromptOpen}
        onClose={() => setIsAiPromptOpen(false)}
        onDirectStart={() => setIsAiPromptOpen(false)}
        onAiSuccess={handleAiSuccess}
        gameName={session.name || template.name}
        aiGenerator={aiGenerator}
        elapsedTime={elapsedTime}
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
        onUpdateTemplate={onUpdateTemplate}
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
              onUpdateTemplate({ ...template, columns: newCols });
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
        isEditMode={isEditMode}
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
          if (aiGenerator.status === 'compressing' || aiGenerator.status === 'generating') return;
          setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }));
        }}
        onReset={async () => {
          if (aiGenerator.status === 'compressing' || aiGenerator.status === 'generating') return;
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
        onShareMenuToggle={(show) => setUiState(prev => ({ ...prev, showShareMenu: show }))}
        onScreenshotRequest={handleScreenshotRequest}
        onToggleEditMode={() => setUiState(prev => ({ ...prev, isEditMode: !prev.isEditMode }))}
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
              setUiState(p => ({ ...p, isInputFocused: false }));
            }}
          />
        )}

        <ScoreGrid
          session={session}
          template={template}
          editingCell={editingCell}
          editingPlayerId={editingPlayerId}
          onCellClick={handleCellClickSafe}
          onPlayerHeaderClick={eventHandlers.handlePlayerHeaderClick}
          onColumnHeaderClick={handleColumnHeaderClickSafe}
          onUpdateTemplate={onUpdateTemplate}
          onAddColumn={eventHandlers.handleAddBlankColumn} // Pass the handler
          onOpenSettings={eventHandlers.handleOpenGameSettings} // [New] Pass handler
          onToggleToolbox={eventHandlers.handleToggleToolbox} // [New Step 2]
          isToolboxOpen={sessionState.uiState.isToolboxOpen} // [New Step 2]
          scrollContainerRef={sessionState.tableContainerRef}
          contentRef={sessionState.gridContentRef}
          baseImage={baseImage || undefined}
          isEditMode={isEditMode}
          zoomLevel={zoomLevel}
          previewValue={previewValue}
          onOpenOnlineSearch={() => setIsOnlineSearchOpen(true)}
          onOpenAiPrompt={() => setIsAiPromptOpen(true)}
          aiStatus={aiGenerator.status}
          elapsedTime={elapsedTime}
        />
      </div>

      <div className={(aiGenerator.status === 'compressing' || aiGenerator.status === 'generating') ? "pointer-events-none opacity-50 select-none filter grayscale-[20%] transition-all duration-300" : ""}>
        <TotalsBar
          players={session.players}
          winners={winners}
          isPanelOpen={isPanelOpen}
          panelHeight={sessionState.panelHeight}
          scrollRef={sessionState.totalBarScrollRef}
          contentRef={sessionState.totalContentRef}
          isHidden={isInputFocused || isEditingTitle} // [Modified] Also hide when editing title
          template={template}
          baseImage={baseImage || undefined}
          editingCell={editingCell}
          previewValue={previewValue}
          onTotalClick={(playerId) => {
            if (aiGenerator.status === 'compressing' || aiGenerator.status === 'generating') return;
            eventHandlers.handleCellClick(playerId, '__TOTAL__', { stopPropagation: () => { } } as any);
          }}
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
        onUpdateSession={props.onUpdateSession}
        onUpdateSavedPlayer={props.onUpdateSavedPlayer} // Updated Prop Name
        onTakePhoto={media.openScoreCamera} // [FIXED] Use special mode for toolbox camera
        onScreenshotRequest={handleScreenshotRequest} // [New] Pass screenshot action
        isVoiceEnabled={props.isVoiceEnabled}
        onToggleVoice={props.onToggleVoice}
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
