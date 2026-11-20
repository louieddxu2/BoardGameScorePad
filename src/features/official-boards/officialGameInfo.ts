/**
 * Names of official games merged into the local BGG dictionary used by the
 * start panel, so devices without a BGG dictionary can find official boards by
 * any of a game's names. For each BGG ID the names are:
 * - the rules site's names that the cloud keeps (catalog entry `game`), and
 * - the official boards' own names and English names in every language,
 *   which every device already has in its synced catalog.
 * Where the local dictionary knows a game, its own data stays and only the
 * names are added.
 */
import type { BggGame } from '../../types';
import { extractBggGameSummary, type BggGameSummary } from '../../utils/extractDataSummaries';
import type { OfficialCatalogEntry } from './types';

const isLatin = (value: string) => /^[\x20-\x7E]+$/.test(value);

const distinct = (names: (string | null | undefined)[]): string[] => {
  const seen = new Set<string>();
  return names.filter((name): name is string => {
    const key = name?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Every name of each official game, with an English name first when one is known. */
const namesByBggId = (catalog: OfficialCatalogEntry[]): Map<string, { name?: string; names: string[] }> => {
  const grouped = new Map<string, OfficialCatalogEntry[]>();
  for (const entry of catalog) {
    if (entry.bggId) grouped.set(entry.bggId, [...(grouped.get(entry.bggId) ?? []), entry]);
  }
  const out = new Map<string, { name?: string; names: string[] }>();
  for (const [bggId, entries] of grouped) {
    const game = entries.find((e) => e.game && typeof e.game === 'object')?.game ?? undefined;
    const boardNames = entries.flatMap((e) => [e.enName, e.name]);
    const names = distinct([game?.name, ...(game?.altNames ?? []), ...boardNames]);
    const name = game?.name ?? distinct([...entries.map((e) => e.enName), ...entries.map((e) => e.name)]).find(isLatin);
    if (names.length) out.set(bggId, { name, names });
  }
  return out;
};

/** The local dictionary plus official games' names; returns the same array when nothing is added. */
export const mergeOfficialGameInfo = (
  bggGames: BggGameSummary[],
  catalog: OfficialCatalogEntry[]
): BggGameSummary[] => {
  const official = namesByBggId(catalog);
  if (official.size === 0) return bggGames;
  let changed = false;
  const merged = bggGames.map((game) => {
    const found = official.get(game.id);
    if (!found) return game;
    official.delete(game.id);
    const altNames = distinct([...game.altNames, ...found.names]).filter((name) => name.toLowerCase() !== game.name.toLowerCase());
    if (altNames.length === game.altNames.length) return game;
    changed = true;
    return extractBggGameSummary({ ...(game as unknown as BggGame), altNames });
  });
  for (const [bggId, found] of official) {
    const name = found.name ?? found.names[0];
    changed = true;
    merged.push(
      extractBggGameSummary({
        id: bggId,
        name,
        altNames: found.names.filter((n) => n.toLowerCase() !== name.toLowerCase()),
        updatedAt: 0,
      })
    );
  }
  return changed ? merged : bggGames;
};
