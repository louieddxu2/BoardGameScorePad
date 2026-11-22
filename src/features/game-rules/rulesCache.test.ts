import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { computeRuleFilter } from '../../shared/ruleFilter';
import {
  getGameRules,
  getRuleSummary,
  RULE_CONTENT_MAX_AGE_MS,
  RULE_SUMMARY_TTL_MS,
  toFilterableRules,
} from './rulesCache';
import type { GameRules, RuleSummary } from './types';

const HOUR = 60 * 60 * 1000;
const T0 = 1_800_000_000_000;

const rulesOf = (ruleVersion: string, count = 2): GameRules => ({
  gameId: 'catan',
  slug: 'catan',
  displayName: '卡坦島',
  englishName: 'Catan',
  ruleVersion,
  rules: Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    statement: i === 0 ? '擲出 7 點時移動強盜' : '道路不能穿過別人的聚落',
    categories: [],
    playerCounts: i === 0 ? [3, 4] : [],
    editionNotes: [],
    sourceLinks: [],
    reviewStatus: 'reviewed' as const,
    importanceCount: 0,
    tagIds: i === 0 ? ['t-robber'] : [],
    createdAt: 1,
    updatedAt: 1,
  })),
  tags: [{ id: 't-robber', name: '強盜', categoryHints: ['action_effect_detail'], detectionKeywords: [] }],
  externalResources: [],
});

/** A fake cloud: the current summary per BGG ID and rules per game, recording each request path. */
const cloud = () => {
  const summaries = new Map<string, RuleSummary | null>();
  const games = new Map<string, GameRules | null>();
  const calls: string[] = [];
  let failing = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    calls.push(`${url.pathname}?${url.searchParams}`);
    if (failing) throw new TypeError('Failed to fetch');
    if (url.pathname === '/api/rules/summary') {
      return Response.json({ summary: summaries.get(url.searchParams.get('bggId')!) ?? null });
    }
    return Response.json({ rules: games.get(url.searchParams.get('gameId')!) ?? null });
  });
  return {
    calls,
    publish(version: string, count = 2, bggIds = ['13']) {
      for (const bggId of bggIds) summaries.set(bggId, { ruleGameId: 'catan', publishedRuleCount: count, ruleVersion: version });
      games.set('catan', rulesOf(version, count));
    },
    remove() {
      summaries.clear();
      games.set('catan', null);
    },
    fail(value: boolean) {
      failing = value;
    },
  };
};

describe('rule summary cache', () => {
  beforeEach(() => Promise.all([db.ruleSummaries.clear(), db.ruleContents.clear()]));
  afterEach(() => vi.restoreAllMocks());

  it('reads the cloud once per hour per BGG ID', async () => {
    const site = cloud();
    site.publish('v1');
    expect((await getRuleSummary('13', { now: T0 })).value?.publishedRuleCount).toBe(2);
    await getRuleSummary('13', { now: T0 + RULE_SUMMARY_TTL_MS - 1 });
    expect(site.calls).toHaveLength(1);

    site.publish('v2', 3);
    expect((await getRuleSummary('13', { now: T0 + RULE_SUMMARY_TTL_MS })).value?.publishedRuleCount).toBe(3);
    expect(site.calls).toHaveLength(2);
  });

  it('remembers that a game has no rules, and never sends IDs the cloud would refuse', async () => {
    const site = cloud();
    expect((await getRuleSummary('999', { now: T0 })).value).toBeNull();
    expect((await getRuleSummary('999', { now: T0 + HOUR / 2 })).value).toBeNull();
    for (const id of [undefined, '', '0', 'abc', '12.5']) expect((await getRuleSummary(id, { now: T0 })).value).toBeNull();
    expect(site.calls).toEqual(['/api/rules/summary?bggId=999']);
  });

  it('shares one request between concurrent callers', async () => {
    const site = cloud();
    site.publish('v1');
    await Promise.all([getRuleSummary('13', { now: T0 }), getRuleSummary('13', { now: T0 })]);
    expect(site.calls).toHaveLength(1);
  });

  it('falls back to the cached summary when the cloud cannot be reached', async () => {
    const site = cloud();
    site.publish('v1');
    await getRuleSummary('13', { now: T0 });
    site.fail(true);
    const result = await getRuleSummary('13', { now: T0 + 2 * HOUR });
    expect(result).toEqual({ value: expect.objectContaining({ ruleVersion: 'v1' }), fetchedAt: T0, stale: true });
    await expect(getRuleSummary('42', { now: T0 })).rejects.toMatchObject({ code: 'network_error' });
  });
});

