import React from 'react';
import type { GameSession, GameTemplate } from '../../../types';
import type { SessionViewProps } from '../sessionViewTypes';
import type { useSessionState } from '../hooks/useSessionState';
import type { useSessionEvents } from '../hooks/useSessionEvents';
import type { useSessionMedia } from '../hooks/useSessionMedia';
import type { useSessionTemplateApplication } from '../hooks/useSessionTemplateApplication';
import type { useAiGenerator } from '../../../features/ai-generator/hooks/useAiGenerator';
import type { useAiSimpleGenerator } from '../../../features/ai-generator/hooks/useAiSimpleGenerator';
import type { useConfirm } from '../../../hooks/useConfirm';
import type { useSessionTranslation } from '../../../i18n/session';
import type { useCommonTranslation } from '../../../i18n/common';
import ColumnConfigEditor from '../../shared/ColumnConfigEditor';
import AddColumnModal from '../modals/AddColumnModal';
import SessionExitModal from '../modals/SessionExitModal';
import PhotoGalleryModal from '../modals/PhotoGalleryModal';
import SessionBackgroundModal from '../modals/SessionBackgroundModal';
import SessionImageFlow from '../SessionImageFlow';
import CameraView from '../../scanner/CameraView';
import GameSettingsEditor from '../../shared/GameSettingsEditor';
import SearchTemplateOnlineModal from '../../dashboard/modals/SearchTemplateOnlineModal';
import AiPromptModal from '../../../features/ai-generator/components/AiPromptModal';
import AiSimplePromptModal from '../../../features/ai-generator/components/AiSimplePromptModal';

interface SessionDialogViewOptions {
  props: SessionViewProps;
  session: GameSession;
  template: GameTemplate;
  baseImage: string | null;
  sessionState: ReturnType<typeof useSessionState>;
  setUiState: ReturnType<typeof useSessionState>['setUiState'];
  eventHandlers: ReturnType<typeof useSessionEvents>;
  media: ReturnType<typeof useSessionMedia>;
  isOnlineSearchOpen: boolean;
  setIsOnlineSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiPromptOpen: boolean;
  setIsAiPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAdvancedAiOpen: boolean;
  setIsAdvancedAiOpen: React.Dispatch<React.SetStateAction<boolean>>;
  advancedInitialFiles: File[];
  setAdvancedInitialFiles: React.Dispatch<React.SetStateAction<File[]>>;
  aiSimpleGenerator: ReturnType<typeof useAiSimpleGenerator>;
  aiGenerator: ReturnType<typeof useAiGenerator>;
  elapsedTime: number;
  handleApplyTemplate: ReturnType<typeof useSessionTemplateApplication>['handleApplyTemplate'];
  handleAiSuccess: ReturnType<typeof useSessionTemplateApplication>['handleAiSuccess'];
  handleTemplateUpdate: SessionViewProps['onUpdateTemplate'];
  overlayData: React.ComponentProps<typeof PhotoGalleryModal>['overlayData'];
  confirm: ReturnType<typeof useConfirm>['confirm'];
  tSession: ReturnType<typeof useSessionTranslation>['t'];
  tCommon: ReturnType<typeof useCommonTranslation>['t'];
}

/** Return individual slots to keep dialogs in their original reconciliation positions. */
export function buildSessionDialogViews({
  props, session, template, baseImage, sessionState, setUiState, eventHandlers, media, isOnlineSearchOpen,
  setIsOnlineSearchOpen, isAiPromptOpen, setIsAiPromptOpen, isAdvancedAiOpen, setIsAdvancedAiOpen,
  advancedInitialFiles, setAdvancedInitialFiles, aiSimpleGenerator, aiGenerator, elapsedTime,
  handleApplyTemplate, handleAiSuccess, handleTemplateUpdate, overlayData, confirm, tSession, tCommon
}: SessionDialogViewOptions) {
  const {
    isSessionExitModalOpen, isPhotoGalleryOpen, isImageUploadModalOpen,
    isScannerOpen, isTextureMapperOpen, isGameSettingsOpen, editingColumn, isAddColumnModalOpen
  } = sessionState.uiState;
  const isScoreCameraMode = sessionState.uiState.galleryParams?.mode === 'lightbox_overlay';
  return {
    onlineSearch: (
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
    ),
    simpleAiPrompt: (
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
    ),
    advancedAiPrompt: (
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
    ),
    exit: (
      <SessionExitModal
        isOpen={isSessionExitModalOpen}
        onClose={() => setUiState(p => ({ ...p, isSessionExitModalOpen: false }))}
        onSaveActive={(loc) => props.onExit(loc)} // Pass location back
        onSaveHistory={props.onSaveToHistory}
        onDiscard={props.onDiscard}
        savedLocations={props.savedLocations} // Updated Prop Name
        initialLocation={session.location} // Pass current session location
        gameName={session.name}
        bggId={session.bggId}
        playerCount={session.players.length}
      />
    ),
    photoGallery: (
      <PhotoGalleryModal
        isOpen={isPhotoGalleryOpen}
        onClose={() => setUiState(p => ({ ...p, isPhotoGalleryOpen: false, galleryParams: { mode: 'default' } }))}
        photoIds={session.photos || []}
        photoContentIds={session.photoContentIds}
        onUploadPhoto={media.openPhotoLibrary}
        onTakePhoto={media.openCamera} // Standard camera (from within gallery)
        onDeletePhoto={media.handleDeletePhoto}
        onRotatePhoto={media.handleRotatePhoto}
        overlayData={overlayData} // Pass context for score overlay
        autoEnterMode={sessionState.uiState.galleryParams?.mode} // [New] Pass auto-open mode
        initialPhotoId={sessionState.uiState.galleryParams?.initialPhotoId}
        entryMode={sessionState.uiState.galleryParams?.entryMode ?? 'gallery'}
      />
    ),
    camera: (
      media.isCameraOpen && (
        <CameraView
          onCapture={media.handleCameraBatchCapture}
          onClose={() => media.closeCamera()}
          singleShot={isScoreCameraMode} // [FIXED] Pass dynamic singleShot prop
        />
      )
    ),
    imageFlow: (
      <SessionImageFlow
        uiState={sessionState.uiState}
        setUiState={setUiState}
        template={template}
        baseImage={baseImage}
        onScannerConfirm={media.handleScannerConfirm}
        onUpdateTemplate={handleTemplateUpdate}
      />
    ),
    background: (
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
    ),
    gameSettings: (
      <GameSettingsEditor
        isOpen={isGameSettingsOpen}
        template={template}
        onSave={eventHandlers.handleSaveGameSettings}
        onClose={() => setUiState(p => ({ ...p, isGameSettingsOpen: false }))}
      />
    ),
    columnEditor: (
      editingColumn && (
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
      )
    ),
    addColumn: (
      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        columns={template.columns}
        onClose={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: false }))}
        onAddBlank={eventHandlers.handleAddBlankColumn}
        onCopy={eventHandlers.handleCopyColumns}
      />
    ),
  };
}
