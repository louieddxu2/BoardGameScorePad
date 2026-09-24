export interface RecentGameSummary {
  templateId: string;
  gameName: string;
  bggId?: string;
}

export const normalizeRecentGameName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
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
  const seenNames = new Set<string>();
  const seenNamesWithoutBggId = new Set<string>();
  const seenFallbackTemplateIds = new Set<string>();

  const rememberGame = (game: RecentGameSummary, bggId = game.bggId) => {
    const normalizedBggId = bggId?.trim();
    const normalizedName = normalizeRecentGameName(game.gameName);
    if (normalizedBggId) seenBggIds.add(normalizedBggId);
    if (normalizedName) {
      seenNames.add(normalizedName);
      if (!normalizedBggId) seenNamesWithoutBggId.add(normalizedName);
    } else if (!normalizedBggId) {
      seenFallbackTemplateIds.add(game.templateId);
    }
  };

  excludedGames.forEach(game => rememberGame(game));

  for (const game of mostRecentFirst) {
    if (!game.templateId || excludedTemplateIds.has(game.templateId)) continue;

    const bggId = getBggId(game)?.trim();
    const normalizedName = normalizeRecentGameName(game.gameName);
    const isDuplicate = bggId
      ? seenBggIds.has(bggId) || (!!normalizedName && seenNamesWithoutBggId.has(normalizedName))
      : normalizedName
        ? seenNames.has(normalizedName)
        : seenFallbackTemplateIds.has(game.templateId);
    if (isDuplicate) continue;

    rememberGame(game, bggId);
    selectedGames.push(game);
    if (selectedGames.length === limit) break;
  }

  return selectedGames;
};
