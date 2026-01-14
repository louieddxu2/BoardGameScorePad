
import React, { useCallback, useRef, useMemo } from 'react';
import { GameSession, GameTemplate } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useSessionMedia } from './hooks/useSessionMedia';
import { useToast } from '../../hooks/useToast';
import { Upload, X, Image as ImageIcon, DownloadCloud, Camera, Save, ScanLine, Aperture, Trash2 } from 'lucide-react';

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
import PhotoScanner from '../scanner/PhotoScanner';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  zoomLevel: number;
  baseImage: string | null; 
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onUpdateImage: (img: string | Blob | null) => void; 
  onExit: () => void;
  onResetScores: () => void;
  onSaveToHistory: () => void;
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateTemplate } = props;

  const sessionState = useSessionState(props);
  const { setUiState } = sessionState;

  // No special local state needed for photo preview anymore
  const eventHandlers = useSessionEvents(props, sessionState);
  
  // [Refactor] Media Logic extracted to Hook
  const media = useSessionMedia({
      session,
      template,
      baseImage,
      onUpdateSession: props.onUpdateSession,
      onUpdateTemplate: props.onUpdateTemplate,
      onUpdateImage: props.onUpdateImage,
      setUiState,
      isEditMode: sessionState.uiState.isEditMode // Pass isEditMode state
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
    scannerInitialImage,
    scannerFixedRatio // [New]
  } = sessionState.uiState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  
  // Winners Logic
  const rule = session.scoringRule || 'HIGHEST_WINS';
  let winners: string[] = [];
  const validPlayers = session.players.filter(p => !p.isForceLost);
  
  if (validPlayers.length > 0) {
      let targetScore: number;
      if (rule === 'HIGHEST_WINS') {
          targetScore = Math.max(...validPlayers.map(pl => pl.totalScore));
      } else if (rule === 'LOWEST_WINS') {
          targetScore = Math.min(...validPlayers.map(pl => pl.totalScore));
      } else {
          targetScore = Math.max(...validPlayers.map(pl => pl.totalScore));
      }
      const candidates = validPlayers.filter(p => p.totalScore === targetScore);
      const hasTieBreaker = candidates.some(p => p.tieBreaker);
      if (hasTieBreaker) {
          winners = candidates.filter(p => p.tieBreaker).map(p => p.id);
      } else {
          winners = candidates.map(p => p.id);
      }
  }
  
  // Prepare Overlay Data for Photo Gallery
  const overlayData = useMemo(() => ({
      gameName: template.name,
      date: session.startTime,
      players: session.players,
      winners: winners
  }), [template.name, session.startTime, session.players, winners]);
  
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
      <ConfirmationModal isOpen={showResetConfirm} title="確定重置？" message="此動作將清空所有已輸入的分數，且無法復原。" confirmText="確定重置" isDangerous={true} onCancel={() => setUiState(prev => ({ ...prev, showResetConfirm: false }))} onConfirm={eventHandlers.handleConfirmReset} />
      <ConfirmationModal isOpen={!!columnToDelete} title="確定刪除此項目？" message="刪除後，所有玩家在該項目的分數將會遺失。" confirmText="確定刪除" isDangerous={true} onCancel={() => setUiState(prev => ({ ...prev, columnToDelete: null }))} onConfirm={eventHandlers.handleConfirmDeleteColumn} />
      
      {/* Exit Modal */}
      <SessionExitModal 
        isOpen={isSessionExitModalOpen}
        onClose={() => setUiState(p => ({ ...p, isSessionExitModalOpen: false }))}
        onSaveActive={props.onExit}
        onSaveHistory={props.onSaveToHistory}
      />

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal 
        isOpen={isPhotoGalleryOpen}
        onClose={() => setUiState(p => ({ ...p, isPhotoGalleryOpen: false }))}
        photoIds={session.photos || []}
        onUploadPhoto={media.openPhotoLibrary}
        onTakePhoto={media.openCamera}
        onDeletePhoto={media.handleDeletePhoto}
        overlayData={overlayData} // Pass context for score overlay
      />

      {/* Scanner Overlay */}
      {isScannerOpen && (
          <PhotoScanner 
              onClose={() => setUiState(p => ({ ...p, isScannerOpen: false, scannerInitialImage: null }))} 
              onConfirm={media.handleScannerConfirm}
              initialImage={scannerInitialImage || undefined}
              fixedAspectRatio={scannerFixedRatio} // [New] Pass ratio constraint
          />
      )}

      {/* Missing Image Modal */}
      {isImageUploadModalOpen && !isScannerOpen && (
          <div 
            className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            onClick={() => setUiState(p => ({ ...p, isImageUploadModalOpen: false }))}
          >
              <div 
                className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
                onClick={(e) => e.stopPropagation()} 
              >
                  <button 
                    onClick={() => setUiState(p => ({ ...p, isImageUploadModalOpen: false }))}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <div className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                      <ScanLine size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white">設定計分紙背景</h3>
                  <p className="text-sm text-slate-400">
                      此模板已包含框線設定。
                      {template.cloudImageId ? "您可以從雲端還原背景，或重新拍攝。" : "請拍攝或上傳計分紙照片。"}
                  </p>
                  
                  {template.cloudImageId && (
                      <button 
                        onClick={media.handleCloudDownload} 
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2"
                      >
                          <DownloadCloud size={20} /> 
                          {media.isConnected ? "從雲端下載" : "連線並下載"}
                      </button>
                  )}

                  <button onClick={media.openScannerCamera} className={`w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${template.cloudImageId ? 'mt-1' : 'mt-2'}`}>
                      <Aperture size={20} /> 拍攝新照片
                  </button>

                  <button onClick={media.openBackgroundUpload} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2">
                      <Upload size={20} /> 從相簿上傳
                  </button>
                  <input ref={media.fileInputRef} type="file" accept="image/*" className="hidden" onChange={media.handleFileUpload} />
                  
                  <button onClick={media.handleRemoveBackground} className="flex items-center gap-2 text-slate-500 text-xs hover:text-red-400 mt-4 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                      <Trash2 size={14} /> 移除計分紙返回標準介面
                  </button>
              </div>
          </div>
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
        templateName={template.name}
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
        playerHistory={props.playerHistory}
        onUpdateSession={props.onUpdateSession}
        onUpdatePlayerHistory={props.onUpdatePlayerHistory}
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
