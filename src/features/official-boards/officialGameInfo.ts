/**
 * Game information that official catalog entries carry (aliases, English name,
 * players, ...), merged into the local BGG dictionary used by the start panel.
 * Devices without a BGG dictionary can then find official boards by any alias;
 * where the dictionary already knows a game, its own data stays and only the
 * aliases are combined.
 */
import type { BggGame } from '../../types';
import { extractBggGameSummary, type BggGameSummary } from '../../utils/extractDataSummaries';
import type { OfficialCatalogEntry, OfficialGameInfo } from './types';

/** What the cloud keeps from a local BGG dictionary entry; the Worker validates it again. */
export const toOfficialGameInfo = (game: BggGame): OfficialGameInfo => {
  const { id: _id, updatedAt: _updatedAt, rank: _rank, rating: _rating, ...info } = game;
  return info;
};

const distinct = (names: (string | undefined)[]): string[] => {
  const seen = new Set<string>();
  return names.filter((name): name is string => {
    const key = name?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** One info per BGG ID (both languages' entries carry the same one). */
const infoByBggId = (catalog: OfficialCatalogEntry[]): Map<string, OfficialGameInfo> => {
  const infos = new Map<string, OfficialGameInfo>();
  for (const entry of catalog) {
    if (entry.bggId && entry.game && typeof entry.game === 'object' && !infos.has(entry.bggId)) infos.set(entry.bggId, entry.game);
  }
  return infos;
};

/** The local dictionary plus official game info; returns the same array when nothing is added. */
export const mergeOfficialGameInfo = (
  bggGames: BggGameSummary[],
  catalog: OfficialCatalogEntry[]
): BggGameSummary[] => {
  const infos = infoByBggId(catalog);
  if (infos.size === 0) return bggGames;
  let changed = false;
  const merged = bggGames.map((game) => {
    const info = infos.get(game.id);
    if (!info) return game;
    infos.delete(game.id);
    const altNames = distinct([...game.altNames, info.name, ...(info.altNames ?? [])]).filter(
      (name) => name.toLowerCase() !== game.name.toLowerCase()
    );
    if (altNames.length === game.altNames.length) return game;
    changed = true;
    return extractBggGameSummary({ ...(game as unknown as BggGame), altNames });
  });
  for (const [bggId, info] of infos) {
    const names = distinct([info.name, ...(info.altNames ?? [])]);
    if (names.length === 0) continue;
    changed = true;
    const [name, ...altNames] = names;
    merged.push(extractBggGameSummary({ ...info, id: bggId, name, altNames, updatedAt: 0 } as BggGame));
  }
  return changed ? merged : bggGames;
};
