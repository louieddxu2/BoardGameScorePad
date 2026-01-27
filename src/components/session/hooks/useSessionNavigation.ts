
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

  // Helper: Move from Player Header down into the grid (Vertical Navigation)
  const moveIntoGrid = (playerId: string) => {
      // Find first visible, non-overlay, non-auto column to focus
      const firstValidCol = template.columns.find(c => 
          c.displayMode !== 'hidden' && 
          c.displayMode !== 'overlay' && 
          !c.isAuto
      );
      
      if (firstValidCol) {
          setEditingCell({ playerId, colId: firstValidCol.id });
      } else {
          // If no valid input columns found (e.g., 0-column template), 
          // navigation into the grid should land on the Total cell for manual adjustment.
          setEditingCell({ playerId, colId: '__TOTAL__' });
      }
  };

  const moveToNextPlayer = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;
    const nextIdx = (idx + 1) % session.players.length;
    
    if (editingCell) {
        setEditingCell({ playerId: session.players[nextIdx].id, colId: editingCell.colId });
    } else {
        setEditingPlayerId(session.players[nextIdx].id);
    }
  };

  const moveToPrevPlayer = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;
    const prevIdx = (idx - 1 + session.players.length) % session.players.length;
    
    if (editingCell) {
        setEditingCell({ playerId: session.players[prevIdx].id, colId: editingCell.colId });
    } else {
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

            const nextIdx = playerIdx + 1;
            if (advanceDirection === 'horizontal') {
                setEditingCell({ playerId: session.players[nextIdx].id, colId: '__TOTAL__' });
            } else {
                setEditingPlayerId(session.players[nextIdx].id);
            }
            return;
        }

        // Standard Cell Navigation
        const playerIdx = session.players.findIndex(p => p.id === playerId);
        const colIdx = template.columns.findIndex(c => c.id === colId);
        if (playerIdx === -1 || colIdx === -1) return;

        if (advanceDirection === 'horizontal') {
            if (playerIdx < session.players.length - 1) {
                setEditingCell({ playerId: session.players[playerIdx + 1].id, colId: colId });
            } else {
                // End of row: Wrap to first player of NEXT valid column
                let nextColIdx = colIdx + 1;
                while (nextColIdx < template.columns.length && template.columns[nextColIdx].isAuto) nextColIdx++;
                
                if (nextColIdx < template.columns.length) {
                    setEditingCell({ playerId: session.players[0].id, colId: template.columns[nextColIdx].id });
                } else {
                    setEditingCell(null); // End of grid
                }
            }
        } else { // vertical
            // Find next valid column for same player
            let nextColIdx = colIdx + 1;
            while (nextColIdx < template.columns.length && template.columns[nextColIdx].isAuto) nextColIdx++;

            if (nextColIdx < template.columns.length) {
                setEditingCell({ playerId, colId: template.columns[nextColIdx].id });
            } 
            // End of column: Move to NEXT player's NAME (Header)
            else if (playerIdx < session.players.length - 1) {
                setEditingPlayerId(session.players[playerIdx + 1].id);
            } else {
                setEditingCell(null); // End of grid
            }
        }
        return;
    }

    // 2. Context: Player Header (using overrideId if provided, else current editingPlayerId)
    const activeId = overrideId || editingPlayerId;
    if (activeId) {
        if (advanceDirection === 'vertical') {
            moveIntoGrid(activeId);
        } else {
            // Horizontal Mode
            const idx = session.players.findIndex(p => p.id === activeId);
            
            // Check if it is the LAST player
            if (idx !== -1 && idx === session.players.length - 1) {
                // Wrap around to First Player, First Cell (Enter Grid)
                moveIntoGrid(session.players[0].id);
            } else {
                // Otherwise move to next header
                moveToNextPlayer(activeId);
            }
        }
    }
  };

  return { 
      moveNext, 
      moveToNextPlayer, 
      moveToPrevPlayer, 
      moveIntoGrid // Expose if needed externally
  };
};
