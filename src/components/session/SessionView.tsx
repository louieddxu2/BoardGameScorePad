
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
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateImage, onUpdateTemplate } = props;

  const sessionState = useSessionState(props);
  const eventHandlers = useSessionEvents(props, sessionState);
  const { showToast } = useToast();
  const { handleBackup, downloadCloudImage, isSyncing } = useGoogleDrive();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal State
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);

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
          if (googleDriveService.isAuthorized) {
              handleCloudDownload().then(success => {
                  if (!success) setShowImageUploadModal(true);
              });
          } else {
              setShowImageUploadModal(true);
          }
      } else {
          setShowImageUploadModal(true);
      }
  }, [baseImage, template.globalVisuals, template.hasImage, template.cloudImageId, handleCloudDownload]);

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
    previewValue, // Destructure previewValue
  } = sessionState.uiState;

  const { setUiState } = sessionState;

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
  // For COOP and NO_SCORE modes, winners remains empty (no crown displayed)
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
          if (ev.target?.result) {
              const imgData = ev.target.result as string;
              onUpdateImage(imgData); 
              setShowImageUploadModal(false);
              
              // Silent Background Cloud Backup if logged in
              if (googleDriveService.isAuthorized) {
                  handleBackup(template, imgData).then(updated => {
                      if (updated) onUpdateTemplate(updated);
                  }).catch(console.error);
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
        // Force commit of any pending inputs by clearing selection
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
      <ConfirmationModal isOpen={showExitConfirm} title="確認返回目錄嗎？" message="" confirmText="離開" cancelText="取消" isDangerous={false} onCancel={() => setUiState(prev => ({ ...prev, showExitConfirm: false }))} onConfirm={props.onExit} />
      <ConfirmationModal isOpen={!!columnToDelete} title="確定刪除此項目？" message="刪除後，所有玩家在該項目的分數將會遺失。" confirmText="確定刪除" isDangerous={true} onCancel={() => setUiState(prev => ({ ...prev, columnToDelete: null }))} onConfirm={eventHandlers.handleConfirmDeleteColumn} />

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
        onExit={() => setUiState(prev => ({ 
            ...prev, 
            showExitConfirm: true,
            // Force commit of any pending inputs by clearing selection
            editingCell: null,
            editingPlayerId: null,
            previewValue: 0
        }))}
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
          previewValue={previewValue} // Pass the global preview value
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
      />
    </div>
  );
};

export default SessionView;
