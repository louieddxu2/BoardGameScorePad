import type { GameTemplate } from '../types';

const normalizeRecentGameName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
};

export interface RecentGameTemplateIdentity {
  gameName: string;
  bggId?: string;
}

/** Resolve a recent history item only when its name/BoardGameGeek identity is unambiguous. */
export const resolveRecentGameTemplate = (
  templates: readonly GameTemplate[],
  identity: RecentGameTemplateIdentity
): GameTemplate | null => {
  const normalizedName = normalizeRecentGameName(identity.gameName);
  if (!normalizedName) return null;

  const seenIds = new Set<string>();
  const sameName = templates.filter(template => {
    if (seenIds.has(template.id) || normalizeRecentGameName(template.name) !== normalizedName) return false;
    seenIds.add(template.id);
    return true;
  });

  const normalizedBggId = identity.bggId?.trim();
  if (!normalizedBggId) return sameName.length === 1 ? sameName[0] : null;

  const sameBggId = sameName.filter(template => template.bggId?.trim() === normalizedBggId);
  if (sameBggId.length === 1) return sameBggId[0];
  if (sameBggId.length > 1) return null;

  // A unique same-name template without a BGG ID is a safe fallback; a conflicting
  // or ambiguous identity is not, since opening it could use another game's board.
  return sameName.length === 1 && !sameName[0].bggId?.trim() ? sameName[0] : null;
};
