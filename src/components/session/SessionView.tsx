
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { GameSession, GameTemplate } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useToast } from '../../hooks/useToast';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { googleDriveService } from '../../services/googleDrive';
import { Upload, X, Image as ImageIcon, DownloadCloud } from 'lucide-react';

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
import SessionExitModal from './modals/SessionExitModal'; // New Import

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  zoomLevel: number;
  baseImage: string | null; 
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onUpdateImage: (img: string) => void; 
  onExit: () => void;
  onResetScores: () => void;
  onSaveToHistory: () => void; // New Prop
}

// Convert Base64 to Blob for uploading
const base64ToBlob = (base64: string, mimeType: string = 'image/jpeg'): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateImage, onUpdateTemplate } = props;

  const sessionState = useSessionState(props);
  const eventHandlers = useSessionEvents(props, sessionState);
  const { showToast } = useToast();
  const { handleBackup, downloadCloudImage, isSyncing, isAutoConnectEnabled } = useGoogleDrive();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal State
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  // Replaced simple boolean with custom modal
  const [showSessionExitModal, setShowSessionExitModal] = useState(false);

  const hasPromptedRef = useRef(false);

  const handleCloudDownload = useCallback(async () => {
      if (template.cloudImageId) {
          const imgBase64 = await downloadCloudImage(template.cloudImageId);
          if (imgBase64) {
              onUpdateImage(imgBase64);
              return true;
          }
      }
      return false;
  }, [template.cloudImageId, downloadCloudImage, onUpdateImage]);

  useEffect(() => {
      if (baseImage) return;
      const hasBackgroundDesign = !!template.globalVisuals || !!template.hasImage;
      if (!hasBackgroundDesign) return;
      if (hasPromptedRef.current) return;
      hasPromptedRef.current = true;

      if (template.cloudImageId) {
          // [修正] 只有在「已啟用自動連線」且「目前已授權(有Token)」時，才自動下載圖片。
          // 這避免了在離線或未登入狀態下，進入計分板時跳出登入視窗或錯誤提示。
          if (isAutoConnectEnabled && googleDriveService.isAuthorized) {
              handleCloudDownload().then(success => {
                  if (!success) setShowImageUploadModal(true);
              });
          } else {
              // 若未連線，直接顯示上傳視窗 (使用者可在此視窗手動點擊「從雲端下載」來觸發登入)
              setShowImageUploadModal(true);
          }
      } else {
          setShowImageUploadModal(true);
      }
  }, [baseImage, template.globalVisuals, template.hasImage, template.cloudImageId, handleCloudDownload, isAutoConnectEnabled]);

  const {
    editingCell,
    editingPlayerId,
    editingColumn,
    isEditingTitle,
    showResetConfirm,
    showExitConfirm, // Kept for event handler compatibility, but we intercept it
    columnToDelete,
    isAddColumnModalOpen,
    showShareMenu,
    screenshotModal,
    isInputFocused,
    isEditMode, 
    previewValue,
  } = sessionState.uiState;

  const { setUiState } = sessionState;

  // Intercept the showExitConfirm state from useSessionEvents/State
  // If it becomes true, we decide whether to show the new modal or just exit
  useEffect(() => {
      if (showExitConfirm) {
          // Reset the flag immediately so we handle it ourselves
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
  
  // Winner Calculation Logic based on ScoringRule
  const rule = session.scoringRule || 'HIGHEST_WINS';
  let winners: string[] = [];

  if (rule === 'HIGHEST_WINS') {
      const maxScore = Math.max(...session.players.map(pl => pl.totalScore));
      winners = session.players.filter(p => p.totalScore === maxScore).map(p => p.id);
  } else if (rule === 'LOWEST_WINS') {
      const minScore = Math.min(...session.players.map(pl => pl.totalScore));
      winners = session.players.filter(p => p.totalScore === minScore).map(p => p.id);
  }
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
          if (ev.target?.result) {
              const imgData = ev.target.result as string;
              onUpdateImage(imgData); 
              setShowImageUploadModal(false);
              
              // [Cloud Trigger 2] Take Photo -> Upload to Session Folder
              // Only upload if connected and auto-connect enabled
              if (isAutoConnectEnabled && googleDriveService.isAuthorized) {
                  try {
                      // Ensure folder exists (Create if missing)
                      let folderId = session.cloudFolderId;
                      if (!folderId) {
                          // Lazy Creation: Create folder now
                          folderId = await googleDriveService.createActiveSessionFolder(template.name, session.id);
                          
                          // [CRITICAL FIX]
                          // Must update local session state immediately so parent useAppData knows the ID exists.
                          // Otherwise subsequent saves (like exitSession) might create a duplicate folder.
                          const updatedSession = { ...session, cloudFolderId: folderId };
                          props.onUpdateSession(updatedSession);
                      }
                      
                      const blob = base64ToBlob(imgData);
                      await googleDriveService.uploadFileToFolder(folderId, 'photo.jpg', 'image/jpeg', blob);
                      showToast({ message: "照片已上傳至雲端", type: 'success' });
                  } catch (e) {
                      console.error("Failed to upload photo:", e);
                      showToast({ message: "照片上傳失敗", type: 'warning' });
                  }
              }
          }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSkipImage = () => {
      setShowImageUploadModal(false);
  };
  
  const handleManualUploadClick = () => {
      setShowImageUploadModal(true);
      setUiState(prev => ({ ...prev, showShareMenu: false }));
  };

  const handleModalCloudDownload = async () => {
      const success = await handleCloudDownload();
      if (success) {
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
                          <DownloadCloud size={20} /> 從雲端下載
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
            // [Bug Fix] Race condition when exiting while editing a ghost number.
            // If we are editing, we must first close the panel (triggering auto-commit),
            // and delay the exit confirmation slightly to allow the session state to update.
            const { editingCell, editingPlayerId } = sessionState.uiState;
            const needsCommit = editingCell !== null || editingPlayerId !== null;

            if (needsCommit) {
                // 1. Force close panel (triggers commit in InputPanel cleanup)
                setUiState(prev => ({ 
                    ...prev, 
                    editingCell: null,
                    editingPlayerId: null,
                    previewValue: 0
                }));
                // 2. Wait for commit & state update to propagate before checking hasScores
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
        onCloudDownload={handleCloudDownload} 
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
        customWinners={winners} // Pass the calculated winners
      />
    </div>
  );
};

export default SessionView;
