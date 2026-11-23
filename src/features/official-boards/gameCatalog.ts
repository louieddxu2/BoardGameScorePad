/**
 * The local game catalog (db.gameCatalog): one entry per BGG ID with the game's
 * names, its official boards in every language and where its rules are. Code
 * that works with boards reads them through officialBoardsOf / loadOfficialBoards.
 */
import { db } from '../../db';
import type { GameCatalogEntry, OfficialCatalogEntry, StoredGameCatalogEntry } from './types';

/** An entry with the keys its IndexedDB indexes use. */
export const toStoredGameEntry = (entry: GameCatalogEntry): StoredGameCatalogEntry => ({
  ...entry,
  boards: entry.boards ?? [],
  boardIds: (entry.boards ?? []).map((board) => board.id),
  ruleGameIds: (entry.rules ?? []).map((rule) => rule.gameId),
});

/** Every official board in the catalog, each with its game's BGG ID and names. */
export const officialBoardsOf = (entries: GameCatalogEntry[]): OfficialCatalogEntry[] =>
  entries.flatMap((entry) => entry.boards.map((board): OfficialCatalogEntry => ({
    ...board,
    bggId: entry.bggId,
    game: entry.name || entry.altNames?.length
      ? { ...(entry.name ? { name: entry.name } : {}), ...(entry.altNames?.length ? { altNames: entry.altNames } : {}) }
      : null,
  })));

export const loadOfficialBoards = async (): Promise<OfficialCatalogEntry[]> => officialBoardsOf(await db.gameCatalog.toArray());

/** One official board by its ID, from the entry that lists it. */
export const findOfficialBoard = async (id: string): Promise<OfficialCatalogEntry | undefined> => {
  const entry = await db.gameCatalog.where('boardIds').equals(id).first();
  return entry ? officialBoardsOf([entry]).find((board) => board.id === id) : undefined;
};

/** Catalog entries holding these boards (grouped by BGG ID); for tests and admin tools that start from boards. */
export const gameEntriesFromBoards = (boards: OfficialCatalogEntry[]): StoredGameCatalogEntry[] => {
  const byGame = new Map<string, GameCatalogEntry>();
  for (const { bggId, game, ...board } of boards) {
    const entry = byGame.get(bggId) ?? { bggId, name: game?.name ?? null, altNames: game?.altNames ?? [], rules: [], boards: [] };
    entry.boards.push(board);
    byGame.set(bggId, entry);
  }
  return [...byGame.values()].map(toStoredGameEntry);
};

export interface LocalRuleSummary {
  ruleGameId: string;
  publishedRuleCount: number;
  ruleVersion: string;
}

/**
 * A game's rule count and version from the local catalog, without the network.
 * `undefined`: the catalog does not know this BGG ID (or its base game), so ask the cloud.
 * `null`: the rules site has no rules for it.
 */
export const findLocalRuleSummary = async (bggId: string): Promise<LocalRuleSummary | null | undefined> => {
  const entry = await db.gameCatalog.get(bggId);
  if (!entry) return undefined;
  const ruleGameId = entry.rules?.find((rule) => rule.ruleGameId)?.ruleGameId;
  if (!ruleGameId) return null;
  const candidates = await db.gameCatalog.where('ruleGameIds').equals(ruleGameId).toArray();
  const base = candidates.flatMap((candidate) => candidate.rules ?? [])
    .find((rule) => rule.gameId === ruleGameId && rule.publishedRuleCount !== undefined && rule.ruleVersion !== undefined);
  if (!base) return undefined;
  return { ruleGameId, publishedRuleCount: base.publishedRuleCount!, ruleVersion: base.ruleVersion! };
};
