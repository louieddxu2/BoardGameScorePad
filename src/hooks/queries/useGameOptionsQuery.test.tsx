import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGameOptionsQuery } from './useGameOptionsQuery';

const fixtures = vi.hoisted(() => ({
  templates: [],
  systemTemplates: [],
  savedGames: [],
  bggGames: [],
}));

vi.mock('./useTemplateQuery', () => ({
  useTemplateQuery: () => ({ templates: fixtures.templates, systemTemplates: fixtures.systemTemplates }),
}));
vi.mock('./useSavedGameQuery', () => ({
  useSavedGameQuery: () => ({ savedGames: fixtures.savedGames }),
}));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => fixtures.bggGames }));

describe('useGameOptionsQuery', () => {
  it('keeps aggregated options stable when its source data has not changed', () => {
    const pinnedIds: string[] = [];
    const { result, rerender } = renderHook(() => useGameOptionsQuery('', pinnedIds));
    const first = result.current.allOptions;

    rerender();

    expect(result.current.allOptions).toBe(first);
  });
});
