export interface RecentGameSummary {
  templateId: string;
  gameName: string;
  bggId?: string;
}

export const normalizeRecentGameName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
};

const getGameKey = (game: RecentGameSummary, bggId = game.bggId): string => {
  const normalizedBggId = bggId?.trim();
  if (normalizedBggId) return `bgg:${normalizedBggId}`;

  const localGameId = game.templateId?.trim();
  if (localGameId) return `local:${localGameId}`;

  const normalizedName = normalizeRecentGameName(game.gameName);
  return normalizedName ? `name:${normalizedName}` : '';
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
  const seenGameKeys = new Set(excludedGames.map(game => getGameKey(game)).filter(Boolean));

  for (const game of mostRecentFirst) {
    const localGameId = game.templateId?.trim();
    if (!localGameId && !normalizeRecentGameName(game.gameName)) continue;

    const bggId = getBggId(game);
    if (!bggId?.trim() && localGameId && excludedTemplateIds.has(localGameId)) continue;

    const gameKey = getGameKey(game, bggId);
    if (!gameKey || seenGameKeys.has(gameKey)) continue;

    seenGameKeys.add(gameKey);
    selectedGames.push(game);
    if (selectedGames.length === limit) break;
  }

  return selectedGames;
};
