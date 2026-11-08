import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate, SavedListItem } from '../../types';
import type { BggGameSummary } from '../../utils/extractDataSummaries';
import { useGameOptionsQuery } from './useGameOptionsQuery';
import { getSearchResults } from '../../features/game-selector/utils/sortStrategies';

const fixtures = vi.hoisted(() => ({
  templates: [] as GameTemplate[],
  systemTemplates: [] as GameTemplate[],
  hiddenTemplateIdentities: [] as Pick<GameTemplate, 'id' | 'name' | 'bggId'>[],
  templatesLoaded: true,
  savedGames: [] as SavedListItem[],
  savedGamesLoaded: true,
  bggGames: [] as BggGameSummary[] | undefined,
}));

vi.mock('./useTemplateQuery', () => ({
  useTemplateQuery: () => ({
    templates: fixtures.templates,
    systemTemplates: fixtures.systemTemplates,
    hiddenTemplateIdentities: fixtures.hiddenTemplateIdentities,
    templatesLoaded: fixtures.templatesLoaded
  }),
}));
vi.mock('./useSavedGameQuery', () => ({
  useSavedGameQuery: () => ({ savedGames: fixtures.savedGames, savedGamesLoaded: fixtures.savedGamesLoaded }),
}));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => fixtures.bggGames }));

