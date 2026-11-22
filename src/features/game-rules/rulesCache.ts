/**
 * Local cache for game rules, so the cloud (30 requests per IP per minute) and
 * the rules site's D1 are read only when needed:
 *
 * - Summary (rule count and version) per BGG ID: kept 1 hour, including "no rules".
 * - Rules per base game: reused while their version equals the summary's and they
 *   are under 7 days old. Reviews, importance votes and external resources do not
 *   change the version, so the age limit is what eventually refreshes them.
 *
 * When a request fails, the last cached copy is returned with `stale: true`.
 * Concurrent requests for the same key share one network call.
 */
import { db } from '../../db';
import type { FilterableRule } from '../../shared/ruleFilter';
import { fetchGameRules, fetchRuleSummary, isRuleBggId, isRuleGameId } from './rulesApi';
import type { GameRule, GameRules, RuleSummary } from './types';

export const RULE_SUMMARY_TTL_MS = 60 * 60 * 1000;
export const RULE_CONTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedResult<T> {
  value: T;
  fetchedAt: number;
  /** The cloud could not be reached, so this is an older copy. */
  stale: boolean;
}

const inFlight = new Map<string, Promise<unknown>>();
const once = <T>(key: string, run: () => Promise<T>): Promise<T> => {
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const started = run().finally(() => inFlight.delete(key));
  inFlight.set(key, started);
  return started;
};

const storeSummary = (bggId: string, summary: RuleSummary | null, fetchedAt: number) =>
  db.ruleSummaries.put({ bggId, ruleGameId: summary?.ruleGameId ?? null, summary, fetchedAt });

/**
 * A game's rule count and version, from cache when under an hour old. null means
 * the rules site has no rules for it (also returned for IDs it would not accept).
 */
export const getRuleSummary = (
  bggId: string | undefined,
  options: { now?: number; force?: boolean } = {},
): Promise<CachedResult<RuleSummary | null>> => {
  const id = (bggId || '').trim();
  const now = options.now ?? Date.now();
  if (!isRuleBggId(id)) return Promise.resolve({ value: null, fetchedAt: now, stale: false });

  return once(`summary:${id}`, async () => {
    const cached = await db.ruleSummaries.get(id);
    if (cached && !options.force && now - cached.fetchedAt < RULE_SUMMARY_TTL_MS && cached.fetchedAt <= now) {
      return { value: cached.summary, fetchedAt: cached.fetchedAt, stale: false };
    }
    try {
      const summary = await fetchRuleSummary(id);
      await storeSummary(id, summary, now);
      return { value: summary, fetchedAt: now, stale: false };
    } catch (error) {
      if (cached) return { value: cached.summary, fetchedAt: cached.fetchedAt, stale: true };
      throw error;
    }
  });
};

/** Points every cached summary of this base game at what a rules read just found. */
const syncSummariesWith = async (gameId: string, rules: GameRules | null, now: number) => {
  const records = await db.ruleSummaries.where('ruleGameId').equals(gameId).toArray();
  const summary: RuleSummary | null = rules
    ? { ruleGameId: gameId, publishedRuleCount: rules.rules.length, ruleVersion: rules.ruleVersion }
    : null;
  const changed = records.filter((record) => record.summary?.ruleVersion !== summary?.ruleVersion
    || record.summary?.publishedRuleCount !== summary?.publishedRuleCount);
  if (changed.length) {
    await db.ruleSummaries.bulkPut(changed.map((record) => ({ ...record, ruleGameId: summary ? gameId : null, summary, fetchedAt: now })));
  }
};

/**
 * The rules a summary leads to. Reads the cloud only when the cached copy's version
 * differs from the summary's or is 7 days old. null when the game no longer has rules.
 */
export const getGameRules = (
  summary: RuleSummary,
  options: { now?: number; force?: boolean } = {},
): Promise<CachedResult<GameRules | null>> => {
  const gameId = summary.ruleGameId;
  const now = options.now ?? Date.now();
  if (!isRuleGameId(gameId)) return Promise.resolve({ value: null, fetchedAt: now, stale: false });

  return once(`rules:${gameId}:${summary.ruleVersion}`, async () => {
    const cached = await db.ruleContents.get(gameId);
    const current = cached && !options.force && cached.rules.ruleVersion === summary.ruleVersion
      && now - cached.fetchedAt < RULE_CONTENT_MAX_AGE_MS && cached.fetchedAt <= now;
    if (current) return { value: cached.rules, fetchedAt: cached.fetchedAt, stale: false };

    try {
      const rules = await fetchGameRules(gameId);
      if (rules) await db.ruleContents.put({ gameId, rules, fetchedAt: now });
      else await db.ruleContents.delete(gameId);
      // The summary may be up to an hour old; keep it in step so the next open does not read again.
      await syncSummariesWith(gameId, rules, now);
      return { value: rules, fetchedAt: now, stale: false };
    } catch (error) {
      if (cached) return { value: cached.rules, fetchedAt: cached.fetchedAt, stale: true };
      throw error;
    }
  });
};

export type FilterableGameRule = GameRule & FilterableRule;

/**
 * Rules with their tags joined from tagIds, ready for computeRuleFilter(rules, tags, view, query)
 * in src/shared/ruleFilter.ts; pass `rules.tags` as its publicTags. Order is kept.
 */
export const toFilterableRules = (rules: GameRules): FilterableGameRule[] => {
  const tags = new Map(rules.tags.map((tag) => [tag.id, tag]));
  return rules.rules.map((rule) => ({
    ...rule,
    tags: rule.tagIds.map((id) => tags.get(id)).filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
  }));
};

/** Removes all cached rules, e.g. when clearing local data. */
export const clearRulesCache = () => Promise.all([db.ruleSummaries.clear(), db.ruleContents.clear()]);
