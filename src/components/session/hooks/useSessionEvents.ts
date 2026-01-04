
import React, { useCallback, useEffect } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { useSessionState } from './useSessionState';
import { useSessionNavigation } from './useSessionNavigation';
import { generateId } from '../../../utils/idGenerator';

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
    // Fix: Reset previewValue to 0 immediately when navigating via Next button
    setEditingCell: (cell) => setUiState(prev => ({ ...prev, editingCell: cell, editingPlayerId: null, previewValue: 0 })),
    setEditingPlayerId: (id) => setUiState(prev => ({ ...prev, editingPlayerId: id, editingCell: null, previewValue: 0 })),
  });

  // --- Back Button Logic ---
  useEffect(() => {
    const handleSessionBackPress = () => {
      // Priority of closing UI layers

      // SOLUTION: Add a guard clause. If the column editor is open,
      // let it handle the back press event itself and do nothing here.
      if (uiState.editingColumn) { return; }

      if (uiState.showExitConfirm) { setUiState(p => ({ ...p, showExitConfirm: false })); return; }
      if (uiState.showShareMenu) { setUiState(p => ({ ...p, showShareMenu: false })); return; }
      if (uiState.isAddColumnModalOpen) { setUiState(p => ({ ...p, isAddColumnModalOpen: false })); return; }
      if (uiState.screenshotModal.isOpen) { setUiState(p => ({ ...p, screenshotModal: { ...p.screenshotModal, isOpen: false } })); return; }
      if (uiState.editingCell || uiState.editingPlayerId) {
        setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, previewValue: 0 }));
        return;
      }
      setUiState(p => ({ ...p, showExitConfirm: true }));
    };
    window.addEventListener('app-back-press', handleSessionBackPress);
    return () => window.removeEventListener('app-back-press', handleSessionBackPress);
  }, [uiState, onExit, setUiState]);


  // --- Event Handlers ---

  const handleGlobalClick = () => {
    // 遮罩層現在會處理阻擋邏輯，這裡只需要專注於「點擊空白處關閉面板」
    setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, previewValue: 0 }));
  };
  
  const handleCellClick = (playerId: string, colId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 不需要再檢查 isInputFocused，因為遮罩層會擋住所有點擊
    
    if (uiState.editingCell?.playerId === playerId && uiState.editingCell?.colId === colId) {
      setUiState(p => ({ ...p, editingCell: null, previewValue: 0 }));
    } else {
      // Fix: Reset previewValue to 0 immediately when clicking a new cell
      setUiState(p => ({ ...p, editingCell: { playerId, colId }, editingPlayerId: null, previewValue: 0 }));
    }
  };
  
  const handlePlayerHeaderClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 不需要再檢查 isInputFocused

    if (uiState.editingPlayerId === playerId) {
      setUiState(p => ({ ...p, editingPlayerId: null, previewValue: 0 }));
    } else {
      setUiState(p => ({ ...p, editingPlayerId: playerId, editingCell: null, previewValue: 0 }));
    }
  };
  
  const handleColumnHeaderClick = (e: React.MouseEvent, col: ScoreColumn) => {
    e.stopPropagation();
    // 限制：只有在編輯模式下才能開啟欄位編輯器
    if (!uiState.isEditMode) return;

    setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, editingColumn: col, previewValue: 0 }));
  };

  const handleTitleSubmit = (newTitle: string) => {
    if (newTitle.trim()) {
      onUpdateTemplate({ ...template, name: newTitle.trim() });
    }
    setUiState(p => ({ ...p, isEditingTitle: false }));
  };
  
  const handlePlayerNameSubmit = (playerId: string, newName: string, moveNext: boolean = false) => {
      const finalName = newName?.trim() ?? '';
      const currentPlayer = session.players.find(p => p.id === playerId);
      
      // Only update if the name actually changed
      if (currentPlayer && currentPlayer.name !== finalName) {
          // Only add non-empty names to history
          if (finalName) {
              onUpdatePlayerHistory(finalName);
          }
          const players = session.players.map(p => p.id === playerId ? { ...p, name: finalName } : p);
          onUpdateSession({ ...session, players });
      }
      
      setUiState(p => ({ ...p, isInputFocused: false }));
      if (moveNext) {
          navigation.moveToNextPlayerOrCell(playerId);
      }
  };

  const handleConfirmReset = () => {
    onResetScores();
    setUiState(p => ({ ...p, showResetConfirm: false, editingCell: null, editingPlayerId: null, previewValue: 0 }));
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
    const newCol: ScoreColumn = { 
        id: generateId(8), // Short ID for new columns
        name: `項目 ${template.columns.length + 1}`, 
        isScoring: true, 
        formula: 'a1', 
        inputType: 'keypad', 
        rounding: 'none' 
    };
    onUpdateTemplate({ ...template, columns: [...template.columns, newCol] });
    setUiState(p => ({ ...p, isAddColumnModalOpen: false }));
  };
  
  const handleCopyColumns = (selectedIds: string[]) => {
    const newColumns = selectedIds.map(idToCopy => {
      const original = template.columns.find(c => c.id === idToCopy);
      if (!original) return null;
      const newColumn = JSON.parse(JSON.stringify(original));
      newColumn.id = generateId(8); // Short ID for copied columns
      newColumn.name = `${original.name} (複製)`;
      return newColumn;
    }).filter((c): c is ScoreColumn => c !== null);
  
    if (newColumns.length > 0) {
      onUpdateTemplate({ ...template, columns: [...template.columns, ...newColumns] });
    }
    setUiState(p => ({ ...p, isAddColumnModalOpen: false }));
  };
  
  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
    // Note: The actual measurement logic is in SessionView to access DOM
    // This handler primarily signals the UI state change for menu closing
    setUiState(p => ({ ...p, showShareMenu: false }));
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
    handleScreenshotRequest,
    moveToNext: navigation.moveToNextCell,
  };
};
