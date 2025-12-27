
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { GameSession, GameTemplate } from '../../types';
import { useSessionState, ScreenshotLayout } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { useToast } from '../../hooks/useToast';
import { useGoogleDrive } from '../../hooks/useGoogleDrive'; // Import hook
import { Upload, X, Image as ImageIcon, CloudUpload } from 'lucide-react';

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
  baseImage: string | null; // New Prop for Runtime Image
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onUpdateImage: (img: string) => void; // New Callback
  onExit: () => void;
  onResetScores: () => void;
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel, baseImage, onUpdateImage } = props;

  const sessionState = useSessionState(props);
  const eventHandlers = useSessionEvents(props, sessionState);
  const { showToast } = useToast();
  const { handleBackup, isSyncing } = useGoogleDrive(); // Use Drive Hook
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal State
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [showDrivePrompt, setShowDrivePrompt] = useState(false); // New: Drive Prompt
  const [pendingImage, setPendingImage] = useState<string | null>(null); // Temp store for image

  const hasPromptedRef = useRef(false);

  // Check if we need to prompt for an image automatically
  useEffect(() => {
      // Logic: If template has visual coordinates (implies it supports background), 
      // but no baseImage is loaded, show modal.
      const hasBackgroundDesign = !!template.globalVisuals || !!template.hasImage;
      
      if (hasBackgroundDesign && !baseImage && !hasPromptedRef.current) {
          setShowImageUploadModal(true);
          hasPromptedRef.current = true;
      }
  }, [template.globalVisuals, template.hasImage, baseImage]);

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
    isEditMode, // New State
  } = sessionState.uiState;

  const { setUiState } = sessionState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  
  const winners = session.players
    .filter(p => p.totalScore === Math.max(...session.players.map(pl => pl.totalScore)))
    .map(p => p.id);
  
  // --- Image Upload Handler ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
          if (ev.target?.result) {
              const imgData = ev.target.result as string;
              onUpdateImage(imgData); // Update app state immediately
              setShowImageUploadModal(false);
              
              // Trigger Drive Backup Prompt
              setPendingImage(imgData);
              setShowDrivePrompt(true);
          }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmBackup = async () => {
      if (pendingImage) {
          await handleBackup(template, pendingImage);
      }
      setShowDrivePrompt(false);
      setPendingImage(null);
  };

  const handleSkipBackup = () => {
      setShowDrivePrompt(false);
      setPendingImage(null);
  };

  const handleSkipImage = () => {
      // Just close the modal locally. 
      setShowImageUploadModal(false);
  };
  
  const handleManualUploadClick = () => {
      setShowImageUploadModal(true);
      setUiState(prev => ({ ...prev, showShareMenu: false }));
  };

  // --- Screenshot Handler (Stage 1: Measure & Open Modal) ---
  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
    // Step 1: Measure the live grid layout
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
    
    // Measure row heights
    template.columns.forEach(col => {
      const rowEl = document.getElementById(`row-${col.id}`) as HTMLElement;
      if (rowEl) {
        measuredLayout.rowHeights[col.id] = rowEl.offsetHeight;
      }
    });

    // Step 2: Open Modal with Layout Data
    setUiState(p => ({ 
        ...p, 
        showShareMenu: false, 
        screenshotModal: { 
            isOpen: true, 
            mode, 
            layout: measuredLayout 
        } 
    }));

  }, [setUiState, showToast, template.columns]);


  // --- Scroll Synchronization ---
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

  // --- Width Synchronization ---
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
      <ConfirmationModal isOpen={showExitConfirm} title="確定要返回目錄嗎？" message="你會失去目前的計分內容(計分板架構會自動儲存)。" confirmText="離開" cancelText="取消" isDangerous={false} onCancel={() => setUiState(prev => ({ ...prev, showExitConfirm: false }))} onConfirm={props.onExit} />
      <ConfirmationModal isOpen={!!columnToDelete} title="確定刪除此項目？" message="刪除後，所有玩家在該項目的分數將會遺失。" confirmText="確定刪除" isDangerous={true} onCancel={() => setUiState(prev => ({ ...prev, columnToDelete: null }))} onConfirm={eventHandlers.handleConfirmDeleteColumn} />

      {/* Drive Backup Prompt */}
      {showDrivePrompt && (
          <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-sky-900/30 rounded-full flex items-center justify-center text-sky-400 mb-2 border border-sky-500/20">
                      <CloudUpload size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white text-center">備份到雲端？</h3>
                  <p className="text-slate-400 text-sm text-center">
                      為了避免手機容量不足或清除快取時遺失圖片，建議將此背景圖備份到 Google Drive。
                  </p>
                  
                  <div className="flex gap-3 w-full mt-2">
                      <button
                          onClick={handleSkipBackup}
                          className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-medium hover:bg-slate-700 transition-colors border border-slate-700"
                      >
                          暫時不要
                      </button>
                      <button
                          onClick={handleConfirmBackup}
                          disabled={isSyncing}
                          className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-lg shadow-sky-900/50 transition-colors flex items-center justify-center gap-2"
                      >
                          {isSyncing ? '上傳中...' : '確認備份'}
                      </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                      這將在您的 Drive 建立 BoardGameScorePad 資料夾。
                  </p>
              </div>
          </div>
      )}

      {/* Missing Image Modal */}
      {showImageUploadModal && (
          <div 
            className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            onClick={handleSkipImage} // Click outside to skip
          >
              <div 
                className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 relative"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
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
                      此模板已設定好對應的格子位置。上傳圖片後即可直接在畫面上點擊輸入。
                  </p>
                  
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2">
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
          allColumns={template.columns} // Pass all columns for variable mapping
          onSave={eventHandlers.handleSaveColumn} 
          onDelete={() => {
              setUiState(prev => ({ ...prev, columnToDelete: editingColumn.id }));
          }} 
          onClose={() => setUiState(prev => ({...prev, editingColumn: null}))}
          baseImage={baseImage || undefined} // Pass baseImage
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
        screenshotActive={screenshotModal.isOpen} // Renamed prop usage
        isEditMode={isEditMode}
        hasVisuals={!!template.globalVisuals} // Pass visuals presence
        onEditTitleToggle={(editing) => setUiState(prev => ({ ...prev, isEditingTitle: editing }))}
        onTitleSubmit={eventHandlers.handleTitleSubmit}
        onAddColumn={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }))}
        onReset={() => setUiState(prev => ({ ...prev, showResetConfirm: true }))}
        onExit={() => setUiState(prev => ({ ...prev, showExitConfirm: true }))}
        onShareMenuToggle={(show) => setUiState(prev => ({...prev, showShareMenu: show}))}
        onScreenshotRequest={handleScreenshotRequest}
        onToggleEditMode={() => setUiState(prev => ({ ...prev, isEditMode: !prev.isEditMode }))}
        onUploadImage={handleManualUploadClick} // Pass manual upload handler
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
          onUpdateTemplate={props.onUpdateTemplate}
          scrollContainerRef={sessionState.tableContainerRef}
          contentRef={sessionState.gridContentRef}
          baseImage={baseImage || undefined} // Pass runtime image down
          isEditMode={isEditMode}
          zoomLevel={zoomLevel}
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
        baseImage={baseImage || undefined} // Pass runtime image down
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

      {/* NEW: Screenshot Modal */}
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
