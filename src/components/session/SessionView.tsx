
import React, { useEffect } from 'react';
import { GameSession, GameTemplate, ScoreColumn, Player } from '../../types';
import { useSessionState } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';

// Parts
import SessionHeader from './parts/SessionHeader';
import ScoreGrid from './parts/ScoreGrid';
import TotalsBar from './parts/TotalsBar';
import InputPanel from './parts/InputPanel';
import ScreenshotView from './parts/ScreenshotView';

// Modals
import ConfirmationModal from '../shared/ConfirmationModal';
import ColumnConfigEditor from '../shared/ColumnConfigEditor';
import AddColumnModal from './modals/AddColumnModal';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  zoomLevel: number;
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onExit: () => void;
  onResetScores: () => void;
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel } = props;

  const sessionState = useSessionState(props);
  const eventHandlers = useSessionEvents(props, sessionState);

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
    isCopying,
    isInputFocused,
  } = sessionState.uiState;

  const { setUiState } = sessionState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  
  const winners = session.players
    .filter(p => p.totalScore === Math.max(...session.players.map(pl => pl.totalScore)))
    .map(p => p.id);

  // --- Scroll Synchronization ---
  // Ensures that when the user scrolls the main grid, the totals bar follows horizontally.
  useEffect(() => {
    const grid = sessionState.tableContainerRef.current;
    const bar = sessionState.totalBarScrollRef.current;

    if (!grid || !bar) return;

    const handleScroll = () => {
      // Sync the bar's scroll position to the grid's
      if (bar.scrollLeft !== grid.scrollLeft) {
          bar.scrollLeft = grid.scrollLeft;
      }
    };

    // Initial sync
    handleScroll();

    grid.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      grid.removeEventListener('scroll', handleScroll);
    };
  }, [sessionState.tableContainerRef, sessionState.totalBarScrollRef]);

  // --- Width Synchronization (New!) ---
  // Uses ResizeObserver to strictly force the TotalsBar content width to match the ScoreGrid content width.
  // This solves the alignment issue during zoom/resize without needing complex HTML restructuring.
  useEffect(() => {
    const gridContent = sessionState.gridContentRef.current;
    const totalContent = sessionState.totalContentRef.current;

    if (!gridContent || !totalContent) return;

    const observer = new ResizeObserver((entries) => {
      // 關鍵修復：使用 requestAnimationFrame 避免 loop error
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          if (entry.target === gridContent) {
             // We use offsetWidth to get the precise integer pixel width rendered by the browser.
             // IMPORTANT: The Grid Container includes the sticky header column.
             // We must dynamically calculate the header width because it now uses rem and scales with zoom.
             const gridWidth = gridContent.offsetWidth;
             
             // Try to find the sticky header element to get its exact current pixel width
             // It's the first child of the header row
             const stickyHeader = document.querySelector('#live-player-header-row > div:first-child') as HTMLElement;
             const headerOffset = stickyHeader ? stickyHeader.offsetWidth : 70; // Fallback to 70 if not found (rare)

             // The TotalsBar content container ONLY contains the player columns.
             // Therefore, we must subtract the header width to ensure alignment.
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
      <ConfirmationModal isOpen={showExitConfirm} title="確定要返回目錄嗎？" message="你會失去目前的計分內容(記分板架構會自動儲存)。" confirmText="離開" cancelText="取消" isDangerous={false} onCancel={() => setUiState(prev => ({ ...prev, showExitConfirm: false }))} onConfirm={props.onExit} />
      <ConfirmationModal isOpen={!!columnToDelete} title="確定刪除此項目？" message="刪除後，所有玩家在該項目的分數將會遺失。" confirmText="確定刪除" isDangerous={true} onCancel={() => setUiState(prev => ({ ...prev, columnToDelete: null }))} onConfirm={eventHandlers.handleConfirmDeleteColumn} />

      {editingColumn && (
        <ColumnConfigEditor 
          column={editingColumn} 
          onSave={eventHandlers.handleSaveColumn} 
          onDelete={() => {
              setUiState(prev => ({ ...prev, columnToDelete: editingColumn.id }));
          }} 
          onClose={() => setUiState(prev => ({...prev, editingColumn: null}))} 
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
        isCopying={isCopying}
        onEditTitleToggle={(editing) => setUiState(prev => ({ ...prev, isEditingTitle: editing }))}
        onTitleSubmit={eventHandlers.handleTitleSubmit}
        onAddColumn={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }))}
        onReset={() => setUiState(prev => ({ ...prev, showResetConfirm: true }))}
        onExit={() => setUiState(prev => ({ ...prev, showExitConfirm: true }))}
        onShareMenuToggle={(show) => setUiState(prev => ({...prev, showShareMenu: show}))}
        onScreenshot={eventHandlers.handleScreenshot}
      />
      
      <div 
        className="flex-1 overflow-hidden relative flex flex-col"
        onClick={eventHandlers.handleGlobalClick}
      >
        {/* 
           Conditional Focus Mask:
           Only show this transparent blocker when editing a PLAYER NAME and the keyboard is OPEN.
        */}
        {editingPlayerId && isInputFocused && (
            <div 
                className="absolute inset-0 z-40 bg-transparent"
                onClick={(e) => {
                    e.stopPropagation(); // Block click from reaching grid
                    setUiState(p => ({ ...p, isInputFocused: false })); // Blur input
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

      {/* Hidden view for screenshot generation */}
      <ScreenshotView session={session} template={template} zoomLevel={zoomLevel} />
    </div>
  );
};

export default SessionView;
