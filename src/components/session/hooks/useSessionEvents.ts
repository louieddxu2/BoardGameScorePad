import React, { useCallback, useEffect, useRef } from 'react';
import { GameSession, GameTemplate, ScoreColumn, SavedListItem } from '../../../types';
import { useSessionState } from './useSessionState';
import { useSessionNavigation } from './useSessionNavigation';
import { generateId } from '../../../utils/idGenerator';
import { calculatePlayerTotal } from '../../../utils/scoring';
import { useToast } from '../../../hooks/useToast';
import { DATA_LIMITS } from '../../../dataLimits';
import { bgStatsEntityService } from '../../../features/bgstats/services/bgStatsEntityService';
import { useSessionTranslation } from '../../../i18n/session';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';

interface SessionViewProps {
  session: GameSession;
  template: GameTemplate;
  savedPlayers: SavedListItem[]; // Renamed
  onUpdateSession: (session: GameSession) => void;
  onUpdateTemplate: (template: GameTemplate) => void;
  onUpdateSavedPlayer: (name: string, uuid?: string) => void; // Renamed
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
  const { session, template, savedPlayers, onUpdateSession, onUpdateTemplate, onUpdateSavedPlayer, onExit, onResetScores } = props;
  const { uiState, setUiState } = sessionState;
  const { showToast } = useToast();
  const { t } = useSessionTranslation();

  const navigation = useSessionNavigation({
    session,
    template,
    editingCell: uiState.editingCell,
    editingPlayerId: uiState.editingPlayerId,
    advanceDirection: uiState.advanceDirection,
    setEditingCell: (cell) => setUiState(prev => ({ ...prev, editingCell: cell, editingPlayerId: null, previewValue: 0 })),
    setEditingPlayerId: (id) => setUiState(prev => ({ ...prev, editingPlayerId: id, editingCell: null, previewValue: 0 })),
  });

  // [Optimization] Use Ref to track latest UI State without triggering effect re-run
  const uiStateRef = useRef(uiState);
  const sessionRef = useRef(session);
  const localUiStateRef = useRef(localUiState);
  // [Fix] Track onExit in a ref to prevent listener re-binding when parent re-renders
  const onExitRef = useRef(onExit);

  useEffect(() => { uiStateRef.current = uiState; }, [uiState]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { localUiStateRef.current = localUiState; }, [localUiState]);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  // --- Back Button Logic (History Stack Managed UI) ---
  // 1. Input Panel (Score Cell / Player Name)
  useModalBackHandler(
    uiState.editingCell !== null || uiState.editingPlayerId !== null,
    () => setUiState(p => ({ ...p, editingCell: null, editingPlayerId: null, previewValue: 0 })),
    'session-input-panel'
  );

  // 2. Game Title Editing
  useModalBackHandler(
    uiState.isEditingTitle,
    () => setUiState(p => ({ ...p, isEditingTitle: false })),
    'session-title-edit'
  );

  // 3. Share Menu Popover
  const { zIndex: shareMenuZIndex } = useModalBackHandler(
    uiState.showShareMenu,
    () => setUiState(p => ({ ...p, showShareMenu: false })),
    'session-share-menu'
  );

  // --- Back Button Logic (Stack Priority for non-history managed UI) ---
  useEffect(() => {
    const handleSessionBackPress = (e: Event) => {
      const currentUi = uiStateRef.current;
      const currentSession = sessionRef.current;
      const currentLocalUi = localUiStateRef.current;

      // 0. Photo Preview (Highest Priority - Local State)
      if (currentLocalUi?.isPhotoPreviewOpen) {
        currentLocalUi.onClosePhotoPreview();
        e.stopImmediatePropagation();
        return;
      }

      // 0.1 General Camera Overlay
      if (currentUi.isGeneralCameraOpen) {
        setUiState(p => ({ ...p, isGeneralCameraOpen: false }));
        e.stopImmediatePropagation();
        return;
      }

      // 0.2 Texture Mapper / Scanner
      if (currentUi.isTextureMapperOpen) {
        setUiState(p => ({ ...p, isTextureMapperOpen: false }));
        e.stopImmediatePropagation();
        return;
      }
      if (currentUi.isScannerOpen) {
        setUiState(p => ({ ...p, isScannerOpen: false }));
        e.stopImmediatePropagation();
        return;
      }

      // 0.5 Game Settings
      if (currentUi.isGameSettingsOpen) {
        setUiState(p => ({ ...p, isGameSettingsOpen: false }));
        e.stopImmediatePropagation();
        return;
      }

      // 1. Add Column Modal
      if (currentUi.isAddColumnModalOpen) {
        setUiState(p => ({ ...p, isAddColumnModalOpen: false }));
        e.stopImmediatePropagation();
        return;
      }

      // 2. Image Upload / Background
      if (currentUi.isImageUploadModalOpen) {
        setUiState(p => ({ ...p, isImageUploadModalOpen: false }));
        e.stopImmediatePropagation();
        return;
      }

      // 4. Session Exit Confirmation Modal (Targeted by app-back-press fallback)
      if (currentUi.isSessionExitModalOpen) {
        setUiState(p => ({ ...p, isSessionExitModalOpen: false }));
        e.stopImmediatePropagation();
        return;
      }

      // Note: ScreenshotModal and ColumnConfigEditor are managed internally by their own hooks.
      // because App.tsx checks hasActiveModals(), this listener won't be called if they are open.

      // 10. Default: Open Exit Confirmation
      // Check if we need to confirm or just exit
      const hasData = currentSession.players.some((p, index) => {
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

      const hasPhotos = (currentSession.photos && currentSession.photos.length > 0);
      const hasNote = !!currentSession.note && currentSession.note.trim().length > 0;

      // Note: We deliberately exclude 'hasLocation' here as location setting is often done during setup
      // and not considered "session data" that needs saving confirmation if nothing else happened.

      if (hasData || hasPhotos || hasNote) {
        setUiState(p => ({ ...p, isSessionExitModalOpen: true }));
      } else {
        onExitRef.current(); // Use Ref
      }
    };

    // [Important] Use capture phase to intercept before children (like ColumnConfigEditor) 
    // IF we are handling a high-priority modal.
    window.addEventListener('app-back-press', handleSessionBackPress, { capture: true });
    return () => window.removeEventListener('app-back-press', handleSessionBackPress, { capture: true });
  }, [setUiState]); // Removed onExit to keep listener stable


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
          const matchedRecord = savedPlayers.find(h => h.name.toLowerCase() === finalName.toLowerCase());
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

        // Update library list if it's a manual entry AND has a valid linked ID
        if (finalName && !linkedId && finalLinkedId) {
          onUpdateSavedPlayer(finalName, finalLinkedId);
        }
      }
    }

