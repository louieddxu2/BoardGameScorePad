/**
 * The cloud's rules routes, forwarded from the rules site and limited to 30
 * requests per IP per minute (scoreboard-api src/rulesProxy.ts). Callers go
 * through rulesCache.ts, which decides when a request is needed at all.
 */
import { CLOUD_SHARE_BASE_URL } from '../../services/cloudClient';
import type { GameRules, RuleSummary } from './types';

const REQUEST_TIMEOUT_MS = 15000;

/** Same formats the cloud and the rules site accept; anything else is never sent. */
export const isRuleBggId = (value: string): boolean => /^[1-9]\d{0,9}$/.test(value);
export const isRuleGameId = (value: string): boolean => /^[A-Za-z0-9_-]{1,100}$/.test(value);

export class RulesApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

const request = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${CLOUD_SHARE_BASE_URL}${path}`, { signal: controller.signal });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new RulesApiError(body?.error || `http_${response.status}`, response.status);
    return body as T;
  } catch (error) {
    if (error instanceof RulesApiError) throw error;
    throw new RulesApiError((error as Error)?.name === 'AbortError' ? 'timeout' : 'network_error', 0);
  } finally {
    clearTimeout(timer);
  }
};

/** null when the rules site has no listed game (or base game) for this BGG ID. */
export const fetchRuleSummary = async (bggId: string): Promise<RuleSummary | null> =>
  (await request<{ summary: RuleSummary | null }>(`/api/rules/summary?bggId=${encodeURIComponent(bggId)}`)).summary;

/** null when gameId is no longer a listed base game. */
export const fetchGameRules = async (gameId: string): Promise<GameRules | null> =>
  (await request<{ rules: GameRules | null }>(`/api/rules/game?gameId=${encodeURIComponent(gameId)}`)).rules;

/** The rules site's base URL (VITE_RULES_SITE_URL); without it, no rule links are offered. */
export const RULES_SITE_BASE_URL: string = (import.meta.env.VITE_RULES_SITE_URL || '').replace(/\/+$/, '');

/** Link to one rule on the rules site: /games/{slug}#rule-{id}. */
export const ruleSiteLink = (slug: string, ruleId?: string): string | undefined =>
  RULES_SITE_BASE_URL
    ? `${RULES_SITE_BASE_URL}/games/${encodeURIComponent(slug)}${ruleId ? `#rule-${encodeURIComponent(ruleId)}` : ''}`
    : undefined;
