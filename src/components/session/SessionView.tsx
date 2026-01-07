
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { GameSession, GameTemplate } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useToast } from '../../hooks/useToast';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { googleDriveService } from '../../services/googleDrive';
import { imageService } from '../../services/imageService'; 
import { compressAndResizeImage } from '../../utils/imageProcessing'; 
import { Upload, X, Image as ImageIcon, DownloadCloud, Camera, Check, Loader2, UploadCloud, Save } from 'lucide-react';

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

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  zoomLevel: number;
  baseImage: string | null; 
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onUpdateImage: (img: string | Blob) => void; 
  onExit: () => void;
  onResetScores: () => void;
  onSaveToHistory: () => void;
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateImage, onUpdateTemplate } = props;

  const sessionState = useSessionState(props);
  const eventHandlers = useSessionEvents(props, sessionState);
  const { showToast } = useToast();
  const { downloadCloudImage, isAutoConnectEnabled, isConnected, connectToCloud } = useGoogleDrive();
  
  const fileInputRef = useRef<HTMLInputElement>(null); // For background image
  const photoInputRef = useRef<HTMLInputElement>(null); // For Camera (capture=environment)
  const galleryInputRef = useRef<HTMLInputElement>(null); // For Upload (no capture)
  
  // Modal State
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [showSessionExitModal, setShowSessionExitModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  
  // Photo Upload State - Now stores Blob URL for preview
  const [previewPhotoBlob, setPreviewPhotoBlob] = useState<Blob | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false); 

  const hasPromptedRef = useRef(false);

  // Clean up preview URL when modal closes or changes
  useEffect(() => {
      return () => {
          if (previewPhotoUrl) URL.revokeObjectURL(previewPhotoUrl);
      };
  }, [previewPhotoUrl]);

  // [Offline-First Logic] Background Image Loader
  useEffect(() => {
      // 1. If we already have a baseImage (loaded from Local DB by useAppData), we are good.
      if (baseImage) return;

      const hasBackgroundDesign = !!template.globalVisuals || !!template.hasImage;
      if (!hasBackgroundDesign) return;
      
      // Prevent double prompting
      if (hasPromptedRef.current) return;
      hasPromptedRef.current = true;

      // 2. If no local image, check Cloud Link
      const checkCloud = async () => {
          if (template.cloudImageId) {
              // 2a. If Auto-Connect is ON and Authorized -> Try silent download
              if (isAutoConnectEnabled && googleDriveService.isAuthorized) {
                  // downloadCloudImage now returns Blob (or null)
                  const imgBlob = await downloadCloudImage(template.cloudImageId);
                  if (imgBlob) {
                      onUpdateImage(imgBlob); // This will save to Local DB automatically via useAppData
                      return;
                  }
              }
              // 2b. If not connected OR download failed -> Prompt User
              setShowImageUploadModal(true);
          } else {
              // 3. No Cloud Link -> Prompt User (Upload / Photo)
              setShowImageUploadModal(true);
          }
      };
      
      checkCloud();
  }, [baseImage, template.globalVisuals, template.hasImage, template.cloudImageId, downloadCloudImage, isAutoConnectEnabled, onUpdateImage]);

  const {
    editingCell,
    editingPlayerId,
    editingColumn,
    isEditingTitle,
    showResetConfirm,
    showExitConfirm, 
    columnToDelete,
    isAddColumnModalOpen,
    showShareMenu,
    screenshotModal,
    isInputFocused,
    isEditMode, 
    previewValue,
  } = sessionState.uiState;

  const { setUiState } = sessionState;

  // Intercept exit logic
  useEffect(() => {
      if (showExitConfirm) {
          setUiState(prev => ({ ...prev, showExitConfirm: false }));
          
          const hasScores = session.players.some(p => Object.keys(p.scores).length > 0);
          if (hasScores) {
              setShowSessionExitModal(true);
          } else {
              props.onExit();
          }
      }
  }, [showExitConfirm, session.players, props.onExit, setUiState]);

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  
  // Winners Logic - Updated for Force Loss and Tie Breaker
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
          // COOP or NO_SCORE modes typically don't have single winners, 
          // but if we treat them as highest wins for now:
          targetScore = Math.max(...validPlayers.map(pl => pl.totalScore));
      }

      // 1. Find all players with the target score
      const candidates = validPlayers.filter(p => p.totalScore === targetScore);
      
      // 2. Check for Tie Breaker
      const hasTieBreaker = candidates.some(p => p.tieBreaker);
      
      if (hasTieBreaker) {
          // Only players with tieBreaker flag win
          winners = candidates.filter(p => p.tieBreaker).map(p => p.id);
      } else {
          // All candidates win (Shared Victory)
          winners = candidates.map(p => p.id);
      }
  }
  
  // Handle Background Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Use Blob flow directly
      const objectUrl = URL.createObjectURL(file);
      
      compressAndResizeImage(objectUrl, 1, 1920)
        .then(compressedBlob => {
            // Pass Blob to hook -> saves to DB
            onUpdateImage(compressedBlob); 
            setShowImageUploadModal(false);
            URL.revokeObjectURL(objectUrl);
        })
        .catch(err => {
            console.error("Compression failed", err);
            showToast({ message: "圖片處理失敗", type: 'error' });
            URL.revokeObjectURL(objectUrl);
        });
    }
  };

  // Handle Photo Taking OR Gallery Selection (Session Documentation)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const objectUrl = URL.createObjectURL(file);
          
          compressAndResizeImage(objectUrl, 1, 1920)
            .then(compressedBlob => {
                setPreviewPhotoBlob(compressedBlob);
                setPreviewPhotoUrl(URL.createObjectURL(compressedBlob));
                setUiState(prev => ({ ...prev, showShareMenu: false }));
                // Temporarily hide gallery if open, so user sees confirm modal clearly
                if (showPhotoGallery) setShowPhotoGallery(false);
                URL.revokeObjectURL(objectUrl);
            })
            .catch(err => {
                console.error("Compression failed", err);
                showToast({ message: "圖片處理失敗", type: 'error' });
                URL.revokeObjectURL(objectUrl);
            });
      }
      e.target.value = '';
  };

  const handleConfirmSavePhoto = async () => {
      if (!previewPhotoBlob) return;
      
      setIsSavingPhoto(true);
      try {
          // Save to Local DB directly using Blob
          const savedImg = await imageService.saveImage(previewPhotoBlob, session.id, 'session');
          
          // Update Session State with Local Image ID
          const currentPhotos = session.photos || [];
          const updatedSession = { 
              ...session, 
              photos: [...currentPhotos, savedImg.id] 
          };
          props.onUpdateSession(updatedSession);

          showToast({ message: "照片已儲存至本機", type: 'success' });
          setPreviewPhotoBlob(null);
          setPreviewPhotoUrl(null);
          
          // Re-open gallery to show new photo
          setShowPhotoGallery(true);
      } catch (e) {
          console.error("Photo save failed:", e);
          showToast({ message: "儲存失敗，請重試", type: 'error' });
      } finally {
          setIsSavingPhoto(false);
      }
  };

  const handleDeletePhoto = async (id: string) => {
      try {
          await imageService.deleteImage(id);
          const currentPhotos = session.photos || [];
          const updatedSession = { 
              ...session, 
              photos: currentPhotos.filter(pid => pid !== id) 
          };
          props.onUpdateSession(updatedSession);
          showToast({ message: "照片已刪除", type: 'info' });
      } catch (e) {
          console.error("Delete failed", e);
          showToast({ message: "刪除失敗", type: 'error' });
      }
  };

  const handleSkipImage = () => {
      setShowImageUploadModal(false);
  };
  
  const handleManualUploadClick = () => {
      setShowImageUploadModal(true);
      setUiState(prev => ({ ...prev, showShareMenu: false }));
  };

  const handleOpenGallery = () => {
      setShowPhotoGallery(true);
      setUiState(prev => ({ ...prev, showShareMenu: false }));
  };

  // [Interactive] Manual Cloud Download Trigger
  const handleModalCloudDownload = async () => {
      if (!template.cloudImageId) return;

      // 1. Ensure Connection
      if (!isConnected) {
          const success = await connectToCloud();
          if (!success) return; 
      }

      // 2. Download
      const imgBlob = await downloadCloudImage(template.cloudImageId);
      if (imgBlob) {
          onUpdateImage(imgBlob); // Saves to local DB
          setShowImageUploadModal(false);
      }
  };

  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
    const playerHeaderRowEl = document.querySelector('#live-player-header-row') as HTMLElement;
    const itemHeaderEl = playerHeaderRowEl?.querySelector('div:first-child') as HTMLElement;
    const playerHeaderEls = playerHeaderRowEl?.querySelectorAll('[data-player-header-id]');
    
    if (!playerHeaderRowEl || !itemHeaderEl || !playerHeaderEls || playerHeaderEls.length === 0) {
        showToast({ message: "無法測量佈局，截圖失敗。", type: 'error' });
        return;
    }

    const measuredLayout: ScreenshotLayout = {
        itemWidth: itemHeaderEl.offsetWidth,
        playerWidths: {},
        playerHeaderHeight: playerHeaderRowEl.offsetHeight,
        rowHeights: {},
    };

    playerHeaderEls.forEach(el => {
        const playerId = el.getAttribute('data-player-header-id');
        if (playerId) {
            measuredLayout.playerWidths[playerId] = (el as HTMLElement).offsetWidth;
        }
    });
    
    template.columns.forEach(col => {
      const rowEl = document.getElementById(`row-${col.id}`) as HTMLElement;
      if (rowEl) {
        measuredLayout.rowHeights[col.id] = rowEl.offsetHeight;
      }
    });

    setUiState(p => ({ 
        ...p, 
        showShareMenu: false, 
        editingCell: null,
        editingPlayerId: null,
        previewValue: 0,
        screenshotModal: { 
            isOpen: true, 
            mode, 
            layout: measuredLayout 
        } 
    }));

  }, [setUiState, showToast, template.columns]);

  useEffect(() => {
    const grid = sessionState.tableContainerRef.current;
    const bar = sessionState.totalBarScrollRef.current;
    if (!grid || !bar) return;
    const handleScroll = () => {
      if (bar.scrollLeft !== grid.scrollLeft) {
          bar.scrollLeft = grid.scrollLeft;
      }
    };
    grid.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      grid.removeEventListener('scroll', handleScroll);
    };
  }, [sessionState.tableContainerRef, sessionState.totalBarScrollRef]);

  useEffect(() => {
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
             if (totalContent.style.width !== newTotalWidth) {
                 totalContent.style.width = newTotalWidth;
             }
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
      
      {/* New Exit Modal */}
      <SessionExitModal 
        isOpen={showSessionExitModal}
        onClose={() => setShowSessionExitModal(false)}
        onSaveActive={props.onExit}
        onSaveHistory={props.onSaveToHistory}
      />

      {/* Photo Preview & Confirm Modal */}
      {previewPhotoUrl && (
          <div className="fixed inset-0 z-[90] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Camera size={20} className="text-emerald-500"/> 照片預覽</h3>
                      <button onClick={() => { setPreviewPhotoBlob(null); setPreviewPhotoUrl(null); setShowPhotoGallery(true); }} className="text-slate-500 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-slate-700">
                      <img src={previewPhotoUrl} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => { setPreviewPhotoBlob(null); setPreviewPhotoUrl(null); setShowPhotoGallery(true); }} 
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
                        disabled={isSavingPhoto}
                      >
                          取消
                      </button>
                      <button 
                        onClick={handleConfirmSavePhoto} 
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                        disabled={isSavingPhoto}
                      >
                          {isSavingPhoto ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          {isSavingPhoto ? '儲存中...' : '確認儲存'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal 
        isOpen={showPhotoGallery}
        onClose={() => setShowPhotoGallery(false)}
        photoIds={session.photos || []}
        onUploadPhoto={() => galleryInputRef.current?.click()}
        onTakePhoto={() => photoInputRef.current?.click()}
        onDeletePhoto={handleDeletePhoto}
      />

      {/* Missing Image Modal */}
      {showImageUploadModal && (
          <div 
            className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            onClick={handleSkipImage} 
          >
              <div 
                className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
                onClick={(e) => e.stopPropagation()} 
              >
                  <button 
                    onClick={handleSkipImage}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <div className="w-16 h-16 bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                      <ImageIcon size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white">設定計分紙背景</h3>
                  <p className="text-sm text-slate-400">
                      此模板已設定好對應的格子位置。
                      {template.cloudImageId ? "您可以從雲端還原背景，或重新上傳照片。" : "上傳圖片後即可直接在畫面上點擊輸入。"}
                  </p>
                  
                  {template.cloudImageId && (
                      <button 
                        onClick={handleModalCloudDownload} 
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2"
                      >
                          <DownloadCloud size={20} /> 
                          {isConnected ? "從雲端下載" : "連線並下載"}
                      </button>
                  )}

                  <button onClick={() => fileInputRef.current?.click()} className={`w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${template.cloudImageId ? 'mt-1' : 'mt-2'}`}>
                      <Upload size={20} /> 上傳照片
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  
                  <button onClick={handleSkipImage} className="text-slate-500 text-xs hover:text-slate-300 underline mt-4">
                      暫時跳過 (使用標準介面)
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
      {/* 1. Camera Input (capture=environment) */}
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
      {/* 2. Gallery Upload Input (no capture) */}
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

      {/* --- Main UI --- */}
      <SessionHeader
        templateName={template.name}
        isEditingTitle={isEditingTitle}
        showShareMenu={showShareMenu}
        screenshotActive={screenshotModal.isOpen} 
        isEditMode={isEditMode}
        hasVisuals={!!template.globalVisuals} 
        hasCloudImage={!!template.cloudImageId && !baseImage} 
        onEditTitleToggle={(editing) => setUiState(prev => ({ ...prev, isEditingTitle: editing }))}
        onTitleSubmit={eventHandlers.handleTitleSubmit}
        onAddColumn={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }))}
        onReset={() => setUiState(prev => ({ ...prev, showResetConfirm: true }))}
        onExit={() => {
            const { editingCell, editingPlayerId } = sessionState.uiState;
            const needsCommit = editingCell !== null || editingPlayerId !== null;

            if (needsCommit) {
                setUiState(prev => ({ 
                    ...prev, 
                    editingCell: null,
                    editingPlayerId: null,
                    previewValue: 0
                }));
                setTimeout(() => {
                    setUiState(prev => ({ ...prev, showExitConfirm: true }));
                }, 50);
            } else {
                setUiState(prev => ({ 
                    ...prev, 
                    showExitConfirm: true,
                    editingCell: null,
                    editingPlayerId: null,
                    previewValue: 0
                }));
            }
        }}
        onShareMenuToggle={(show) => setUiState(prev => ({...prev, showShareMenu: show}))}
        onScreenshotRequest={handleScreenshotRequest}
        onToggleEditMode={() => setUiState(prev => ({ ...prev, isEditMode: !prev.isEditMode }))}
        onUploadImage={handleManualUploadClick} 
        onCloudDownload={handleModalCloudDownload} 
        onOpenGallery={handleOpenGallery}
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
        // Pass editingCell to check if user is editing a Total cell
        editingCell={editingCell}
        // Pass previewValue for total cell live preview
        previewValue={previewValue}
        // Handler for Total Click
        onTotalClick={(playerId) => eventHandlers.handleCellClick(playerId, '__TOTAL__', { stopPropagation: () => {} } as any)}
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
