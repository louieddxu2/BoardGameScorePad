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

  it('deduplicates by BGG ID before applying the limit and keeps the latest play', () => {
    const options = [
      option('old-alias', 5000, 1, { displayName: 'Old Name', bggId: ' 123 ' }),
      option('other', 4000, 1, { bggId: '456' }),
      option('new-alias', 8000, 1, { displayName: 'New Name', bggId: '123' }),
      option('third', 3000, 1)
    ];

    expect(getRecentOptions(options, 2).map(item => item.uid)).toEqual(['new-alias', 'other']);
    expect(getRecentOptions(options, 3).map(item => item.uid)).toEqual(['new-alias', 'other', 'third']);
  });

  it('falls back to local template ID and normalized name without a BGG ID', () => {
    const options = [
      option('local-old', 2000, 1, { templateId: '8ABC1234', displayName: 'Old Title' }),
      option('local-new', 3000, 1, { templateId: '8abc1234', displayName: 'New Title' }),
      option('name-old', 4000, 1, { displayName: 'Simple  Game' }),
      option('name-new', 5000, 1, { displayName: ' simple game ' })
    ];

    expect(getRecentOptions(options, 5).map(item => item.uid)).toEqual(['name-new', 'local-new']);
  });

  it('keeps distinct games with conflicting BGG IDs even when their names match', () => {
    const options = [
      option('first', 4000, 1, { displayName: 'Shared Name', bggId: '123' }),
      option('second', 3000, 1, { displayName: 'Shared Name', bggId: '456' })
    ];

    expect(getRecentOptions(options, 5).map(item => item.uid)).toEqual(['first', 'second']);
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

  it('excludes pinned and active games across their alternate identities', () => {
    const options = [
      option('pinned-board', 0, 0, { savedGameId: undefined, isPinned: true, bggId: '123' }),
      option('active-board', 0, 0, { savedGameId: undefined, templateId: 'active-template', bggId: '456' }),
      option('pinned-alias', 9000, 1, { displayName: 'Another Name', bggId: '123' }),
      option('active-alias', 8000, 1, { displayName: 'Yet Another Name', bggId: '456' }),
      option('different-bgg', 7500, 1, { displayName: 'pinned-board', bggId: '789' }),
      option('eligible', 7000, 1)
    ];

    expect(getRecentOptions(options, 5, new Set(['active-template'])).map(item => item.uid))
      .toEqual(['different-bgg', 'eligible']);
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

  it('does not repeat a recent game in the popular recommendations', () => {
    const options = [
      option('recent', 9000, 1, { bggId: '123' }),
      option('popular-alias', 1000, 99, { displayName: 'Alias', bggId: '123' }),
      option('other-recent', 8000, 1, { bggId: '456' }),
      option('popular', 2000, 10, { bggId: '789' })
    ];

    expect(getRecommendations(options).filter(item => item.bggId === '123')).toHaveLength(1);
  });
});
