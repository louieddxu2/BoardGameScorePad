import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { GameOption } from '../types';
import { useGameSelectorLogic } from './useGameSelectorLogic';

const match = (uid: string, score: number, recentMatch = false, maxPlayers = 8): GameOption => ({
  uid, displayName: `te ${uid}`, lastUsed: 1, usageCount: 1, isPinned: false,
  defaultPlayerCount: 4, defaultScoringRule: 'HIGHEST_WINS', _searchTokens: [`te ${uid}`],
  minPlayers: 1, maxPlayers,
  _searchRanking: { query: 'te', score, recentMatch, exactNameMatch: false }
});
beforeEach(() => { localStorage.removeItem('pref_search_advanced'); localStorage.removeItem('pref_search_filters'); });
afterEach(() => { localStorage.removeItem('pref_search_advanced'); localStorage.removeItem('pref_search_filters'); });

it('recomputes the protected prefix after advanced filters remove the original best match', () => {
  const options = [match('excluded', 0.001, false, 2), match('first', 0.02), match('second', 0.03), match('recent', 0.2, true)];
  const { result } = renderHook(() => useGameSelectorLogic(options, true, 'te', null, () => {}, 4));
  expect(result.current.processedOptions.slice(0, 2).map(option => option.uid)).toEqual(['excluded', 'recent']);
  act(() => {
    result.current.setIsAdvancedMode(true);
    result.current.setSearchFilters(filters => ({ ...filters, playerFilter: 'playable' }));
  });
  expect(result.current.processedOptions.slice(0, 3).map(option => option.uid)).toEqual(['first', 'second', 'recent']);
});

it('retains an explicit selection when recent eligibility updates without a query change', () => {
  const options = [match('first', 0.001), match('chosen', 0.002), match('third', 0.003), match('recent', 0.2)];
  const { result, rerender } = renderHook(({ options }) => {
    const [selected, setSelected] = useState<string | null>(null);
    return { ...useGameSelectorLogic(options, true, 'te', selected, setSelected), select: setSelected };
  }, { initialProps: { options } });
  act(() => { result.current.select('chosen'); });
  rerender({ options: options.map(option => option.uid === 'recent'
    ? { ...option, _searchRanking: { ...option._searchRanking!, recentMatch: true } } : option) });
  expect(result.current.processedOptions[0].uid).toBe('recent');
  expect(result.current.predictionTarget?.uid).toBe('chosen');
});
