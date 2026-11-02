import type { GameOption } from '../types';

interface RecentOptionIdentity {
  bggId: string;
  localIds: string[];
  name: string;
}

export const getRecentIdentity = (option: GameOption): RecentOptionIdentity => ({
  bggId: option.bggId?.trim().toLowerCase() || '',
  localIds: [option.savedGameId, option.templateId]
    .filter((id): id is string => !!id?.trim())
    .map(id => id.trim().toLowerCase()),
  name: (option.cleanName || option.displayName).trim().replace(/\s+/g, ' ').toLowerCase()
});

export const isSameGame = (a: RecentOptionIdentity, b: RecentOptionIdentity): boolean => {
  // Conflicting known BGG IDs must never be collapsed by a shared name or local ID.
  if (a.bggId && b.bggId) return a.bggId === b.bggId;
  if (a.localIds.some(id => b.localIds.includes(id))) return true;
  return !!a.name && a.name === b.name;
};

interface ExcludedIdentityBucket {
  bggIds: Set<string>;
  hasUnknownBgg: boolean;
}

const addExcludedIdentity = (index: Map<string, ExcludedIdentityBucket>, key: string, bggId: string): void => {
  if (!key) return;
  let bucket = index.get(key);
  if (!bucket) {
    bucket = { bggIds: new Set(), hasUnknownBgg: false };
    index.set(key, bucket);
  }
  if (bggId) bucket.bggIds.add(bggId);
  else bucket.hasUnknownBgg = true;
};

const matchesExcludedIdentity = (bucket: ExcludedIdentityBucket | undefined, bggId: string): boolean =>
  !!bucket && (!bggId || bucket.hasUnknownBgg || bucket.bggIds.has(bggId));

/**
 * Select distinct recently played games before applying the display limit.
 * Only played options are retained; the full BGG dictionary is never sorted.
 * The exclusion indexes and bounded insertion keep this O(n + played * limit).
 */
export const getRecentOptions = (
  options: GameOption[],
  limit: number,
  excludedTemplateIds: ReadonlySet<string> = new Set(),
  { includePinned = false }: { includePinned?: boolean } = {}
): GameOption[] => {
  if (limit <= 0) return [];

  const excludedBggIds = new Set<string>();
  const excludedLocalIds = new Map<string, ExcludedIdentityBucket>();
  const excludedNames = new Map<string, ExcludedIdentityBucket>();
  const candidates: { option: GameOption; identity: RecentOptionIdentity }[] = [];
  for (const option of options) {
    const isExcluded = (!includePinned && option.isPinned) || !!(option.templateId && excludedTemplateIds.has(option.templateId));
    if (!isExcluded && (!option.savedGameId || option.lastUsed <= 0)) continue;
    const identity = getRecentIdentity(option);
    if (isExcluded) {
      if (identity.bggId) excludedBggIds.add(identity.bggId);
      identity.localIds.forEach(id => addExcludedIdentity(excludedLocalIds, id, identity.bggId));
      addExcludedIdentity(excludedNames, identity.name, identity.bggId);
    } else {
      candidates.push({ option, identity });
    }
  }

  const recent: typeof candidates = [];
  for (const candidate of candidates) {
    const { bggId, localIds, name } = candidate.identity;
    if ((bggId && excludedBggIds.has(bggId))
      || localIds.some(id => matchesExcludedIdentity(excludedLocalIds.get(id), bggId))
      // A same-name pinned board cannot identify a BGG-less ambiguous history entry.
      || (!candidate.option.ambiguousName && matchesExcludedIdentity(excludedNames.get(name), bggId))) continue;

    const duplicateAt = recent.findIndex(existing => isSameGame(candidate.identity, existing.identity));
    if (duplicateAt >= 0) {
      if (candidate.option.lastUsed <= recent[duplicateAt].option.lastUsed) continue;
      recent.splice(duplicateAt, 1);
    }

    const insertAt = recent.findIndex(existing => candidate.option.lastUsed > existing.option.lastUsed);
    if (insertAt < 0) recent.push(candidate);
    else recent.splice(insertAt, 0, candidate);

    if (recent.length > limit) recent.pop();
  }

  return recent.map(({ option }) => option);
};

