import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTemplate, SavedListItem } from '../../types';
import type { BggGameSummary } from '../../utils/extractDataSummaries';
import { useGameOptionsQuery } from './useGameOptionsQuery';

const fixtures = vi.hoisted(() => ({
  templates: [] as GameTemplate[],
  systemTemplates: [] as GameTemplate[],
  templatesLoaded: true,
  savedGames: [] as SavedListItem[],
  savedGamesLoaded: true,
  bggGames: [] as BggGameSummary[] | undefined,
}));

vi.mock('./useTemplateQuery', () => ({
  useTemplateQuery: () => ({
    templates: fixtures.templates,
    systemTemplates: fixtures.systemTemplates,
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
});
