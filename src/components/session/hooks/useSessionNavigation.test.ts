import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameSession, GameTemplate, ScoreColumn } from '../../../types';
import { useSessionNavigation } from './useSessionNavigation';

const makeColumn = (id: string, overrides: Partial<ScoreColumn> = {}): ScoreColumn => ({
  id,
  name: id,
  formula: 'a1',
  inputType: 'keypad',
  isScoring: true,
  ...overrides,
});

const template: GameTemplate = {
  id: 'template-1',
  name: 'Navigation test',
  columns: [
    makeColumn('score-1'),
    makeColumn('auto-score', { isAuto: true, inputType: 'auto' }),
    makeColumn('score-2'),
  ],
  createdAt: 1,
};

const session: GameSession = {
  id: 'session-1',
  templateId: template.id,
  name: template.name,
  startTime: 1,
  status: 'active',
  players: ['p1', 'p2', 'p3'].map((id) => ({
    id,
    name: id,
    color: '#fff',
    scores: {},
    totalScore: 0,
  })),
};

const renderNavigation = (options: {
  editingCell?: { playerId: string; colId: string } | null;
  advanceDirection?: 'horizontal' | 'vertical';
  editablePlayerIds?: string[];
} = {}) => {
  const setEditingCell = vi.fn();
  const setEditingPlayerId = vi.fn();
  const editablePlayerIds = new Set(options.editablePlayerIds ?? ['p1']);
  const { result } = renderHook(() => useSessionNavigation({
    session,
    template,
    editingCell: options.editingCell ?? { playerId: 'p1', colId: 'score-1' },
    editingPlayerId: null,
    advanceDirection: options.advanceDirection ?? 'horizontal',
    setEditingCell,
    setEditingPlayerId,
    canEditScore: (playerId, column) => editablePlayerIds.has(playerId) && !!column && !column.isAuto && !column.isShared,
    canEditTotal: (playerId) => editablePlayerIds.has(playerId),
    canEditPlayers: false,
  }));
  return { result, setEditingCell, setEditingPlayerId };
};

describe('useSessionNavigation multiplayer filtering', () => {
  it('keeps horizontal swipes on the same column and skips unclaimed players', () => {
    const { result, setEditingCell } = renderNavigation({ editablePlayerIds: ['p1', 'p3'] });

    result.current.moveToNextPlayer('p1');

    expect(setEditingCell).toHaveBeenCalledWith({ playerId: 'p3', colId: 'score-1' });
  });

  it('does not close or move when a swipe has no other editable player', () => {
    const { result, setEditingCell, setEditingPlayerId } = renderNavigation();

    result.current.moveToNextPlayer('p1');
    result.current.moveToPrevPlayer('p1');

    expect(setEditingCell).not.toHaveBeenCalled();
    expect(setEditingPlayerId).not.toHaveBeenCalled();
  });

  it('keeps next-step navigation in the existing order while skipping auto columns', () => {
    const { result, setEditingCell } = renderNavigation({
      advanceDirection: 'vertical',
      editingCell: { playerId: 'p1', colId: 'score-1' },
    });

    result.current.moveNext();

    expect(setEditingCell).toHaveBeenCalledWith({ playerId: 'p1', colId: 'score-2' });
  });

  it('moves to the next claimed player when the current player has no later editable cell', () => {
    const { result, setEditingCell } = renderNavigation({
      advanceDirection: 'vertical',
      editablePlayerIds: ['p1', 'p2'],
      editingCell: { playerId: 'p1', colId: 'score-2' },
    });

    result.current.moveNext();

    expect(setEditingCell).toHaveBeenCalledWith({ playerId: 'p2', colId: 'score-1' });
  });
});
