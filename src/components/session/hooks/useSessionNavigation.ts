
import { GameSession, GameTemplate } from '../../../types';

interface NavigationProps {
  session: GameSession;
  template: GameTemplate;
  editingCell: { playerId: string; colId: string } | null;
  editingPlayerId: string | null;
  advanceDirection: 'horizontal' | 'vertical';
  setEditingCell: (cell: { playerId: string; colId: string } | null) => void;
  setEditingPlayerId: (id: string | null) => void;
}

export const useSessionNavigation = ({
  session,
  template,
  editingCell,
  editingPlayerId,
  advanceDirection,
  setEditingCell,
  setEditingPlayerId,
}: NavigationProps) => {

  const moveToNextCell = () => {
    if (!editingCell) return;
    const playerIdx = session.players.findIndex(p => p.id === editingCell.playerId);
    const colIdx = template.columns.findIndex(c => c.id === editingCell.colId);
    if (playerIdx === -1 || colIdx === -1) return;

    if (advanceDirection === 'horizontal') {
      // 1. Move to next player in same column (Auto column doesn't matter here as we are staying in the same column type)
      if (playerIdx < session.players.length - 1) {
        setEditingCell({ playerId: session.players[playerIdx + 1].id, colId: editingCell.colId });
      } 
      // 2. End of row: Wrap to first player of the NEXT valid column
      else {
        let nextColIdx = colIdx + 1;
        // Skip Auto columns
        while (nextColIdx < template.columns.length && template.columns[nextColIdx].isAuto) {
            nextColIdx++;
        }

        if (nextColIdx < template.columns.length) {
          const nextCol = template.columns[nextColIdx];
          setEditingCell({ playerId: session.players[0].id, colId: nextCol.id });
        } else {
          setEditingCell(null); // End of grid
        }
      }
    } else { // vertical
      // 1. Find next valid column for same player
      let nextColIdx = colIdx + 1;
      // Skip Auto columns
      while (nextColIdx < template.columns.length && template.columns[nextColIdx].isAuto) {
          nextColIdx++;
      }

      if (nextColIdx < template.columns.length) {
        const nextCol = template.columns[nextColIdx];
        setEditingCell({ playerId: editingCell.playerId, colId: nextCol.id });
      } 
      // 2. End of column: Move to NEXT player's NAME (Header)
      else if (playerIdx < session.players.length - 1) {
        setEditingPlayerId(session.players[playerIdx + 1].id);
      } else {
        setEditingCell(null); // End of grid
      }
    }
  };

  const moveToNextPlayerOrCell = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;

    // Helper: Find first valid (non-auto) column index
    let firstValidColIdx = 0;
    while(firstValidColIdx < template.columns.length && template.columns[firstValidColIdx].isAuto) {
        firstValidColIdx++;
    }
    const firstValidCol = template.columns[firstValidColIdx];

    if (advanceDirection === 'horizontal') {
      // Circular Logic: Go to next player, loop to start
      const nextIdx = (idx + 1) % session.players.length;
      if (editingCell) {
          setEditingCell({ playerId: session.players[nextIdx].id, colId: editingCell.colId });
      } else if (editingPlayerId) {
          setEditingPlayerId(session.players[nextIdx].id);
      }
    } else { // vertical
      if (firstValidCol) {
        // Jump to current player, first valid column
        setEditingCell({ playerId: currentPlayerId, colId: firstValidCol.id });
      } else {
        setEditingPlayerId(null);
      }
    }
  };

  // [New] Move to Previous Player (Joystick Left)
  const moveToPreviousPlayerOrCell = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;

    if (advanceDirection === 'horizontal') {
      // Circular Logic: Go to prev player, loop to end
      const prevIdx = (idx - 1 + session.players.length) % session.players.length;
      if (editingCell) {
          setEditingCell({ playerId: session.players[prevIdx].id, colId: editingCell.colId });
      } else if (editingPlayerId) {
          setEditingPlayerId(session.players[prevIdx].id);
      }
    } 
    // Vertical logic for "Previous" is less defined in this context, 
    // but for consistency we can make it jump to header or prev column.
    // For now, Joystick is primarily horizontal switching.
  };

  return { moveToNextCell, moveToNextPlayerOrCell, moveToPreviousPlayerOrCell };
};
