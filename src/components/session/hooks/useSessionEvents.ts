
import React, { useCallback, useEffect } from 'react';
import { GameSession, GameTemplate, ScoreColumn, SavedListItem } from '../../../types';
import { useSessionState } from './useSessionState';
import { useSessionNavigation } from './useSessionNavigation';
import { generateId } from '../../../utils/idGenerator';
import { calculatePlayerTotal } from '../../../utils/scoring';
import { useToast } from '../../../hooks/useToast';
import { DATA_LIMITS } from '../../../dataLimits';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  playerHistory: SavedListItem[]; // [Update] Updated to accept SavedListItem[] to match AppData
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdatePlayerHistory: (name: string, uuid?: string) => void; // [Modified] Accepts optional UUID
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
  const { session, template, playerHistory, onUpdateSession, onUpdateTemplate, onUpdatePlayerHistory, onExit, onResetScores } = props;
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

      // 0.5 Game Settings Modal (New High Priority)
      if (uiState.isGameSettingsOpen) {
          setUiState(p => ({ ...p, isGameSettingsOpen: false }));
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
      const hasData = session.players.some((p, index) => {
          // A. Has Scores
          if (Object.keys(p.scores).length > 0) return true;
          
          // B. Has Meta Data changes
          if ((p.bonusScore || 0) !== 0) return true;
          if (p.tieBreaker) return true;
          if (p.isForceLost) return true;
          if (p.isStarter) return true;

          // C. Has Linked Identity
          if (p.linkedPlayerId) return true;

          // D. [Fix] Check for custom ID that is NOT a system default
          // System defaults are 'slot_' (legacy) or 'player_' (new) or 'sys_' (legacy)
          const isSystemId = p.id.startsWith('slot_') || p.id.startsWith('sys_') || p.id.startsWith('player_');
          if (!isSystemId) return true;

          return false;
      });

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
  
  // [Updated] Simplified Logic: Only update if name actually changed.
  const handlePlayerNameSubmit = (playerId: string, newName: string, moveNext: boolean = false, linkedId?: string) => {
      const finalName = newName?.trim() ?? '';
      const currentPlayer = session.players.find(p => p.id === playerId);
      
      if (currentPlayer) {
          // Check if name changed physically
          const nameChanged = currentPlayer.name !== finalName;
          let finalLinkedId = linkedId;

          // Auto-Link Logic: Only runs if NO explicit linkedId provided AND name actually changed.
          if (!finalLinkedId) {
              if (nameChanged && finalName) {
                  // If name changed, try to find a match or generate new
                  const matchedRecord = playerHistory.find(h => h.name.toLowerCase() === finalName.toLowerCase());
                  if (matchedRecord) {
                      finalLinkedId = matchedRecord.id; 
                  } else {
                      // New player input -> Generate UUID
                      // We removed the regex check. If user types "Player 1" (changing it from something else, or re-typing it), it becomes a custom entity.
                      finalLinkedId = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                  }
              } else {
                  // If name DID NOT change, keep the existing ID (don't generate a new one)
                  // This prevents "Next" button from turning a default placeholder into a custom entity.
                  finalLinkedId = currentPlayer.linkedPlayerId;
              }
          }

          // Check if link changed (e.g. from undefined to uuid)
          const linkChanged = currentPlayer.linkedPlayerId !== finalLinkedId;

          if (nameChanged || linkChanged) {
              const players = session.players.map(p => {
                  if (p.id === playerId) {
                      return { 
                          ...p, 
                          name: finalName,
                          linkedPlayerId: finalLinkedId
                      };
                  }
                  return p;
              });
              
              onUpdateSession({ ...session, players });

              // Update history list if it's a manual entry AND has a valid linked ID
              if (finalName && !linkedId && finalLinkedId) {
                  onUpdatePlayerHistory(finalName, finalLinkedId);
              }
          }
      }
      
      setUiState(p => ({ ...p, isInputFocused: false }));
      if (moveNext) {
          navigation.moveNext(playerId);
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
        id: generateId(DATA_LIMITS.ID_LENGTH.DEFAULT), 
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
      newColumn.id = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT); 
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

  // [New] Game Settings Handlers
  const handleOpenGameSettings = () => {
      // Only allow opening if in edit mode (consistent with other edit features)
      if (!uiState.isEditMode) return;
      setUiState(p => ({ ...p, isGameSettingsOpen: true }));
  };

  const handleSaveGameSettings = (updates: Partial<GameTemplate>) => {
      onUpdateTemplate({ ...template, ...updates });
      setUiState(p => ({ ...p, isGameSettingsOpen: false }));
  };

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
    // [New] Export settings handlers
    handleOpenGameSettings,
    handleSaveGameSettings,
    // [Updated] Expose unified moveNext
    moveToNext: () => navigation.moveNext(),
    // [New] Expose Joystick Actions
    moveToNextPlayer: navigation.moveToNextPlayer,
    moveToPrevPlayer: navigation.moveToPrevPlayer,
  };
};
