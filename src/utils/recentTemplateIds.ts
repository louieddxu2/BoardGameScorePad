export interface RecentGameSummary {
  templateId: string;
  gameName: string;
  bggId?: string;
}

export const normalizeRecentGameName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
};

interface IdentityBucket {
  hasGameWithoutBggId: boolean;
  bggIds: Set<string>;
}

const normalizeBggId = (bggId?: string): string => bggId?.trim().toLowerCase() ?? '';

const addToIdentityIndex = (
  index: Map<string, IdentityBucket>,
  key: string,
  bggId: string
): void => {
  if (!key) return;

  let bucket = index.get(key);
  if (!bucket) {
    bucket = { hasGameWithoutBggId: false, bggIds: new Set() };
    index.set(key, bucket);
  }

  if (bggId) bucket.bggIds.add(bggId);
  else bucket.hasGameWithoutBggId = true;
};

const identityBucketMatches = (bucket: IdentityBucket | undefined, bggId: string): boolean => {
  if (!bucket) return false;
  if (!bggId) return bucket.hasGameWithoutBggId || bucket.bggIds.size > 0;
  return bucket.hasGameWithoutBggId || bucket.bggIds.has(bggId);
};

export const selectRecentGames = <T extends RecentGameSummary>(
  mostRecentFirst: readonly T[],
  excludedTemplateIds: ReadonlySet<string>,
  limit: number,
  excludedGames: readonly RecentGameSummary[] = [],
  getBggId: (game: T) => string | undefined = game => game.bggId
): T[] => {
  if (limit <= 0) return [];

  const selectedGames: T[] = [];
  const seenBggIds = new Set<string>();
  const seenLocalIds = new Map<string, IdentityBucket>();
  const seenNames = new Map<string, IdentityBucket>();

  const rememberGame = (game: RecentGameSummary, bggId: string): void => {
    if (bggId) seenBggIds.add(bggId);
    addToIdentityIndex(seenLocalIds, game.templateId?.trim() ?? '', bggId);
    addToIdentityIndex(seenNames, normalizeRecentGameName(game.gameName), bggId);
  };

  excludedGames.forEach(game => rememberGame(game, normalizeBggId(game.bggId)));

  for (const game of mostRecentFirst) {
    const localGameId = game.templateId?.trim();
    const normalizedName = normalizeRecentGameName(game.gameName);
    if (!localGameId && !normalizedName) continue;

    const bggId = normalizeBggId(getBggId(game));
    if (bggId && seenBggIds.has(bggId)) continue;

    if (localGameId && excludedTemplateIds.has(localGameId)) {
      if (bggId) seenBggIds.add(bggId);
      continue;
    }

    const isDuplicate = identityBucketMatches(seenLocalIds.get(localGameId ?? ''), bggId)
      || identityBucketMatches(seenNames.get(normalizedName), bggId);
    if (isDuplicate) {
      // Preserve the BGG identity even when this row was collapsed by its local ID or name.
      if (bggId) seenBggIds.add(bggId);
      continue;
    }

    rememberGame(game, bggId);
    selectedGames.push(game);
    if (selectedGames.length === limit) break;
  }

  return selectedGames;
};
