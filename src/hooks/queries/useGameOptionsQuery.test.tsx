import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate, SavedListItem } from '../../types';
import type { BggGameSummary } from '../../utils/extractDataSummaries';
import { useGameOptionsQuery } from './useGameOptionsQuery';

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
      displayName: `農家樂新版 (${name})`
    }]);
    expect(result.current.gameOptions[0]).toMatchObject({
      uid: 'saved-game', savedGameId: 'saved-game', bggId: '123',
      templateId: hasBoard ? 'board-123' : undefined,
      isPinned: true
    });
    expect(result.current.allOptions).toBe(allOptions);
    expect(original.displayName).toBe(name);
    expect(original.cleanName).toBeUndefined();
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
});
