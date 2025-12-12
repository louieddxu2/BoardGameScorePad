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
      if (playerIdx < session.players.length - 1) {
        setEditingCell({ playerId: session.players[playerIdx + 1].id, colId: editingCell.colId });
      } else if (colIdx < template.columns.length - 1) {
        const nextCol = template.columns[colIdx + 1];
        setEditingCell({ playerId: session.players[0].id, colId: nextCol.id });
      } else {
        setEditingCell(null); // End of grid
      }
    } else { // vertical
      if (colIdx < template.columns.length - 1) {
        const nextCol = template.columns[colIdx + 1];
        setEditingCell({ playerId: editingCell.playerId, colId: nextCol.id });
      } else if (playerIdx < session.players.length - 1) {
        // Move to next player's NAME (Header)
        setEditingPlayerId(session.players[playerIdx + 1].id);
      } else {
        setEditingCell(null); // End of grid
      }
    }
  };

  const moveToNextPlayerOrCell = (currentPlayerId: string) => {
    const idx = session.players.findIndex(p => p.id === currentPlayerId);
    if (idx === -1) return;

    if (advanceDirection === 'horizontal') {
      if (idx < session.players.length - 1) {
        setEditingPlayerId(session.players[idx + 1].id);
      } else if (template.columns.length > 0) {
        setEditingCell({ playerId: session.players[0].id, colId: template.columns[0].id });
      } else {
        setEditingPlayerId(null);
      }
    } else { // vertical
      if (template.columns.length > 0) {
        setEditingCell({ playerId: currentPlayerId, colId: template.columns[0].id });
      } else {
        setEditingPlayerId(null);
      }
    }
  };

  return { moveToNextCell, moveToNextPlayerOrCell };
};