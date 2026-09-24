import { describe, expect, it } from 'vitest';
import { selectRecentTemplateIds } from './recentTemplateIds';

describe('selectRecentTemplateIds', () => {
  it('selects the latest distinct available templates and skips pinned or active games', () => {
    const templateIds = [
      'recent-a', 'pinned', 'active', 'deleted', 'recent-b', 'recent-c', 'recent-d', 'recent-e', 'recent-f'
    ];

    expect(selectRecentTemplateIds(
      templateIds,
      new Set(['recent-a', 'pinned', 'active', 'recent-b', 'recent-c', 'recent-d', 'recent-e', 'recent-f']),
      new Set(['pinned', 'active']),
      5
    )).toEqual(['recent-a', 'recent-b', 'recent-c', 'recent-d', 'recent-e']);
  });

  it('returns fewer than the limit when fewer eligible templates exist', () => {
    expect(selectRecentTemplateIds(
      ['pinned', 'recent', 'recent'],
      new Set(['pinned', 'recent']),
      new Set(['pinned']),
      5
    )).toEqual(['recent']);
  });

  it('returns no entries for a non-positive limit', () => {
    expect(selectRecentTemplateIds(['recent'], new Set(['recent']), new Set(), 0)).toEqual([]);
  });
});