    setUiState(p => ({ ...p, isInputFocused: false }));
    if (moveNext) {
      navigation.moveNext(playerId);
    }
  };

  const handleSaveColumn = (updates: Partial<ScoreColumn>) => {
    if (!uiState.editingColumn) return;
    const newCols = template.columns.map(c => c.id === uiState.editingColumn!.id ? { ...c, ...updates } : c);
    onUpdateTemplate({ ...template, columns: newCols });
    setUiState(p => ({ ...p, editingColumn: null, editingCell: null, editingPlayerId: null }));
  };

  const handleAddBlankColumn = () => {
    // 獲取上次使用的單位作為預設值，若無則根據語系初始化
    const lastUnit = localStorage.getItem('sm_pref_standard_unit') ?? t('col_default_unit_pts');

    const newCol: ScoreColumn = {
      id: generateId(DATA_LIMITS.ID_LENGTH.DEFAULT),
      name: t('col_name_with_index', { n: template.columns.length + 1 }),
      isScoring: true,
      formula: 'a1',
      inputType: 'keypad',
      rounding: 'none',
      unit: lastUnit
    };
    onUpdateTemplate({ ...template, columns: [...template.columns, newCol] });
    showToast({ message: t('toast_add_column_success'), type: 'success' });
  };

  const handleCopyColumns = (selectedIds: string[]) => {
    const newColumns = selectedIds.map(idToCopy => {
      const original = template.columns.find(c => c.id === idToCopy);
      if (!original) return null;
      const newColumn = JSON.parse(JSON.stringify(original));
      newColumn.id = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
      newColumn.name = `${original.name}${t('col_copy_suffix')}`;
      return newColumn;
    }).filter((c): c is ScoreColumn => c !== null);

    if (newColumns.length > 0) {
      onUpdateTemplate({ ...template, columns: [...template.columns, ...newColumns] });
      showToast({ message: t('toast_copy_columns_success', { count: newColumns.length }), type: 'success' });
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

    // [Feature] Auto-backfill history BGG IDs if bggId is updated (Scenario A)
    if (updates.bggId) {
      bgStatsEntityService.updateHistoryByTemplateId(updates.bggId, template.id)
        .then(count => {
          if (count > 0) {
            showToast({ message: t('toast_sync_bgg_success', { count }), type: 'info' });
          }
        });
    }
  };

  // [New] Toolbox Toggle
  const handleToggleToolbox = () => {
    setUiState(p => {
      const willOpen = !p.isToolboxOpen;
      return {
        ...p,
        isToolboxOpen: willOpen,
        // If opening toolbox, clear selection so the toolbox content shows up
        // If closing, we just update the flag.
        ...(willOpen ? { editingCell: null, editingPlayerId: null, previewValue: 0 } : {})
      };
    });
  };

  return {
    handleGlobalClick,
    handleCellClick,
    handlePlayerHeaderClick,
    handleColumnHeaderClick,
    handleTitleSubmit,
    handlePlayerNameSubmit,
    handleSaveColumn,
    handleAddBlankColumn,
    handleCopyColumns,
    handleScreenshotRequest,
    // [New] Export settings handlers
    handleOpenGameSettings,
    handleSaveGameSettings,
    handleToggleToolbox, // Export new handler
    // [Updated] Expose unified moveNext
    moveToNext: () => navigation.moveNext(),
    // [New] Expose Joystick Actions
    moveToNextPlayer: navigation.moveToNextPlayer,
    moveToPrevPlayer: navigation.moveToPrevPlayer,
    shareMenuZIndex // [NEW] Export for SessionView to use
  };
};