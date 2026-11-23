/**
 * Names of the game catalog's games merged into the local BGG dictionary used
 * by the start panel, so devices without a BGG dictionary can find every game
 * the cloud knows (with or without an official board) by any of its names.
 * For each BGG ID the names are:
 * - the rules site's names that the cloud keeps (the entry's name and aliases), and
 * - its official boards' own names and English names in every language.
 * Where the local dictionary knows a game, its own data stays and only the
 * names are added.
 */
import type { BggGame } from '../../types';
import { extractBggGameSummary, type BggGameSummary } from '../../utils/extractDataSummaries';
import type { GameCatalogEntry } from './types';

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

/**
 * Whether a catalog game belongs in the start panel's search. Scoreboards are per base game, so
 * expansions and versions stay out (they remain in the catalog for their base game's rule count).
 * A game with an official board is always listed. Without the rules site's kind, a rules game
 * that leads to another game's rules is taken as an expansion or version.
 */
export const isSearchableCatalogGame = (entry: GameCatalogEntry): boolean => {
  if (entry.boards?.length) return true;
  const rules = entry.rules ?? [];
  if (rules.length === 0) return true;
  return rules.some((rule) => rule.entityKind
    ? rule.entityKind === 'base' || rule.entityKind === 'unknown'
    : rule.ruleGameId === null || rule.ruleGameId === rule.gameId);
};

/** Every name of each searchable catalog game, with an English name first when one is known. */
const namesByBggId = (catalog: GameCatalogEntry[]): Map<string, { name?: string; names: string[] }> => {
  const out = new Map<string, { name?: string; names: string[] }>();
  for (const entry of catalog) {
    if (!entry.bggId || !isSearchableCatalogGame(entry)) continue;
    const boards = entry.boards ?? [];
    const names = distinct([entry.name, ...(entry.altNames ?? []), ...boards.flatMap((b) => [b.enName, b.name])]);
    const name = entry.name || distinct([...boards.map((b) => b.enName), ...boards.map((b) => b.name)]).find(isLatin);
    if (names.length) out.set(entry.bggId, { name: name || undefined, names });
  }
  return out;
};

/** The local dictionary plus the catalog games' names; returns the same array when nothing is added. */
export const mergeOfficialGameInfo = (
  bggGames: BggGameSummary[],
  catalog: GameCatalogEntry[]
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
