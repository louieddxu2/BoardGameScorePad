export interface RecentGameSummary {
  templateId: string;
  gameName: string;
  bggId?: string;
}

export const selectRecentGames = <T extends RecentGameSummary>(
  mostRecentFirst: readonly T[],
  excludedTemplateIds: ReadonlySet<string>,
  limit: number
): T[] => {
  if (limit <= 0) return [];

  const selectedGames: T[] = [];
  const seenIds = new Set<string>();

  for (const game of mostRecentFirst) {
    const { templateId } = game;
    if (!templateId || seenIds.has(templateId) || excludedTemplateIds.has(templateId)) continue;

    seenIds.add(templateId);
    selectedGames.push(game);
    if (selectedGames.length === limit) break;
  }

  return selectedGames;
};
