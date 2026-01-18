
import React, { useCallback, useEffect } from 'react';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { useSessionState } from './useSessionState';
import { useSessionNavigation } from './useSessionNavigation';
import { generateId } from '../../../utils/idGenerator';
import { calculatePlayerTotal } from '../../../utils/scoring';
import { useToast } from '../../../hooks/useToast';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: any[]; // [Update] Updated to accept any[] (SavedListItem[]) to match AppData
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string) => void;
  onExit: () => void;
  onResetScores: () => void;
}

interface LocalUiState {
  isPhotoPreviewOpen: boolean;
  onClosePhotoPreview: () => void;
}

type SessionStateHook = ReturnType<typeof useSessionState>;

export const useSessionEvents = (
  props: SessionViewProps, 
  sessionState: SessionStateHook,
  localUiState?: LocalUiState
) => {
  const { session, template, onUpdateSession, onUpdateTemplate, onUpdatePlayerHistory, onExit, onResetScores } = props;
  const { uiState, setUiState } = sessionState;
  const { showToast } = useToast();

  const navigation = useSessionNavigation({
    session,
    template,
    editingCell: uiState.editingCell,
    editingPlayerId: uiState.editingPlayerId,
    advanceDirection: uiState.advanceDirection,
    setEditingCell: (cell) => setUiState(prev => ({ ...prev, editingCell: cell, editingPlayerId: null, previewValue: 0 })),
    setEditingPlayerId: (id) => setUiState(prev => ({ ...prev, editingPlayerId: id, editingCell: null, previewValue: 0 })),
  });

  // --- Back Button Logic (Stack Priority) ---
  useEffect(() => {
    const handleSessionBackPress = () => {
      // 0. Photo Preview (Highest Priority - Local State)
      if (localUiState?.isPhotoPreviewOpen) {
          localUiState.onClosePhotoPreview();
          return;
      }

      // 1. Column Editor (Let it handle itself if implemented, but strictly we can guard here)
      if (uiState.editingColumn) { return; }

      // 2. Image Upload Modal (Missing Image / Manual Upload)
      if (uiState.isImageUploadModalOpen) {
          setUiState(p => ({ ...p, isImageUploadModalOpen: false }));
          return;
      }

      // 3. Photo Gallery
      if (uiState.isPhotoGalleryOpen) {
          setUiState(p => ({ ...p, isPhotoGalleryOpen: false }));
          return;
      }

      // 4. Session Exit Confirmation Modal
      if (uiState.isSessionExitModalOpen) {
          setUiState(p => ({ ...p, isSessionExitModalOpen: false }));
          return;
      }

      // 5. Share Menu
      if (uiState.showShareMenu) { 
          setUiState(p => ({ ...p, showShareMenu: false })); 
          return; 
      }

      // 6. Add Column Modal
      if (uiState.isAddColumnModalOpen) { 
          setUiState(p => ({ ...p, isAddColumnModalOpen: false })); 
          return; 
      }

      // 7. Screenshot Modal
      if (uiState.screenshotModal.isOpen) { 
          setUiState(p => ({ ...p, screenshotModal: { ...p.screenshotModal, isOpen: false } })); 
          return; 
      }

      // 8. Input Panel (Editing Cell/Player)
      if (uiState.editingCell || uiState.editingPlayerId) {
        setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, previewValue: 0 }));
        return;
      }

      // 9. Reset Confirmation
      if (uiState.showResetConfirm) {
          setUiState(p => ({ ...p, showResetConfirm: false }));
          return;
      }

      // 10. Default: Open Exit Confirmation
      // Check if we need to confirm or just exit
      const hasData = session.players.some(p => 
          Object.keys(p.scores).length > 0 || 
          (p.bonusScore || 0) !== 0 ||
          p.tieBreaker ||
          p.isForceLost ||
          !p.id.startsWith('sys_player_') || // Name changed (Custom Player)
          p.isStarter // Starter set
      );
      const hasPhotos = (session.photos && session.photos.length > 0);

      if (hasData || hasPhotos) {
          setUiState(p => ({ ...p, isSessionExitModalOpen: true }));
      } else {
          onExit();
      }
    };
    window.addEventListener('app-back-press', handleSessionBackPress);
    return () => window.removeEventListener('app-back-press', handleSessionBackPress);
  }, [uiState, onExit, setUiState, session.players, session.photos, localUiState]);


  // --- Event Handlers ---

  const handleGlobalClick = () => {
    setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, previewValue: 0 }));
  };
  
  const handleCellClick = (playerId: string, colId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (uiState.editingCell?.playerId === playerId && uiState.editingCell?.colId === colId) {
      setUiState(p => ({ ...p, editingCell: null, previewValue: 0 }));
    } else {
      let initialValue: any = 0;
      if (colId === '__TOTAL__') {
          const player = session.players.find(p => p.id === playerId);
          if (player) {
              initialValue = calculatePlayerTotal(player, template, session.players);
          }
      }

      setUiState(p => ({ 
          ...p, 
          editingCell: { playerId, colId }, 
          editingPlayerId: null, 
          previewValue: initialValue 
      }));
    }
  };
  
  const handlePlayerHeaderClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (uiState.editingPlayerId === playerId) {
      setUiState(p => ({ ...p, editingPlayerId: null, previewValue: 0 }));
    } else {
      setUiState(p => ({ ...p, editingPlayerId: playerId, editingCell: null, previewValue: 0 }));
    }
  };
  
  const handleColumnHeaderClick = (e: React.MouseEvent, col: ScoreColumn) => {
    e.stopPropagation();
    if (!uiState.isEditMode) return;
    setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, editingColumn: col, previewValue: 0 }));
  };

  const handleTitleSubmit = (newTitle: string) => {
    if (newTitle.trim()) {
      onUpdateTemplate({ ...template, name: newTitle.trim() });
    }
    setUiState(p => ({ ...p, isEditingTitle: false }));
  };
  
  // [Updated] Support linking to history UUID
  const handlePlayerNameSubmit = (playerId: string, newName: string, moveNext: boolean = false, linkedId?: string) => {
      const finalName = newName?.trim() ?? '';
      const currentPlayer = session.players.find(p => p.id === playerId);
      
      // We need to keep track of the effective ID for navigation, 
      // because if it changes (sys -> uuid), we must navigate using the NEW ID.
      let effectiveId = playerId;

      if (currentPlayer) {
          // Check if name changed OR if we are linking a new ID (even if name is same)
          const nameChanged = currentPlayer.name !== finalName;
          const linkChanged = linkedId && currentPlayer.linkedPlayerId !== linkedId;

          if (nameChanged || linkChanged) {
              const isSystemId = currentPlayer.id.startsWith('sys_player_');
              // Only generate new session ID if it was a system ID. 
              // Otherwise keep the current session ID (which is already a UUID).
              const newId = isSystemId ? generateId() : currentPlayer.id;
              effectiveId = newId;

              const players = session.players.map(p => {
                  if (p.id === playerId) {
                      return { 
                          ...p, 
                          name: finalName,
                          id: newId, // Update ID if needed
                          linkedPlayerId: linkedId || p.linkedPlayerId // Update linked ID if provided, else keep existing
                      };
                  }
                  return p;
              });
              
              // [CRITICAL FIX] Update UI State immediately if ID changed.
              if (newId !== playerId && uiState.editingPlayerId === playerId) {
                  setUiState(prev => ({ ...prev, editingPlayerId: newId }));
              }

              onUpdateSession({ ...session, players });

              // Only update history list if it's a manual entry (no linkedId provided)
              if (finalName && !newId.startsWith('sys_player_') && !linkedId) {
                  onUpdatePlayerHistory(finalName);
              }
          }
      }
      
      setUiState(p => ({ ...p, isInputFocused: false }));
      if (moveNext) {
          navigation.moveNext(effectiveId);
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
        id: generateId(8), 
        name: `項目 ${template.columns.length + 1}`, 
        isScoring: true, 
        formula: 'a1', 
        inputType: 'keypad', 
        rounding: 'none' 
    };
    onUpdateTemplate({ ...template, columns: [...template.columns, newCol] });
    showToast({ message: "已新增空白項目", type: 'success' });
  };
  
  const handleCopyColumns = (selectedIds: string[]) => {
    const newColumns = selectedIds.map(idToCopy => {
      const original = template.columns.find(c => c.id === idToCopy);
      if (!original) return null;
      const newColumn = JSON.parse(JSON.stringify(original));
      newColumn.id = generateId(8); 
      newColumn.name = `${original.name} (複製)`;
      return newColumn;
    }).filter((c): c is ScoreColumn => c !== null);
  
    if (newColumns.length > 0) {
      onUpdateTemplate({ ...template, columns: [...template.columns, ...newColumns] });
      showToast({ message: `已複製 ${newColumns.length} 個項目`, type: 'success' });
    }
  };
  
  const handleScreenshotRequest = useCallback((mode: 'full' | 'simple') => {
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
    // [Updated] Expose unified moveNext
    moveToNext: () => navigation.moveNext(),
    // [New] Expose Joystick Actions
    moveToNextPlayer: navigation.moveToNextPlayer,
    moveToPrevPlayer: navigation.moveToPrevPlayer,
  };
};
