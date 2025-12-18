import React, { useEffect, useCallback, useState } from 'react';
import { GameSession, GameTemplate } from '../../types';
import { useSessionState } from './hooks/useSessionState';
import { useSessionEvents } from './hooks/useSessionEvents';
import { toBlob } from 'html-to-image';
import { useToast } from '../../hooks/useToast';

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

// State for holding measured layout dimensions for screenshotting
interface ScreenshotLayout {
  itemWidth: number;
  playerWidths: Record<string, number>;
}

const SessionView: React.FC<SessionViewProps> = (props) => {
  const { session, template, zoomLevel } = props;

  const sessionState = useSessionState(props);
  const eventHandlers = useSessionEvents(props, sessionState);
  const { showToast } = useToast();
  
  // New state to manage the two-step screenshot process
  const [screenshotLayout, setScreenshotLayout] = useState<ScreenshotLayout | null>(null);

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
    screenshotState,
    isInputFocused,
  } = sessionState.uiState;

  const { setUiState } = sessionState;

  const isPanelOpen = editingCell !== null || editingPlayerId !== null;
  
  const winners = session.players
    .filter(p => p.totalScore === Math.max(...session.players.map(pl => pl.totalScore)))
    .map(p => p.id);
  
  // --- New Screenshot Handler ---
  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
    // Step 1: Measure the live grid layout
    const itemHeaderEl = document.querySelector('#live-player-header-row > div:first-child') as HTMLElement;
    const playerHeaderEls = document.querySelectorAll('[data-player-header-id]');
    
    if (!itemHeaderEl || playerHeaderEls.length === 0) {
        showToast({ message: "無法測量佈局，截圖失敗。", type: 'error' });
        return;
    }

    const measuredLayout: ScreenshotLayout = {
        itemWidth: itemHeaderEl.offsetWidth,
        playerWidths: {}
    };

    playerHeaderEls.forEach(el => {
        const playerId = el.getAttribute('data-player-header-id');
        if (playerId) {
            measuredLayout.playerWidths[playerId] = (el as HTMLElement).offsetWidth;
        }
    });
    
    // Step 2: Set state to trigger re-render of ScreenshotView with correct dimensions
    setScreenshotLayout(measuredLayout);
    setUiState(p => ({ ...p, showShareMenu: false, screenshotState: { active: true, mode } }));

  }, [setUiState, showToast]);


  // --- Screenshot Effect (now listens to screenshotLayout) ---
  useEffect(() => {
    // Only proceed if screenshot is active AND layout has been measured
    if (!screenshotState.active || !screenshotLayout) return;

    const takeScreenshot = async () => {
      // The target is now guaranteed to have re-rendered with the correct dimensions
      const screenshotTarget = document.getElementById('screenshot-target');
      if (screenshotTarget) {
        try {
          // --- 關鍵修復：強制等待字型載入 ---
          // 確保 `html-to-image` 執行時，瀏覽器已經下載並應用了 Inter 字型，
          // 這樣 `white-space: pre-wrap` 才能基於正確的字元寬度計算換行。
          // 字型大小需與截圖目標一致，因此乘以 zoomLevel
          const fontStyles = `normal ${16 * zoomLevel}px Inter`;
          await document.fonts.load(fontStyles);
          
          const width = screenshotTarget.offsetWidth;
          const height = screenshotTarget.offsetHeight;

          const blob = await toBlob(screenshotTarget, {
            backgroundColor: '#0f172a',
            pixelRatio: 1.5,
            cacheBust: true,
            width: width,
            height: height,
            style: {
              transform: 'none', 
            }
          });

          if (blob) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast({ message: "計分表圖片已複製！", type: 'success' });
          } else {
            throw new Error("Blob creation failed");
          }
        } catch (e) {
          console.error("Screenshot failed:", e);
          showToast({ message: "截圖失敗，請在新分頁中再試一次。", type: 'error' });
        } finally {
          // Reset both states after completion
          setUiState(p => ({ ...p, screenshotState: { ...p.screenshotState, active: false } })); 
          setScreenshotLayout(null);
        }
      } else {
        setUiState(p => ({ ...p, screenshotState: { ...p.screenshotState, active: false } })); 
        setScreenshotLayout(null);
        showToast({ message: "找不到截圖目標", type: 'error' });
      }
    };
    
    // Timeout allows React to commit the state update and re-render ScreenshotView
    const timer = setTimeout(takeScreenshot, 50);
    return () => clearTimeout(timer);

  }, [screenshotState.active, screenshotLayout, setUiState, zoomLevel, showToast]);

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
        screenshotActive={screenshotState.active}
        onEditTitleToggle={(editing) => setUiState(prev => ({ ...prev, isEditingTitle: editing }))}
        onTitleSubmit={eventHandlers.handleTitleSubmit}
        onAddColumn={() => setUiState(prev => ({ ...prev, isAddColumnModalOpen: true }))}
        onReset={() => setUiState(prev => ({ ...prev, showResetConfirm: true }))}
        onExit={() => setUiState(prev => ({ ...prev, showExitConfirm: true }))}
        onShareMenuToggle={(show) => setUiState(prev => ({...prev, showShareMenu: show}))}
        onScreenshotRequest={handleScreenshotRequest}
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
      {screenshotState.active && (
        <ScreenshotView 
          session={session} 
          template={template} 
          zoomLevel={zoomLevel} 
          mode={screenshotState.mode}
          layout={screenshotLayout} 
        />
      )}
    </div>
  );
};

export default SessionView;