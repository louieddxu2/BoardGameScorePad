import { describe, expect, it } from 'vitest';
import { selectRecentGames } from './recentTemplateIds';
import type { RecentGameSummary } from './recentTemplateIds';

describe('selectRecentGames', () => {
  const game = (
    templateId: string,
    gameName = `Game ${templateId}`,
    bggId?: string
  ): RecentGameSummary => ({ templateId, gameName, bggId });

  it('deduplicates case-insensitive BGG IDs and keeps the most recent template', () => {
    const newest = game('recent-new', 'Local Name', '123');
    const games = [newest, game('recent-copy', 'BGG Name', ' 123 '), game('other', 'Other', '456')];

    expect(selectRecentGames(games, new Set(), 5)).toEqual([newest, games[2]]);
  });

  it('deduplicates no-BGG games by local ID and then by normalized name', () => {
    const newestSimpleGame = game('simple-id', '  Enchanted   Ivy ');
    const games = [
      newestSimpleGame,
      game('simple-id', 'Renamed Enchanted Ivy'),
      game('simple-copy-id', 'enchanted ivy'),
      game('variant-a', 'Same Name', '100'),
      game('variant-b', 'same name', '200')
    ];

    expect(selectRecentGames(games, new Set(), 5)).toEqual([
      newestSimpleGame,
      games[3],
      games[4]
    ]);
  });

  it('keeps distinct known BGG IDs even when local IDs and names match', () => {
    const games = [
      game('same-local-id', 'Same Name', '100'),
      game('same-local-id', 'same name', '200')
    ];

    expect(selectRecentGames(games, new Set(), 5)).toEqual(games);
  });

  it('falls back to normalized names when local IDs are absent', () => {
    const games = [
      game('', '  Enchanted   Ivy '),
      game('', 'enchanted ivy')
    ];

    expect(selectRecentGames(games, new Set(), 5)).toEqual([games[0]]);
  });

  it('excludes pinned and active games by BGG ID, local ID, or name fallback', () => {
    const games = [
      game('pinned-copy', 'Pinned Game', '123'),
      game('active-template', 'Active Game'),
      game('no-bgg-pin-copy', 'No BGG pin', '789'),
      game('recent', 'Recent Game', '456')
    ];

    expect(selectRecentGames(
      games,
      new Set(['pinned-template', 'active-template']),
      5,
      [
        game('pinned-template', 'Pinned Game', '123'),
        game('active-template', ' active   game '),
        game('no-bgg-pin', 'No BGG pin')
      ]
    )).toEqual([games[3]]);
  });

  it('uses a recent-only BGG ID fallback when the extracted history summary omitted it', () => {
    const games: (RecentGameSummary & { snapshotBggId?: string })[] = [
      { ...game('snapshot-id', 'A Game'), snapshotBggId: '123' },
      game('same-game-copy', 'A Different Display Name', '123')
    ];

    expect(selectRecentGames(games, new Set(), 5, [], item => item.snapshotBggId ?? item.bggId))
      .toEqual([games[0]]);
  });

  it('returns fewer than the limit when fewer distinct eligible games exist', () => {
    const games = [game('pinned'), game('recent'), game('recent')];
    expect(selectRecentGames(games, new Set(['pinned']), 5)).toEqual([games[1]]);
  });

  it('fills the limit only after duplicate and excluded games have been skipped', () => {
    const games = [
      game('newest', 'Game A', '1'),
      game('copy', 'Game A copy', '1'),
      game('pinned-copy', 'Pinned', '2'),
      game('next', 'Game B', '3'),
      game('last', 'Game C', '4')
    ];

    expect(selectRecentGames(games, new Set(['pinned']), 2, [game('pinned', 'Pinned', '2')]))
      .toEqual([games[0], games[3]]);
  });

  it('returns no entries for a non-positive limit', () => {
    expect(selectRecentGames([game('recent')], new Set(), 0)).toEqual([]);
  });
});