describe('rule content cache', () => {
  beforeEach(() => Promise.all([db.ruleSummaries.clear(), db.ruleContents.clear()]));
  afterEach(() => vi.restoreAllMocks());

  it('reuses rules while the version matches and they are under 7 days old', async () => {
    const site = cloud();
    site.publish('v1');
    const summary = (await getRuleSummary('13', { now: T0 })).value!;
    await getGameRules(summary, { now: T0 });
    await getGameRules(summary, { now: T0 + RULE_CONTENT_MAX_AGE_MS - 1 });
    expect(site.calls.filter((call) => call.startsWith('/api/rules/game'))).toHaveLength(1);

    await getGameRules(summary, { now: T0 + RULE_CONTENT_MAX_AGE_MS });
    expect(site.calls.filter((call) => call.startsWith('/api/rules/game'))).toHaveLength(2);
  });

  it('reads again when the summary reports a new version', async () => {
    const site = cloud();
    site.publish('v1');
    await getGameRules((await getRuleSummary('13', { now: T0 })).value!, { now: T0 });
    site.publish('v2', 3);
    const summary = (await getRuleSummary('13', { now: T0 + 2 * HOUR })).value!;
    const result = await getGameRules(summary, { now: T0 + 2 * HOUR });
    expect(result.value?.rules).toHaveLength(3);
    expect(site.calls.filter((call) => call.startsWith('/api/rules/game'))).toHaveLength(2);
  });

  it('shares rules between BGG IDs of the same base game and brings their summaries up to date', async () => {
    const site = cloud();
    site.publish('v1', 2, ['13', '926']);
    await getRuleSummary('926', { now: T0 });
    const summary = (await getRuleSummary('13', { now: T0 })).value!;
    site.publish('v2', 3, ['13', '926']);

    // Within the hour the summary still says v1; the rules read finds v2 and updates both summaries.
    const result = await getGameRules(summary, { now: T0 + 1000 });
    expect(result.value?.ruleVersion).toBe('v2');
    expect((await getRuleSummary('926', { now: T0 + 2000 })).value).toMatchObject({ ruleVersion: 'v2', publishedRuleCount: 3 });
    const next = (await getRuleSummary('13', { now: T0 + 2000 })).value!;
    await getGameRules(next, { now: T0 + 2000 });
    expect(site.calls.filter((call) => call.startsWith('/api/rules/game'))).toHaveLength(1);
  });

  it('drops cached rules when the game no longer has any', async () => {
    const site = cloud();
    site.publish('v1');
    const summary = (await getRuleSummary('13', { now: T0 })).value!;
    await getGameRules(summary, { now: T0 });
    site.remove();
    expect((await getGameRules(summary, { now: T0 + RULE_CONTENT_MAX_AGE_MS })).value).toBeNull();
    expect(await db.ruleContents.get('catan')).toBeUndefined();
    expect((await getRuleSummary('13', { now: T0 + RULE_CONTENT_MAX_AGE_MS })).value).toBeNull();
  });

  it('keeps showing cached rules when the cloud cannot be reached', async () => {
    const site = cloud();
    site.publish('v1');
    const summary = (await getRuleSummary('13', { now: T0 })).value!;
    await getGameRules(summary, { now: T0 });
    site.fail(true);
    const result = await getGameRules(summary, { now: T0 + RULE_CONTENT_MAX_AGE_MS });
    expect(result.stale).toBe(true);
    expect(result.value?.ruleVersion).toBe('v1');
  });
});

describe('filterable rules', () => {
  it('joins tags by tagIds so the shared filter can use them', () => {
    const rules = rulesOf('v1');
    const filterable = toFilterableRules(rules);
    expect(filterable[0].tags.map((tag) => tag.name)).toEqual(['強盜']);
    const result = computeRuleFilter(filterable, rules.tags, { category: 'action_effect_detail', tags: [], playerCounts: [], editions: [] }, '');
    expect(result.filteredRules.map((rule) => rule.id)).toEqual(['r1']);
    expect(computeRuleFilter(filterable, rules.tags, { category: 'all', tags: [], playerCounts: [], editions: [] }, '七').filteredRules.map((rule) => rule.id)).toEqual(['r1']);
  });
});
