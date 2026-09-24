export const selectRecentTemplateIds = (
  mostRecentFirst: readonly string[],
  availableTemplateIds: ReadonlySet<string>,
  excludedTemplateIds: ReadonlySet<string>,
  limit: number
): string[] => {
  if (limit <= 0) return [];

  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const templateId of mostRecentFirst) {
    if (!templateId || seenIds.has(templateId) || excludedTemplateIds.has(templateId)) continue;
    if (!availableTemplateIds.has(templateId)) continue;

    seenIds.add(templateId);
    selectedIds.push(templateId);
    if (selectedIds.length === limit) break;
  }

  return selectedIds;
};
