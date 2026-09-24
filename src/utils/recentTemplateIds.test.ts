import { describe, expect, it } from 'vitest';
import { selectRecentGames } from './recentTemplateIds';
import type { RecentGameSummary } from './recentTemplateIds';

describe('selectRecentGames', () => {
  const game = (templateId: string): RecentGameSummary => ({
    templateId,
    gameName: `Game ${templateId}`,
    bggId: `bgg-${templateId}`
  });

  it('selects the latest distinct games, including entries without an available template', () => {
    const games = [
      game('recent-a'), game('pinned'), game('active'), game('missing'), game('recent-b'),
      game('recent-c'), game('recent-d'), game('recent-e'), game('recent-f')
    ];

    expect(selectRecentGames(
      games,
      new Set(['pinned', 'active']),
      5
    )).toEqual(games.filter(item => !['pinned', 'active', 'recent-f'].includes(item.templateId)).slice(0, 5));
  });

  it('returns fewer than the limit when fewer eligible templates exist', () => {
    const games = [game('pinned'), game('recent'), game('recent')];
    expect(selectRecentGames(
      games,
      new Set(['pinned']),
      5
    )).toEqual([games[1]]);
  });

  it('returns no entries for a non-positive limit', () => {
    expect(selectRecentGames([game('recent')], new Set(), 0)).toEqual([]);
  });
});
