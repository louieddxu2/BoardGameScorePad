import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameOption } from '../../../features/game-selector/types';
import { useDashboardData } from './useDashboardData';

const recentOption = (overrides: Partial<GameOption> = {}): GameOption => ({
  uid: 'recent-option',
  displayName: 'Recent Game',
  lastUsed: 10,
  usageCount: 1,
  isPinned: false,
  defaultPlayerCount: 4,
  defaultScoringRule: 'HIGHEST_WINS',
  _searchTokens: ['Recent Game'],
  ...overrides
});

describe('useDashboardData recent shortcuts', () => {
  it('creates a lightweight simple-template fallback for a missing recent game', () => {
    const { result } = renderHook(() => useDashboardData({
      userTemplates: [],
      systemTemplates: [],
      pinnedIds: [],
      recentlyPlayedGames: [recentOption({
        templateId: 'missing-template',
        displayName: 'Recent Game',
        bggId: '12345'
      })],
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    expect(result.current.recentTemplates).toHaveLength(1);
    expect(result.current.recentTemplates[0]).toMatchObject({
      needsResolution: true,
      template: {
        id: 'missing-template',
        name: 'Recent Game',
        bggId: '12345',
        columns: []
      }
    });
  });

  it('uses the loaded template when it is already available', () => {
    const template = { id: 'template-1', name: 'Current Name', columns: [], createdAt: 1 };
    const { result } = renderHook(() => useDashboardData({
      userTemplates: [template],
      systemTemplates: [],
      pinnedIds: [],
      recentlyPlayedGames: [recentOption({ templateId: 'template-1', displayName: 'Historical Name' })],
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    expect(result.current.recentTemplates).toEqual([{ template, needsResolution: false }]);
  });

  it('does not treat a saved-game ID as a template ID when no scoreboard exists', () => {
    const { result } = renderHook(() => useDashboardData({
      userTemplates: [],
      systemTemplates: [],
      pinnedIds: [],
      recentlyPlayedGames: [recentOption({
        uid: 'saved-game-1',
        savedGameId: 'saved-game-1',
        displayName: 'Simple Game',
        bggId: '12345'
      })],
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    const shortcut = result.current.recentTemplates[0];
    expect(shortcut.needsResolution).toBe(true);
    expect(shortcut.template.id).not.toBe('saved-game-1');
    expect(shortcut.template).toMatchObject({ name: 'Simple Game', bggId: '12345', columns: [] });
  });
});
