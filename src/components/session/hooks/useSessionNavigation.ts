
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

    // [Modified] Special handling for Total Column Navigation
    if (editingCell.colId === '__TOTAL__') {
        const playerIdx = session.players.findIndex(p => p.id === editingCell.playerId);
        if (playerIdx === -1) return;

        // If this is the LAST player, close the panel (End of flow)
        if (playerIdx === session.players.length - 1) {
            setEditingCell(null);
            setEditingPlayerId(null);
            return;
        }

        // If not the last player, move to the next player
        const nextIdx = playerIdx + 1;

        if (advanceDirection === 'horizontal') {
            // Horizontal: Move to next player's TOTAL column
            setEditingCell({ playerId: session.players[nextIdx].id, colId: '__TOTAL__' });
        } else {
            // Vertical: Move to next player's HEADER (Name editing)
            setEditingPlayerId(session.players[nextIdx].id);
        }
        return;
    }

    // --- Standard Column Logic ---
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

  // [Fix] Joystick Action: Always switch to NEXT player (Circular)
  // Decoupled from 'advanceDirection' because a physical right swipe always implies lateral movement.
  const moveToNextPlayerOrCell = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;

    // Circular Logic: Go to next player, loop to start
    const nextIdx = (idx + 1) % session.players.length;
    
    if (editingCell) {
        setEditingCell({ playerId: session.players[nextIdx].id, colId: editingCell.colId });
    } else if (editingPlayerId) {
        setEditingPlayerId(session.players[nextIdx].id);
    }
  };

  // [Fix] Joystick Action: Always switch to PREVIOUS player (Circular)
  const moveToPreviousPlayerOrCell = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;

    // Circular Logic: Go to prev player, loop to end
    const prevIdx = (idx - 1 + session.players.length) % session.players.length;
    
    if (editingCell) {
        setEditingCell({ playerId: session.players[prevIdx].id, colId: editingCell.colId });
    } else if (editingPlayerId) {
        setEditingPlayerId(session.players[prevIdx].id);
    }
  };

  return { moveToNextCell, moveToNextPlayerOrCell, moveToPreviousPlayerOrCell };
};
