import React, { useCallback, useEffect, useRef } from 'react';
import { installTouchDiagnostics, recordScoreHandlerDecision, type TouchDiagnosticState } from '../touchDiagnostics';
import type { UIState } from './useSessionState';
import type { useSessionEvents } from './useSessionEvents';
import type { SessionViewProps } from '../sessionViewTypes';
import type { SessionCapabilities } from '../../../features/multiplayer/sessionCapabilities';
import type { GameTemplate } from '../../../types';

export function useSessionTouchDiagnostics({
  editingCell, editingPlayerId, isInputFocused, isToolboxOpen, isEditMode
}: Pick<UIState, 'editingCell' | 'editingPlayerId' | 'isInputFocused' | 'isToolboxOpen' | 'isEditMode'>) {
  const sessionSurfaceRef = useRef<HTMLDivElement>(null);
  const touchDiagnosticStateRef = useRef<TouchDiagnosticState>({
    editingCell: null,
    editingPlayerId: null,
    isInputFocused: false,
    isToolboxOpen: false,
    isEditMode: false,
  });

  useEffect(() => {
    touchDiagnosticStateRef.current = {
      editingCell: editingCell ? `${editingCell.playerId}:${editingCell.colId}` : null,
      editingPlayerId,
      isInputFocused,
      isToolboxOpen,
      isEditMode,
    };
  }, [editingCell, editingPlayerId, isInputFocused, isToolboxOpen, isEditMode]);

  useEffect(() => {
    const surface = sessionSurfaceRef.current;
    if (!surface) return undefined;
    return installTouchDiagnostics(surface, () => touchDiagnosticStateRef.current);
  }, []);


  return { sessionSurfaceRef, touchDiagnosticStateRef };
}

interface SessionScoreHandlersOptions {
  touchDiagnosticStateRef: React.MutableRefObject<TouchDiagnosticState>;
  isAiWorking: boolean;
  template: GameTemplate;
  capabilities: SessionCapabilities;
  eventHandlers: ReturnType<typeof useSessionEvents>;
  onRequestMultiplayerPlayerClaim: SessionViewProps['onRequestMultiplayerPlayerClaim'];
}

export function useSessionScoreHandlers({
  touchDiagnosticStateRef, isAiWorking, template, capabilities, eventHandlers, onRequestMultiplayerPlayerClaim
}: SessionScoreHandlersOptions) {
  const handleCellClickSafe = useCallback((playerId: string, colId: string, e: React.MouseEvent) => {
    if (isAiWorking) {
      recordScoreHandlerDecision({
        event: e.nativeEvent,
        state: touchDiagnosticStateRef.current,
        playerId,
        columnId: colId,
        accepted: false,
        reason: 'ai-working',
      });
      return;
    }
    const column = template.columns.find((item) => item.id === colId);
    const canEdit = capabilities.canEditScore(playerId, column);
    if (!canEdit) {
      recordScoreHandlerDecision({
        event: e.nativeEvent,
        state: touchDiagnosticStateRef.current,
        playerId,
        columnId: colId,
        accepted: false,
        reason: 'capability-rejected',
      });
      return;
    }
    recordScoreHandlerDecision({
      event: e.nativeEvent,
      state: touchDiagnosticStateRef.current,
      playerId,
      columnId: colId,
      accepted: true,
      reason: 'accepted',
    });
    eventHandlers.handleCellClick(playerId, colId, e);
  }, [isAiWorking, eventHandlers.handleCellClick, template.columns, capabilities, onRequestMultiplayerPlayerClaim]);

  const handleColumnHeaderClickSafe = useCallback((e: React.MouseEvent, col: any) => {
    if (isAiWorking) {
      return;
    }
    if (!capabilities.canEditTemplate) return;
    eventHandlers.handleColumnHeaderClick(e, col);
  }, [isAiWorking, eventHandlers.handleColumnHeaderClick, capabilities]);


  return { handleCellClickSafe, handleColumnHeaderClickSafe };
}
