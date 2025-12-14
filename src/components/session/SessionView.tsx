
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

  // --- Scroll & Layout Synchronization ---
  // 1. Syncs horizontal scroll position between Grid and TotalsBar.
  // 2. Syncs physical width of TotalsBar inner container to match Grid inner container (for Zoom alignment).
  useEffect(() => {
    const gridScrollWrapper = sessionState.tableContainerRef.current;
    const barScrollWrapper = sessionState.totalBarScrollRef.current;
    
    // We need to target the *content* containers, not the scroll wrappers
    const gridContent = document.getElementById('live-grid-container');
    const barContent = document.getElementById('live-totals-inner');

    if (!gridScrollWrapper || !barScrollWrapper || !gridContent || !barContent) return;

    // A. Scroll Sync
    const handleScroll = () => {
      if (barScrollWrapper.scrollLeft !== gridScrollWrapper.scrollLeft) {
          barScrollWrapper.scrollLeft = gridScrollWrapper.scrollLeft;
      }
    };
    gridScrollWrapper.addEventListener('scroll', handleScroll, { passive: true });

    // B. Width Sync (ResizeObserver)
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target === gridContent) {
                // Force the totals bar inner width to match the grid's content width
                // This ensures that when zoom expands the grid, the totals bar expands equally
                barContent.style.width = `${entry.contentRect.width}px`;
            }
        }
    });
    resizeObserver.observe(gridContent);

    // Initial sync
    handleScroll();

    return () => {
      gridScrollWrapper.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [sessionState.tableContainerRef, sessionState.totalBarScrollRef]);

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
           This allows the user to click anywhere to dismiss the keyboard (blur) without accidentally opening another cell.
           
           For normal cell editing (Keypad), this is deliberately omitted so users can jump between cells with one tap.
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
        />
      </div>

      <TotalsBar
        players={session.players}
        winners={winners}
        isPanelOpen={isPanelOpen}
        panelHeight={sessionState.panelHeight}
        scrollRef={sessionState.totalBarScrollRef}
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
