import React, { useCallback, useEffect } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { useSessionState } from './useSessionState';
import { useSessionNavigation } from './useSessionNavigation';
import { toBlob } from 'html-to-image';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: string[];
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onExit: () => void;
  onResetScores: () => void;
}

type SessionStateHook = ReturnType<typeof useSessionState>;

export const useSessionEvents = (props: SessionViewProps, sessionState: SessionStateHook) => {
  const { session, template, onUpdateSession, onUpdateTemplate, onUpdatePlayerHistory, onExit, onResetScores } = props;
  const { uiState, setUiState } = sessionState;

  const navigation = useSessionNavigation({
    session,
    template,
    editingCell: uiState.editingCell,
    editingPlayerId: uiState.editingPlayerId,
    advanceDirection: uiState.advanceDirection,
    setEditingCell: (cell) => setUiState(prev => ({ ...prev, editingCell: cell, editingPlayerId: null })),
    setEditingPlayerId: (id) => setUiState(prev => ({ ...prev, editingPlayerId: id, editingCell: null })),
  });

  // --- Back Button Logic ---
  useEffect(() => {
    const handleSessionBackPress = () => {
      // Priority of closing UI layers
      if (uiState.showExitConfirm) { setUiState(p => ({ ...p, showExitConfirm: false })); return; }
      if (uiState.showShareMenu) { setUiState(p => ({ ...p, showShareMenu: false })); return; }
      if (uiState.editingColumn) { setUiState(p => ({ ...p, editingColumn: null })); return; }
      if (uiState.isAddColumnModalOpen) { setUiState(p => ({ ...p, isAddColumnModalOpen: false })); return; }
      if (uiState.editingCell || uiState.editingPlayerId) {
        setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null }));
        return;
      }
      setUiState(p => ({ ...p, showExitConfirm: true }));
    };
    window.addEventListener('app-back-press', handleSessionBackPress);
    return () => window.removeEventListener('app-back-press', handleSessionBackPress);
  }, [uiState, onExit, setUiState]);


  // --- Event Handlers ---

  const handleGlobalClick = () => {
    setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null }));
  };
  
  const handleCellClick = (playerId: string, colId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (uiState.editingCell?.playerId === playerId && uiState.editingCell?.colId === colId) {
      setUiState(p => ({ ...p, editingCell: null }));
    } else {
      setUiState(p => ({ ...p, editingCell: { playerId, colId }, editingPlayerId: null }));
    }
  };
  
  const handlePlayerHeaderClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (uiState.editingPlayerId === playerId) {
      setUiState(p => ({ ...p, editingPlayerId: null }));
    } else {
      setUiState(p => ({ ...p, editingPlayerId: playerId, editingCell: null }));
    }
  };
  
  const handleColumnHeaderClick = (e: React.MouseEvent, col: ScoreColumn) => {
    e.stopPropagation();
    setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, editingColumn: col }));
  };

  const handleTitleSubmit = (newTitle: string) => {
    if (newTitle.trim()) {
      onUpdateTemplate({ ...template, name: newTitle.trim() });
    }
    setUiState(p => ({ ...p, isEditingTitle: false }));
  };
  
  const handlePlayerNameSubmit = (playerId: string, newName: string, moveNext: boolean = false) => {
      if (newName?.trim()) {
          onUpdatePlayerHistory(newName.trim());
          const players = session.players.map(p => p.id === playerId ? { ...p, name: newName } : p);
          onUpdateSession({ ...session, players });
      }
      setUiState(p => ({ ...p, isInputFocused: false }));
      if (moveNext) {
          navigation.moveToNextPlayerOrCell(playerId);
      }
  };

  const handleConfirmReset = () => {
    onResetScores();
    setUiState(p => ({ ...p, showResetConfirm: false, editingCell: null, editingPlayerId: null }));
  };

  const handleSaveColumn = (updates: Partial<ScoreColumn>) => {
    if (!uiState.editingColumn) return;
    const newCols = template.columns.map(c => c.id === uiState.editingColumn!.id ? { ...c, ...updates } : c);
    onUpdateTemplate({ ...template, columns: newCols });
    setUiState(p => ({ ...p, editingColumn: null, editingCell: null, editingPlayerId: null }));
  };

  const handleConfirmDeleteColumn = () => {
    if (!uiState.columnToDelete) return;
    const newCols = template.columns.filter(c => c.id !== uiState.columnToDelete);
    onUpdateTemplate({ ...template, columns: newCols });
    setUiState(p => ({ ...p, columnToDelete: null, editingColumn: null }));
  };

  const handleAddBlankColumn = () => {
    const newCol: ScoreColumn = { id: crypto.randomUUID(), name: `項目 ${template.columns.length + 1}`, type: 'number', isScoring: true, weight: 1, options: [], mappingRules: [], unit: '', rounding: 'none', quickButtons: [] };
    onUpdateTemplate({ ...template, columns: [...template.columns, newCol] });
    setUiState(p => ({ ...p, isAddColumnModalOpen: false }));
  };
  
  const handleCopyColumns = (selectedIds: string[]) => {
    const newColumns = selectedIds.map(idToCopy => {
      const original = template.columns.find(c => c.id === idToCopy);
      if (!original) return null;
      const newColumn = JSON.parse(JSON.stringify(original));
      newColumn.id = crypto.randomUUID();
      newColumn.name = `${original.name} (複製)`;
      return newColumn;
    }).filter((c): c is ScoreColumn => c !== null);
  
    if (newColumns.length > 0) {
      onUpdateTemplate({ ...template, columns: [...template.columns, ...newColumns] });
    }
    setUiState(p => ({ ...p, isAddColumnModalOpen: false }));
  };
  
  const handleScreenshot = useCallback(async () => {
    setUiState(p => ({ ...p, isCopying: true, showShareMenu: false }));
    
    // Slight delay to ensure React renders the mode change and the DOM is ready
    setTimeout(async () => {
      const screenshotTarget = document.getElementById('screenshot-target');
      if (screenshotTarget) {
        try {
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
            alert("計分表圖片已複製！");
          } else {
            throw new Error("Blob creation failed");
          }
        } catch (e) {
          console.error("Screenshot failed:", e);
          alert("截圖失敗。若您在 IDE 預覽視窗中，請嘗試點擊右上角「在新分頁開啟」後再試一次。");
        } finally {
          setUiState(p => ({ ...p, isCopying: false })); 
        }
      } else {
        setUiState(p => ({ ...p, isCopying: false })); 
        alert("找不到截圖目標");
      }
    }, 200); 
  }, [setUiState]);

  return {
    handleGlobalClick,
    handleCellClick,
    handlePlayerHeaderClick,
    handleColumnHeaderClick,
    handleTitleSubmit,
    handlePlayerNameSubmit,
    handleConfirmReset,
    handleSaveColumn,
    handleConfirmDeleteColumn,
    handleAddBlankColumn,
    handleCopyColumns,
    handleScreenshot,
    moveToNext: navigation.moveToNextCell,
  };
};