describe('useGameOptionsQuery', () => {
  beforeEach(() => {
    fixtures.templates = [];
    fixtures.systemTemplates = [];
    fixtures.hiddenTemplateIdentities = [];
    fixtures.templatesLoaded = true;
    fixtures.savedGames = [];
    fixtures.savedGamesLoaded = true;
    fixtures.bggGames = [];
  });

  it('keeps aggregated options stable when its source data has not changed', () => {
    const pinnedIds: string[] = [];
    const { result, rerender } = renderHook(() => useGameOptionsQuery('', pinnedIds));
    const first = result.current.allOptions;

    rerender();

    expect(result.current.allOptions).toBe(first);
  });

  it('shows one searchable option for saved aliases sharing a BGG ID', () => {
    fixtures.savedGames = [
      { id: 'zh', name: '邏輯與知識', bggId: '410238', lastUsed: 5000, usageCount: 2 },
      { id: 'en', name: 'Logic & lore', bggId: '410238', lastUsed: 1000, usageCount: 1 },
    ];
    fixtures.bggGames = [{ id: '410238', name: 'Logic & Lore', altNames: ['邏輯與知識'],
      _searchName: 'Logic & Lore', _altNames: '邏輯與知識', minPlayers: 2, maxPlayers: 2 }];
    const pinnedIds: string[] = [];
    const { result, rerender } = renderHook(({ query }) => useGameOptionsQuery(query, pinnedIds), {
      initialProps: { query: 'Logic & lore' },
    });
    expect(result.current.gameOptions).toHaveLength(1);
    expect(result.current.gameOptions[0]).toMatchObject({ savedGameId: 'zh', bggId: '410238', minPlayers: 2 });
    rerender({ query: '邏輯與知識' });
    expect(result.current.gameOptions).toHaveLength(1);
    expect(result.current.gameOptions[0]).toMatchObject({ savedGameId: 'zh', bggId: '410238' });
  });

  it.each([true, false])('preserves game identity when a matching alias changes its label (has board: %s)', hasBoard => {
    const name = 'Agricola (Revised Edition)';
    if (hasBoard) {
      fixtures.templates = [{ id: 'board-123', name, bggId: '123', columns: [], createdAt: 1 }];
    }
    fixtures.savedGames = [{ id: 'saved-game', name, bggId: '123', lastUsed: 5000, usageCount: 1 }];
    fixtures.bggGames = [{
      id: '123', name, altNames: ['田園大師', '農家樂新版'],
      _searchName: name, _altNames: '田園大師|農家樂新版'
    }];
    const pinnedIds = [hasBoard ? 'board-123' : 'saved-game'];
    const { result, rerender } = renderHook(
      ({ query }) => useGameOptionsQuery(query, pinnedIds),
      { initialProps: { query: '' } }
    );
    const allOptions = result.current.allOptions;
    expect(allOptions).toHaveLength(1);
    const original = allOptions[0];

    rerender({ query: '農家樂新版' });

    expect(result.current.gameOptions).toEqual([{
      ...original,
      cleanName: '農家樂新版',
      displayName: `農家樂新版 (${name})`,
      _searchRanking: { query: '農家樂新版', score: expect.any(Number), recentMatch: true, exactNameMatch: true }
    }]);
    expect(result.current.gameOptions[0]).toMatchObject({
      uid: 'saved-game', savedGameId: 'saved-game', bggId: '123',
      templateId: hasBoard ? 'board-123' : undefined,
      isPinned: true
    });
    expect(result.current.allOptions).toBe(allOptions);
    expect(original.displayName).toBe(name);
    expect(original.cleanName).toBeUndefined();
    expect(original._searchRanking).toBeUndefined();
  });

  it('waits for template and BGG queries before allowing a name-only association', () => {
    fixtures.templates = [{ id: 'board-123', name: 'Shared Name', bggId: '123', columns: [], createdAt: 1 }];
    fixtures.savedGames = [{ id: 'saved-game', name: 'Shared Name', lastUsed: 5000, usageCount: 1 }];
    fixtures.templatesLoaded = false;
    fixtures.bggGames = undefined;
    const { result, rerender } = renderHook(() => useGameOptionsQuery('', []));
    const recent = () => result.current.allOptions.find(option => option.savedGameId === 'saved-game');

    expect(recent()).toMatchObject({ templateId: undefined, ambiguousName: true, nameMatchPending: true });
    fixtures.templatesLoaded = true;
    rerender();
    expect(recent()).toMatchObject({ templateId: undefined, ambiguousName: true, nameMatchPending: true });
    fixtures.bggGames = [{
      id: '456', name: 'Other Name', altNames: ['Shared Name'],
      _searchName: 'Other Name', _altNames: 'Shared Name'
    }];
    rerender();
    expect(recent()).toMatchObject({ templateId: undefined, ambiguousName: true, nameMatchPending: false });
    fixtures.bggGames = [];
    rerender();
    expect(recent()).toMatchObject({ templateId: 'board-123', ambiguousName: false, nameMatchPending: false });
  });

  it('keeps a hidden simple board out of options but includes it in name ambiguity checks', () => {
    fixtures.templates = [{ id: 'visible-board', name: 'Shared Name', bggId: '123', columns: [], createdAt: 1 }];
    fixtures.hiddenTemplateIdentities = [{ id: 'hidden-simple', name: 'Shared Name', bggId: '456' }];
    fixtures.savedGames = [{ id: 'saved-game', name: 'Shared Name', lastUsed: 5000, usageCount: 1 }];

    const { result } = renderHook(() => useGameOptionsQuery('', []));

    expect(result.current.allOptions.find(option => option.savedGameId === 'saved-game')).toMatchObject({
      templateId: undefined, ambiguousName: true
    });
    expect(result.current.allOptions.some(option => option.templateId === 'hidden-simple')).toBe(false);
  });

  it('marks recent literal matches before label decoration and leaves fuzzy-only matches ordinary', () => {
    fixtures.savedGames = [{ id: 'played', name: 'Terraforming Mars', lastUsed: 1000, usageCount: 1 }];
    const pinnedIds: string[] = [];
    const { result, rerender } = renderHook(({ query }) => useGameOptionsQuery(query, pinnedIds), {
      initialProps: { query: '  TERRAFORMING   Mars  ' }
    });
    expect(result.current.gameOptions[0]._searchRanking).toEqual({
      query: 'terraforming mars', score: expect.any(Number), recentMatch: true, exactNameMatch: true
    });
    rerender({ query: 'Terraforming Marss' });
    expect(result.current.gameOptions[0]._searchRanking).toMatchObject({ recentMatch: false, exactNameMatch: false });
    rerender({ query: 'Mars Terraforming' });
    expect(result.current.gameOptions[0]._searchRanking?.recentMatch).toBe(false);
    rerender({ query: ' \t ' });
    expect(result.current.gameOptions).toBe(result.current.allOptions);
    expect(result.current.gameOptions[0]._searchRanking).toBeUndefined();
  });

  it('keeps the recent window global across queries and refreshes it only when play data changes', () => {
    fixtures.savedGames = Array.from({ length: 51 }, (_, index) => ({
      id: `played-${index}`, name: index === 50 ? 'Old Orchard Comets' : `Recent Lagoon ${index}`,
      lastUsed: 1000 - index, usageCount: 1
    }));
    const pinnedIds: string[] = [];
    const { result, rerender } = renderHook(({ query }) => useGameOptionsQuery(query, pinnedIds), {
      initialProps: { query: 'Old Orchard Comets' }
    });
    expect(result.current.gameOptions[0]._searchRanking?.recentMatch).toBe(false);
    fixtures.savedGames = fixtures.savedGames.map(game => game.id === 'played-50' ? { ...game, lastUsed: 2000 } : game);
    rerender({ query: 'Old Orchard Comets' });
    expect(result.current.gameOptions[0]._searchRanking?.recentMatch).toBe(true);
  });

  it.each([
    { leaders: ['Telestrations', 'Tend', 'Terminus'], expectedPrefix: ['Sky Team', 'Telestrations'] },
    { leaders: ['Telestrations', 'Terraforming Mars'], expectedPrefix: ['Telestrations', 'Terraforming Mars', 'Sky Team'] },
    { leaders: ['Telestrations'], expectedPrefix: ['Telestrations', 'Sky Team'] }
  ])('ranks the real English te matches behind the protected prefix: $leaders', ({ leaders, expectedPrefix }) => {
    fixtures.savedGames = [{ id: 'played-sky', name: 'Sky Team', bggId: 'sky', lastUsed: 1000, usageCount: 1 }];
    fixtures.bggGames = [...leaders, 'Bites', 'Sky Team'].map((name, index) => ({
      id: name === 'Sky Team' ? 'sky' : `catalog-${index}`, name, altNames: [], _searchName: name, _altNames: ''
    }));
    const { result } = renderHook(() => useGameOptionsQuery('te', []));
    const results = getSearchResults(result.current.gameOptions, 'te');
    expect(results.slice(0, expectedPrefix.length).map(option => option.displayName)).toEqual(expectedPrefix);
    expect(results.find(option => option.uid === 'played-sky')).toMatchObject({ savedGameId: 'played-sky', bggId: 'sky' });
  });
});
