import { describe, expect, it } from 'vitest';
import type { GameOption } from '../types';
import { getRecentOptions, getRecommendations } from './sortStrategies';

const option = (uid: string, lastUsed: number, usageCount = 0, overrides: Partial<GameOption> = {}): GameOption => ({
  uid,
  savedGameId: uid,
  displayName: uid,
  lastUsed,
  usageCount,
  isPinned: false,
  defaultPlayerCount: 4,
  defaultScoringRule: 'HIGHEST_WINS',
  _searchTokens: [uid],
  ...overrides
});

describe('getRecentOptions', () => {
  it('returns the same recency-ordered prefix for different display limits', () => {
    const options = [
      option('older', 1000),
      option('newest', 5000),
      option('middle', 3000),
      option('oldest', 500)
    ];

    expect(getRecentOptions(options, 2).map(item => item.uid)).toEqual(['newest', 'middle']);
    expect(getRecentOptions(options, 3).map(item => item.uid)).toEqual(['newest', 'middle', 'older']);
  });

  it('returns no items for a non-positive limit', () => {
    expect(getRecentOptions([option('game', 1)], 0)).toEqual([]);
  });

  it('does not treat unplayed saved games, templates, or catalog entries as recent', () => {
    const options = [
      option('unplayed-saved-game', 0, 0),
      option('edited-template', 9000, 0, { savedGameId: undefined, templateId: 'edited-template' }),
      option('catalog-game', 0, 0, { savedGameId: undefined, bggId: '12345' })
    ];

    expect(getRecentOptions(options, 5)).toEqual([]);
  });

  it('excludes pinned and active-template options consistently', () => {
    const options = [
      option('pinned', 6000, 1, { isPinned: true }),
      option('active', 5000, 1, { templateId: 'active-template' }),
      option('eligible', 4000, 1)
    ];

    expect(getRecentOptions(options, 5, new Set(['active-template'])).map(item => item.uid))
      .toEqual(['eligible']);
  });

  it('keeps the recommendation panel recent entries on the shared ordering', () => {
    const options = [
      option('frequent-old', 1000, 10),
      option('recent-a', 5000, 1),
      option('recent-b', 4000, 1),
      option('popular', 500, 8),
      option('other', 250, 2)
    ];

    const activeTemplateIds = new Set(['recent-b']);
    expect(getRecommendations(options, activeTemplateIds).slice(0, 1))
      .toEqual(getRecentOptions(options, 1, activeTemplateIds));
  });
});
