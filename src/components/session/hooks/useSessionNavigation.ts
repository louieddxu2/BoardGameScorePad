
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';

interface NavigationProps {
  session: GameSession;
  template: GameTemplate;
  editingCell: { playerId: string; colId: string } | null;
  editingPlayerId: string | null;
  setEditingCell: (cell: { playerId: string; colId: string } | null) => void;
  setEditingPlayerId: (id: string | null) => void;
  canEditScore?: (playerId: string, column: ScoreColumn | undefined) => boolean;
  canEditTotal?: (playerId: string) => boolean;
  canEditPlayers?: boolean;
}

export const useSessionNavigation = ({
  session,
  template,
  editingCell,
  editingPlayerId,
  setEditingCell,
  setEditingPlayerId,
  canEditScore = () => true,
  canEditTotal = () => true,
  canEditPlayers = true,
}: NavigationProps) => {

  const isGridEntryColumn = (column: ScoreColumn) => (
    column.displayMode !== 'hidden' &&
    column.displayMode !== 'overlay' &&
    !column.isAuto
  );

  const canEditCell = (playerId: string, colId: string) => {
    if (colId === '__TOTAL__') return canEditTotal(playerId);
    const column = template.columns.find((item) => item.id === colId);
    return !!column && canEditScore(playerId, column);
  };

  const findFirstEditableCell = (playerId: string) => {
    const firstColumn = template.columns.find((column) => (
      isGridEntryColumn(column) && canEditScore(playerId, column)
    ));
    if (firstColumn) return { playerId, colId: firstColumn.id };
    if (canEditTotal(playerId)) return { playerId, colId: '__TOTAL__' };
    return null;
  };

  const findNextPlayerWithEditableCell = (currentPlayerId: string, direction: 1 | -1, colId: string) => {
    const currentIndex = session.players.findIndex((player) => player.id === currentPlayerId);
    if (currentIndex === -1) return null;

    for (let offset = 1; offset < session.players.length; offset += 1) {
      const candidateIndex = (currentIndex + (offset * direction) + session.players.length) % session.players.length;
      const candidate = session.players[candidateIndex];
      if (canEditCell(candidate.id, colId)) return candidate.id;
    }
    return null;
  };

  // Helper: Move from Player Header down into the grid (Vertical Navigation)
  const moveIntoGrid = (playerId: string) => {
    const firstEditableCell = findFirstEditableCell(playerId);
    if (firstEditableCell) setEditingCell(firstEditableCell);
  };

  const moveToNextPlayer = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;
    if (editingCell) {
      const nextPlayerId = findNextPlayerWithEditableCell(currentPlayerId, 1, editingCell.colId);
      if (nextPlayerId) setEditingCell({ playerId: nextPlayerId, colId: editingCell.colId });
    } else if (canEditPlayers) {
      const nextIdx = (idx + 1) % session.players.length;
      setEditingPlayerId(session.players[nextIdx].id);
    }
  };

  const moveToPrevPlayer = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;
    if (editingCell) {
      const previousPlayerId = findNextPlayerWithEditableCell(currentPlayerId, -1, editingCell.colId);
      if (previousPlayerId) setEditingCell({ playerId: previousPlayerId, colId: editingCell.colId });
    } else if (canEditPlayers) {
      const prevIdx = (idx - 1 + session.players.length) % session.players.length;
      setEditingPlayerId(session.players[prevIdx].id);
    }
  };

  // Unified Next Action (Enter / Next Button)
  const moveNext = (overrideId?: string) => {
    // 1. Context: Editing Cell
    if (editingCell) {
        const { playerId, colId } = editingCell;
        
        // Special case: Total Column Navigation
        if (colId === '__TOTAL__') {
            const playerIdx = session.players.findIndex(p => p.id === playerId);
            if (playerIdx === -1) return;

            // Last player in Total -> Close
            if (playerIdx === session.players.length - 1) {
                setEditingCell(null);
                setEditingPlayerId(null);
                return;
            }

            if (canEditPlayers) {
                setEditingPlayerId(session.players[playerIdx + 1].id);
                return;
            } else {
                for (let nextIdx = playerIdx + 1; nextIdx < session.players.length; nextIdx += 1) {
                    const firstEditableCell = findFirstEditableCell(session.players[nextIdx].id);
                    if (firstEditableCell) {
                        setEditingCell(firstEditableCell);
                        return;
                    }
                }
            }
            setEditingCell(null);
            return;
        }

        // Standard Cell Navigation
        const playerIdx = session.players.findIndex(p => p.id === playerId);
        const colIdx = template.columns.findIndex(c => c.id === colId);
        if (playerIdx === -1 || colIdx === -1) return;

        // Next always advances down this player's editable columns.
        // Switching players explicitly remains a separate swipe action.
        for (let nextColIdx = colIdx + 1; nextColIdx < template.columns.length; nextColIdx += 1) {
            const nextColumn = template.columns[nextColIdx];
            if (nextColumn.isAuto) continue;
            if (canEditScore(playerId, nextColumn)) {
                setEditingCell({ playerId, colId: nextColumn.id });
                return;
            }
        }

        // Preserve the existing downward flow at the end of a player's columns.
        if (canEditPlayers && playerIdx < session.players.length - 1) {
            setEditingPlayerId(session.players[playerIdx + 1].id);
            return;
        }
        if (!canEditPlayers) {
            for (let nextPlayerIdx = playerIdx + 1; nextPlayerIdx < session.players.length; nextPlayerIdx += 1) {
                const firstEditableCell = findFirstEditableCell(session.players[nextPlayerIdx].id);
                if (firstEditableCell) {
                    setEditingCell(firstEditableCell);
                    return;
                }
            }
        }
        setEditingCell(null); // End of grid
        return;
    }

    // 2. Context: Player Header (using overrideId if provided, else current editingPlayerId)
    const activeId = overrideId || editingPlayerId;
    if (activeId) {
        moveIntoGrid(activeId);
    }
  };

  return { 
      moveNext, 
      moveToNextPlayer, 
      moveToPrevPlayer, 
      moveIntoGrid // Expose if needed externally
  };
};
