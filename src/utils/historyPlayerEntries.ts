import { SavedListItem } from '../types';
import { HistorySummary } from './extractDataSummaries';
import {
  createHistoryGameKeyResolver,
  createHistoryPlayerResolver,
  HistoryGameEntryOptions
} from './historyGameEntries';

export interface HistoryPlayerGameEntry {
  key: string;
  name: string;
  playCount: number;
  winCount: number;
  latestPlayedAt: number;
}

export interface HistoryPlayerEntry {
  key: string;
  name: string;
  playCount: number;
  gameCount: number;
  latestPlayedAt: number;
  games: HistoryPlayerGameEntry[];
  recordIds: string[];
}

export interface SpecificPlayerStats extends HistoryPlayerEntry {
  records: HistorySummary[];
}

type MutablePlayerEntry = {
  key: string;
  name: string;
  playCount: number;
  latestPlayedAt: number;
  games: Map<string, HistoryPlayerGameEntry>;
  recordIds: string[];
};

const sortGames = (a: HistoryPlayerGameEntry, b: HistoryPlayerGameEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  if (b.latestPlayedAt !== a.latestPlayedAt) return b.latestPlayedAt - a.latestPlayedAt;
  return a.name.localeCompare(b.name);
};

const sortPlayers = (a: HistoryPlayerEntry, b: HistoryPlayerEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  if (b.latestPlayedAt !== a.latestPlayedAt) return b.latestPlayedAt - a.latestPlayedAt;
  return a.name.localeCompare(b.name);
};

export const buildHistoryPlayerEntries = (
  records: HistorySummary[],
  options?: HistoryGameEntryOptions
): HistoryPlayerEntry[] => {
  const resolvePlayer = createHistoryPlayerResolver(options);
  const resolveGameKey = createHistoryGameKeyResolver(records);
  const playerMap = new Map<string, MutablePlayerEntry>();

  records.forEach(record => {
    const gameKey = resolveGameKey(record);
    const seenPlayerKeys = new Set<string>();

    record.players.forEach(player => {
      const resolved = resolvePlayer(player);
      if (!resolved || seenPlayerKeys.has(resolved.key)) return;
      seenPlayerKeys.add(resolved.key);

      const current = playerMap.get(resolved.key) || {
        key: resolved.key,
        name: resolved.name,
        playCount: 0,
        latestPlayedAt: 0,
        games: new Map<string, HistoryPlayerGameEntry>(),
        recordIds: []
      };
      const winnerIds = record.winnerIds || [];
      const isWinner = winnerIds.includes(player.id)
        || (!!player.linkedPlayerId && winnerIds.includes(player.linkedPlayerId));
      const game = current.games.get(gameKey) || {
        key: gameKey,
        name: record.gameName,
        playCount: 0,
        winCount: 0,
        latestPlayedAt: 0
      };

      current.name = resolved.name || current.name;
      current.playCount += 1;
      current.latestPlayedAt = Math.max(current.latestPlayedAt, record.endTime);
      current.recordIds.push(record.id);
      game.playCount += 1;
      game.winCount += isWinner ? 1 : 0;
      game.latestPlayedAt = Math.max(game.latestPlayedAt, record.endTime);
      current.games.set(gameKey, game);
      playerMap.set(resolved.key, current);
    });
  });

  return Array.from(playerMap.values()).map(player => ({
    key: player.key,
    name: player.name,
    playCount: player.playCount,
    gameCount: player.games.size,
    latestPlayedAt: player.latestPlayedAt,
    games: Array.from(player.games.values()).sort(sortGames),
    recordIds: player.recordIds
  })).sort(sortPlayers);
};

export const buildSpecificPlayerStats = (
  playerKey: string,
  records: HistorySummary[],
  options?: { savedPlayers?: Pick<SavedListItem, 'id' | 'name'>[] }
): SpecificPlayerStats | null => {
  const player = buildHistoryPlayerEntries(records, options).find(entry => entry.key === playerKey);
  if (!player) return null;

  const recordIds = new Set(player.recordIds);
  return {
    ...player,
    records: records
      .filter(record => recordIds.has(record.id))
      .sort((a, b) => b.endTime - a.endTime)
  };
};
