

import React, { useCallback, useRef, useMemo } from 'react';
import { GameSession, GameTemplate, SavedListItem } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useSessionMedia } from './hooks/useSessionMedia';
import { useToast } from '../../hooks/useToast';
import { useTranslation } from '../../i18n';
import { calculateWinners } from '../../utils/templateUtils'; // [Refactor]

// Parts
import SessionHeader from './parts/SessionHeader';
import ScoreGrid from './parts/ScoreGrid';
import TotalsBar from './parts/TotalsBar';
import InputPanel from './parts/InputPanel';
// Modals
import ScreenshotModal from './modals/ScreenshotModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import ColumnConfigEditor from '../shared/ColumnConfigEditor';
import AddColumnModal from './modals/AddColumnModal';
import SessionExitModal from './modals/SessionExitModal';
import PhotoGalleryModal from './modals/PhotoGalleryModal';
import SessionBackgroundModal from './modals/SessionBackgroundModal';
import SessionImageFlow from './SessionImageFlow'; 
import CameraView from '../scanner/CameraView'; 
import GameSettingsEditor from '../shared/GameSettingsEditor'; 

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
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateTemplate } = props;
  const { t } = useTranslation();

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
  
  const {
    editingCell,
    editingPlayerId,
    editingColumn,
    isEditingTitle,
    showResetConfirm,
    isSessionExitModalOpen,
    columnToDelete,
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
    isGeneralCameraOpen,
    isGameSettingsOpen // [New]
  } = sessionState.uiState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  
  // Winners Logic - [Refactor] Use shared util
  const rule = session.scoringRule || 'HIGHEST_WINS';
  const winners = calculateWinners(session.players, rule);
  
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
        showToast({ message: "無法測量佈局，截圖失敗。", type: 'error' });
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
        showShareMenu: false, 
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


  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden relative">
      {/* --- Modals --- */}
      <ConfirmationModal 
        isOpen={showResetConfirm} 
        title={t('session_reset_confirm_title')} 
        message={t('session_reset_confirm_msg')} 
        confirmText={t('reset')} 
        isDangerous={true} 
        onCancel={() => setUiState(prev => ({ ...prev, showResetConfirm: false }))} 
        onConfirm={eventHandlers.handleConfirmReset} 
      />
      <ConfirmationModal 
        isOpen={!!columnToDelete} 
        title={t('session_delete_col_title')} 
        message={t('session_delete_col_msg')} 
        confirmText={t('delete')} 
        isDangerous={true} 
        onCancel={() => setUiState(prev => ({ ...prev, columnToDelete: null }))} 
        onConfirm={eventHandlers.handleConfirmDeleteColumn} 
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
        onTakePhoto={media.openCamera} // This now triggers custom camera overlay
        onDeletePhoto={media.handleDeletePhoto}
        overlayData={overlayData} // Pass context for score overlay
      />

      {/* [New] General Camera Overlay */}
      {isGeneralCameraOpen && (
          <CameraView 
              onCapture={media.handleCameraBatchCapture}
              onClose={() => setUiState(p => ({ ...p, isGeneralCameraOpen: false }))}
              singleShot={false} // Enable multi-shot mode
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
      {isGameSettingsOpen && (
          <GameSettingsEditor 
              template={template}
              onSave={eventHandlers.handleSaveGameSettings}
              onClose={() => setUiState(p => ({ ...p, isGameSettingsOpen: false }))}
          />
      )}

      {editingColumn && (
        <ColumnConfigEditor 
          column={editingColumn} 
          allColumns={template.columns} 
          onSave={eventHandlers.handleSaveColumn} 
          onDelete={() => {
              setUiState(prev => ({ ...prev, columnToDelete: editingColumn.id }));
          }} 
          onClose={() => setUiState(prev => ({...prev, editingColumn: null}))}
          baseImage={baseImage || undefined} 
        />
      )}

      {isAddColumnModalOpen && (
        <AddColumnModal 
          columns={template.columns}
          onClose={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: false }))}
          onAddBlank={eventHandlers.handleAddBlankColumn}
          onCopy={eventHandlers.handleCopyColumns}
        />
      )}

      {/* Hidden inputs for photos */}
      <input ref={media.photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={media.handlePhotoSelect} />
      <input ref={media.galleryInputRef} type="file" accept="image/*" className="hidden" onChange={media.handlePhotoSelect} />

      {/* --- Main UI --- */}
      <SessionHeader
        templateName={session.name || template.name} // [Identity Upgrade] Use Session Name if available
        isEditingTitle={isEditingTitle}
        showShareMenu={showShareMenu}
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
        onAddColumn={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }))}
        onReset={() => setUiState(prev => ({ ...prev, showResetConfirm: true }))}
        onExit={() => {
            window.dispatchEvent(new CustomEvent('app-back-press'));
        }}
        onShareMenuToggle={(show) => setUiState(prev => ({...prev, showShareMenu: show}))}
        onScreenshotRequest={handleScreenshotRequest}
        onToggleEditMode={() => setUiState(prev => ({ ...prev, isEditMode: !prev.isEditMode }))}
        onUploadImage={() => setUiState(p => ({ ...p, isImageUploadModalOpen: true, showShareMenu: false }))} 
        onCloudDownload={media.handleCloudDownload} 
        onOpenGallery={() => setUiState(p => ({ ...p, isPhotoGalleryOpen: true, showShareMenu: false }))}
        onTakePhoto={media.openCamera} // Direct call via media hook (sets both flags)
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
          onCellClick={eventHandlers.handleCellClick}
          onPlayerHeaderClick={eventHandlers.handlePlayerHeaderClick}
          onColumnHeaderClick={eventHandlers.handleColumnHeaderClick}
          onUpdateTemplate={onUpdateTemplate}
          onAddColumn={eventHandlers.handleAddBlankColumn} // Pass the handler
          onOpenSettings={eventHandlers.handleOpenGameSettings} // [New] Pass handler
          scrollContainerRef={sessionState.tableContainerRef}
          contentRef={sessionState.gridContentRef}
          baseImage={baseImage || undefined} 
          isEditMode={isEditMode}
          zoomLevel={zoomLevel}
          previewValue={previewValue}
        />
      </div>

      <TotalsBar
        players={session.players}
        winners={winners}
        isPanelOpen={isPanelOpen}
        panelHeight={sessionState.panelHeight}
        scrollRef={sessionState.totalBarScrollRef}
        contentRef={sessionState.totalContentRef}
        isHidden={isInputFocused}
        template={template}
        baseImage={baseImage || undefined} 
        editingCell={editingCell}
        previewValue={previewValue}
        onTotalClick={(playerId) => eventHandlers.handleCellClick(playerId, '__TOTAL__', { stopPropagation: () => {} } as any)}
        zoomLevel={zoomLevel} 
      />

      <InputPanel
        sessionState={sessionState}
        eventHandlers={eventHandlers}
        session={session}
        template={template}
        savedPlayers={props.savedPlayers} // Updated Prop Name
        onUpdateSession={props.onUpdateSession}
        onUpdateSavedPlayer={props.onUpdateSavedPlayer} // Updated Prop Name
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