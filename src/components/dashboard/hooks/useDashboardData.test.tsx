import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameOption } from '../../../features/game-selector/types';
import type { GameTemplate } from '../../../types';
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

  it('uses a stable deterministic shortcut ID without generating random UUIDs', () => {
    const props = {
      userTemplates: [] as GameTemplate[],
      systemTemplates: [],
      pinnedIds: [],
      recentlyPlayedGames: [recentOption({
        uid: 'saved-game-1',
        savedGameId: 'saved-game-1',
        displayName: 'Simple Game',
        bggId: '12345',
        lastUsed: 1000
      })],
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    };
    const { result, rerender } = renderHook(
      ({ userTemplates }) => useDashboardData({ ...props, userTemplates }),
      { initialProps: { userTemplates: props.userTemplates } }
    );

    const initialShortcuts = result.current.recentTemplates;
    const shortcut = initialShortcuts[0];
    expect(shortcut.needsResolution).toBe(true);
    expect(shortcut.template.id).toBe('shortcut:saved-game-1');
    expect(shortcut.template.id).not.toBe('saved-game-1');
    expect(shortcut.template.createdAt).toBe(1000);
    expect(shortcut.template).toMatchObject({ name: 'Simple Game', bggId: '12345', columns: [] });

    // Changing the template index dependency forces recentTemplates to recompute.
    rerender({ userTemplates: [{ id: 'unrelated-template', name: 'Other Game', columns: [], createdAt: 1 }] });
    expect(result.current.recentTemplates).not.toBe(initialShortcuts);
    expect(result.current.recentTemplates[0].template.id).toBe('shortcut:saved-game-1');
  });

  it('fills the quick-start section to five games after pinned games', () => {
    const pinnedTemplates = [
      { id: 'pinned-1', name: 'Pinned One', columns: [], createdAt: 1 },
      { id: 'pinned-2', name: 'Pinned Two', columns: [], createdAt: 1 }
    ];
    const recentGames = Array.from({ length: 5 }, (_, index) => recentOption({
      uid: `recent-${index}`,
      savedGameId: `saved-${index}`,
      displayName: `Recent ${index}`,
      lastUsed: 1000 - index
    }));
    const { result } = renderHook(() => useDashboardData({
      userTemplates: pinnedTemplates,
      systemTemplates: [],
      pinnedIds: ['pinned-1', 'pinned-2'],
      recentlyPlayedGames: recentGames,
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    expect(result.current.pinnedTemplates).toHaveLength(2);
    expect(result.current.recentTemplates).toHaveLength(3);
  });

  it('keeps all pinned games when they exceed five and hides recent games', () => {
    const pinnedTemplates = Array.from({ length: 6 }, (_, index) => ({
      id: `pinned-${index}`,
      name: `Pinned ${index}`,
      columns: [],
      createdAt: 1
    }));
    const recentGames = [recentOption({ savedGameId: 'saved-1', lastUsed: 1000 })];
    const { result } = renderHook(() => useDashboardData({
      userTemplates: pinnedTemplates,
      systemTemplates: [],
      pinnedIds: pinnedTemplates.map(template => template.id),
      recentlyPlayedGames: recentGames,
      activeSessionIds: [],
      activeSessions: [],
      getSessionPreview: vi.fn(() => null)
    }));

    expect(result.current.pinnedTemplates).toHaveLength(6);
    expect(result.current.recentTemplates).toHaveLength(0);
  });
});
