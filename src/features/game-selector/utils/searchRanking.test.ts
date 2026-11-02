import { describe, expect, it } from 'vitest';
import type { GameOption } from '../types';
import { getProtectedSearchCount, getRecentSearchUids, rankGameSearchResults } from './searchRanking';
import { getSearchResults } from './sortStrategies';

const option = (uid: string, overrides: Partial<GameOption> = {}): GameOption => ({
  uid, displayName: uid, savedGameId: uid, lastUsed: 1000, usageCount: 1, isPinned: false,
  defaultPlayerCount: 4, defaultScoringRule: 'HIGHEST_WINS', _searchTokens: [uid], ...overrides
});
const match = (uid: string, score: number, recentMatch = false): GameOption => option(uid, {
  _searchRanking: { query: 'te', score, recentMatch, exactNameMatch: false }
});
const uids = (options: GameOption[]) => options.map(option => option.uid);

describe('recent search window', () => {
  it('takes 50 distinct played games before searching, including pinned and active-board identities', () => {
    const games = Array.from({ length: 51 }, (_, index) => option(`played-${index}`, {
      lastUsed: 1000 - index, bggId: String(index), isPinned: index === 0,
      ...(index === 1 ? { templateId: 'active-board' } : {})
    }));
    const olderAlias = option('old-alias', { bggId: '0', lastUsed: 10 });
    const recent = getRecentSearchUids([
      option('unplayed', { lastUsed: 0 }),
      option('edited-board', { lastUsed: 9999, savedGameId: undefined }),
      ...games, olderAlias
    ]);
    expect(recent.size).toBe(51); // 50 games, with a second row for the same BGG game.
    expect(recent.has('played-0')).toBe(true);
    expect(recent.has('played-1')).toBe(true);
    expect(recent.has('played-49')).toBe(true);
    expect(recent.has('old-alias')).toBe(true);
    expect(recent.has('played-50')).toBe(false);
    expect(recent.has('unplayed')).toBe(false);
    expect(recent.has('edited-board')).toBe(false);
  });

  it('retains local/name aliases without merging conflicting BGG or ambiguous same-name games', () => {
    const recent = getRecentSearchUids([
      option('known', { bggId: '123', displayName: 'Shared Name' }),
      option('conflict', { bggId: '456', displayName: 'Shared Name', lastUsed: 0 }),
      option('uncertain', { displayName: 'Shared Name', ambiguousName: true, lastUsed: 0 }),
      option('local-new', { templateId: 'local', displayName: 'Local Title' }),
      option('local-old', { templateId: 'local', displayName: 'Old Local Title', lastUsed: 0 }),
      option('name-new', { displayName: 'Simple  Game' }),
      option('name-old', { displayName: ' simple game ', lastUsed: 0 })
    ]);
    expect(recent.has('conflict')).toBe(false);
    expect(recent.has('uncertain')).toBe(false);
    expect(recent.has('local-old')).toBe(true);
    expect(recent.has('name-old')).toBe(true);
  });
});

describe('leading-match protection and stable promotion', () => {
  it.each([
    { scores: [0.001, 0.007568, 0.01], count: 0 },
    { scores: [0.001, 0.007568, 0.02], count: 2 },
    { scores: [0.001, 0.02, 0.03], count: 1 },
    { scores: [0.1, 0.2, 0.3], count: 0 },
    { scores: [0.1, 0.2, 0.31], count: 2 },
    { scores: [0.1, 0.31, 0.4], count: 1 },
    { scores: [0.001], count: 1 },
    { scores: [0.001, 0.007568], count: 2 },
    { scores: [0.001, 0.02], count: 1 },
    { scores: [], count: 0 }
  ])('protects $count leading results for $scores', ({ scores, count }) => {
    expect(getProtectedSearchCount(scores.map((score, index) => match(String(index), score)), 'te')).toBe(count);
  });

  it.each([
    { scores: [0.001, 0.007568, 0.01], expected: ['recent-a', 'recent-b', 'first', 'second', 'third', 'ordinary'] },
    { scores: [0.001, 0.007568, 0.02], expected: ['first', 'second', 'recent-a', 'recent-b', 'third', 'ordinary'] },
    { scores: [0.001, 0.02, 0.03], expected: ['first', 'recent-a', 'recent-b', 'second', 'third', 'ordinary'] }
  ])('promotes behind only the protected prefix for $scores', ({ scores, expected }) => {
    const options = [match('first', scores[0]), match('second', scores[1]), match('third', scores[2]),
      match('ordinary', 0.2), match('recent-a', 0.3, true), match('recent-b', 0.4, true)];
    const originalOrder = uids(options);
    const ranked = rankGameSearchResults(options, ' TE ');
    expect(uids(ranked)).toEqual(expected);
    expect(uids(options)).toEqual(originalOrder);
    expect(new Set(ranked).size).toBe(options.length);
  });

  it('does not repeat a protected recent result or change short/empty result sets', () => {
    const options = [match('first', 0.001, true), match('ordinary', 0.1), match('recent', 0.2, true)];
    expect(uids(rankGameSearchResults(options, 'te'))).toEqual(['first', 'recent', 'ordinary']);
    expect(rankGameSearchResults(options.slice(0, 1), 'te')).toEqual(options.slice(0, 1));
    expect(rankGameSearchResults([], 'te')).toEqual([]);
  });

  it('keeps stale, unscored, invalid and whitespace-only queries in their original order', () => {
    const options = [match('first', 0.001), match('second', 0.002), match('third', 0.003), match('recent', 0.2, true)];
    expect(rankGameSearchResults(options, 'terra')).toBe(options);
    expect(rankGameSearchResults(options, '  ')).toBe(options);
    for (const score of [undefined, NaN, Infinity]) {
      const invalid = [...options, option('invalid', { _searchRanking: { query: 'te', score, recentMatch: false, exactNameMatch: false } })];
      expect(rankGameSearchResults(invalid, 'te')).toBe(invalid);
    }
    const missing = [option('legacy'), ...options];
    expect(rankGameSearchResults(missing, 'te')).toBe(missing);
  });

  it('promotes before the 5/20-row cap and leaves the create option last', () => {
    const options = Array.from({ length: 25 }, (_, index) => match(`result-${index}`, 0.001 + index * 0.001, index === 24));
    for (const limit of [5, 20]) {
      const results = getSearchResults(options, 'te', limit);
      expect(results).toHaveLength(limit + 1);
      expect(results[0]).toBe(options[24]);
      expect(results[results.length - 1]?.uid).toBe('__CREATE_NEW__');
    }
  });

  it('does not suggest a duplicate exact-name game when promotion puts that match below the display cap', () => {
    const exact = match('exact-name', 0.1);
    exact._searchRanking!.exactNameMatch = true;
    const options = [match('first', 0.001), match('second', 0.002), match('third', 0.003),
      exact, ...Array.from({ length: 6 }, (_, index) => match(`recent-${index}`, 0.2 + index * 0.01, true))];
    const results = getSearchResults(options, 'te', 5);
    expect(results.some(item => item.uid === exact.uid)).toBe(false);
    expect(results.some(item => item.uid === '__CREATE_NEW__')).toBe(false);
    expect(getSearchResults([], 'te')[0].uid).toBe('__CREATE_NEW__');
  });
});
