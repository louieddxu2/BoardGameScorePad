import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameTemplate, SavedListItem } from '../../../types';
import { getRecentOptions } from '../utils/sortStrategies';
import { useGameOptionAggregator } from './useGameOptionAggregator';

describe('useGameOptionAggregator recency', () => {
  it('keeps template edits from making unplayed games look recent', () => {
    const templates: GameTemplate[] = [
      { id: 'played-template', name: 'Played Game', columns: [], createdAt: 1, updatedAt: 9000 },
      { id: 'unplayed-template', name: 'Unplayed Game', columns: [], createdAt: 1, updatedAt: 10000 }
    ];
    const savedGames: SavedListItem[] = [
      { id: 'played', name: 'Played Game', lastUsed: 5000, usageCount: 1 },
      { id: 'unplayed', name: 'Unplayed Game', lastUsed: 0, usageCount: 0 }
    ];

    const { result } = renderHook(() => useGameOptionAggregator(templates, savedGames));

    expect(result.current.find(option => option.savedGameId === 'played')).toMatchObject({
      lastUsed: 5000,
      usageCount: 1
    });
    expect(result.current.find(option => option.savedGameId === 'unplayed')).toMatchObject({
      lastUsed: 0,
      usageCount: 0
    });
    expect(getRecentOptions(result.current, 5).map(option => option.savedGameId)).toEqual(['played']);
  });
});
