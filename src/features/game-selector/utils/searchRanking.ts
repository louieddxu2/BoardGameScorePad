import { DATA_LIMITS } from '../../../dataLimits';
import type { GameOption } from '../types';
import { getRecentIdentity, getRecentOptions, isSameGame } from './recentGameOptions';

export const SEARCH_SCORE_FLOOR = 0.01;
export const SEARCH_SCORE_MULTIPLIER = 3;

export const normalizeGameSearch = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Use undecorated names, comparing each alias separately rather than joining fields. */
export const getGameSearchNames = (option: GameOption): string[] => [
  option.displayName, ...option._searchTokens, option.cleanName || '', option.bggName || ''
].filter(Boolean).map(normalizeGameSearch);

/** Select the global window before searching/filtering; pins and active games stay eligible. */
export function getRecentSearchUids(options: GameOption[]): ReadonlySet<string> {
  const recent = getRecentOptions(options, DATA_LIMITS.QUERY.SEARCH_RECENT_GAMES, undefined, { includePinned: true });
  const selectedUids = new Set(recent.map(option => option.uid));
  const identities = recent.map(option => ({ option, identity: getRecentIdentity(option) }));
  const recentBggIds = new Set(identities.map(({ identity }) => identity.bggId).filter(Boolean));

  // Include alternate rows for the same played game without consuming another slot.
  for (const option of options) {
    if (selectedUids.has(option.uid)) continue;
    const identity = getRecentIdentity(option);
    if (identity.bggId && recentBggIds.has(identity.bggId)) {
      selectedUids.add(option.uid);
      continue;
    }
    if (identities.some(({ option: selected, identity: candidate }) => {
      if (!isSameGame(identity, candidate)) return false;
      if (identity.localIds.some(id => candidate.localIds.includes(id))) return true;
      return !option.ambiguousName && !selected.ambiguousName;
    })) selectedUids.add(option.uid);
  }
  return selectedUids;
}

/** Inspect at most three scores to identify a unique/pair of leading matches. */
export function getProtectedSearchCount(options: GameOption[], query: string): number | null {
  if (!options.length) return 0;
  const normalizedQuery = normalizeGameSearch(query);
  const first = options.slice(0, 3).map(option => option._searchRanking);
  if (!normalizedQuery || first.some(meta => meta?.query !== normalizedQuery
    || typeof meta.score !== 'number' || !Number.isFinite(meta.score) || meta.score < 0)) return null;
  const scores = first.map(meta => meta!.score!);
  if (scores.some((score, index) => index > 0 && score < scores[index - 1])) return null;
  const threshold = Math.max(SEARCH_SCORE_FLOOR, scores[0] * SEARCH_SCORE_MULTIPLIER);
  if (scores.length >= 3 && scores[2] <= threshold) return 0;
  return scores.length >= 2 && scores[1] <= threshold ? 2 : 1;
}

/** Stable partition after advanced filters, before display limits and the create row. */
export function rankGameSearchResults(options: GameOption[], query: string): GameOption[] {
  if (!options.length) return options;
  const protectedCount = getProtectedSearchCount(options, query);
  if (protectedCount === null) return options;
  const normalizedQuery = normalizeGameSearch(query);
  const recent: GameOption[] = [];
  const remaining: GameOption[] = [];
  for (let index = protectedCount; index < options.length; index++) {
    const option = options[index];
    const meta = option._searchRanking;
    // A raw input may be ahead of its debounced query; never mix query versions.
    if (meta?.query !== normalizedQuery || typeof meta.score !== 'number' || !Number.isFinite(meta.score) || meta.score < 0) return options;
    (meta.recentMatch ? recent : remaining).push(option);
  }
  return recent.length ? [...options.slice(0, protectedCount), ...recent, ...remaining] : options;
}
