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

  it('preserves same-name games with different BGG IDs instead of attaching the wrong board', () => {
    const templates: GameTemplate[] = [
      { id: 'board-456', name: 'Shared Name', bggId: '456', columns: [], createdAt: 1 }
    ];
    const savedGames: SavedListItem[] = [
      { id: 'saved-123', name: 'Shared Name', bggId: '123', lastUsed: 5000, usageCount: 1 }
    ];

    const { result } = renderHook(() => useGameOptionAggregator(templates, savedGames));

    expect(result.current.find(option => option.savedGameId === 'saved-123')).toMatchObject({
      bggId: '123',
      templateId: undefined
    });
    expect(result.current.find(option => option.templateId === 'board-456')).toMatchObject({
      bggId: '456',
      savedGameId: undefined
    });
  });

  it('retains both played games when their shared name has conflicting BGG IDs', () => {
    const templates: GameTemplate[] = [
      { id: 'board-456', name: 'Shared Name', bggId: '456', columns: [], createdAt: 1 }
    ];
    const savedGames: SavedListItem[] = [
      { id: 'saved-123', name: 'Shared Name', bggId: '123', lastUsed: 5000, usageCount: 1 },
      { id: 'saved-456', name: 'Shared Name', bggId: '456', lastUsed: 4000, usageCount: 1 }
    ];

    const { result } = renderHook(() => useGameOptionAggregator(templates, savedGames));

    expect(result.current.find(option => option.savedGameId === 'saved-123')?.templateId).toBeUndefined();
    expect(result.current.find(option => option.savedGameId === 'saved-456')?.templateId).toBe('board-456');
    expect(getRecentOptions(result.current, 5).map(option => option.savedGameId))
      .toEqual(['saved-123', 'saved-456']);
  });

  it('does not attach conflicting BGG dictionary metadata by name or alias', () => {
    const savedGames: SavedListItem[] = [
      { id: 'saved-123', name: 'Shared Name', bggId: '123', lastUsed: 5000, usageCount: 1 }
    ];
    const bggGames = [{
      id: '456', name: 'Shared Name', altNames: ['Shared Name'], _searchName: 'Shared Name', _altNames: 'Shared Name'
    }];

    const { result } = renderHook(() => useGameOptionAggregator([], savedGames, bggGames));

    expect(result.current.find(option => option.savedGameId === 'saved-123')?.bggName).toBeUndefined();
    expect(result.current.find(option => option.uid === 'bgg_456')?.bggId).toBe('456');
  });

  it('still matches a unique same-name board when one side lacks a BGG ID', () => {
    const templates: GameTemplate[] = [
      { id: 'matching-board', name: 'Simple Game', bggId: '123', columns: [], createdAt: 1 }
    ];
    const savedGames: SavedListItem[] = [
      { id: 'saved-game', name: 'Simple Game', lastUsed: 5000, usageCount: 1 }
    ];

    const { result } = renderHook(() => useGameOptionAggregator(templates, savedGames));

    expect(result.current.find(option => option.savedGameId === 'saved-game')).toMatchObject({
      templateId: 'matching-board', bggId: '123'
    });
  });

  it('attaches a matching BGG board to the most recently played alias', () => {
    const templates: GameTemplate[] = [
      { id: 'board-123', name: 'Board Title', bggId: '123', columns: [], createdAt: 1 }
    ];
    const savedGames: SavedListItem[] = [
      { id: 'newer', name: 'Recent Alias', bggId: '123', lastUsed: 9000, usageCount: 1 },
      { id: 'older', name: 'Older Alias', bggId: '123', lastUsed: 1000, usageCount: 10 }
    ];

    const { result } = renderHook(() => useGameOptionAggregator(templates, savedGames));

    expect(getRecentOptions(result.current, 5)).toMatchObject([{
      savedGameId: 'newer', templateId: 'board-123'
    }]);
  });

  it('keeps the most recently played same-name saved game regardless of usage-count order', () => {
    const savedGames: SavedListItem[] = [
      { id: 'newer', name: 'Same Game', lastUsed: 5000, usageCount: 1 },
      { id: 'older', name: 'same game', lastUsed: 1000, usageCount: 10 }
    ];

    const { result } = renderHook(() => useGameOptionAggregator([], savedGames));

    expect(getRecentOptions(result.current, 5).map(option => option.savedGameId)).toEqual(['newer']);
  });
});
