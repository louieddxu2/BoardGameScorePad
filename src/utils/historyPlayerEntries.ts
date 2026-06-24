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
  companions: HistoryPlayerCompanionEntry[];
}

export interface HistoryPlayerCompanionEntry {
  key: string;
  name: string;
  playCount: number;
}

export interface HistoryPlayerEntry {
  key: string;
  name: string;
  playCount: number;
  gameCount: number;
  latestPlayedAt: number;
  games: HistoryPlayerGameEntry[];
  recentGames: HistoryPlayerGameEntry[];
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
  games: Map<string, MutableHistoryPlayerGameEntry>;
  recordIds: string[];
};

type MutableHistoryPlayerGameEntry = Omit<HistoryPlayerGameEntry, 'companions'> & {
  companions: Map<string, HistoryPlayerCompanionEntry>;
};

const sortGames = (a: HistoryPlayerGameEntry, b: HistoryPlayerGameEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  if (b.latestPlayedAt !== a.latestPlayedAt) return b.latestPlayedAt - a.latestPlayedAt;
  return a.name.localeCompare(b.name);
};

const sortGamesByRecent = (a: HistoryPlayerGameEntry, b: HistoryPlayerGameEntry) => {
  if (b.latestPlayedAt !== a.latestPlayedAt) return b.latestPlayedAt - a.latestPlayedAt;
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  return a.name.localeCompare(b.name);
};

const sortCompanions = (a: HistoryPlayerCompanionEntry, b: HistoryPlayerCompanionEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
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
    const resolvedPlayers = record.players.reduce<Array<{
      source: HistorySummary['players'][number];
      key: string;
      name: string;
    }>>((players, player) => {
      const resolved = resolvePlayer(player);
      if (!resolved || players.some(existing => existing.key === resolved.key)) return players;
      players.push({ source: player, key: resolved.key, name: resolved.name });
      return players;
    }, []);

    resolvedPlayers.forEach(player => {
      const current = playerMap.get(player.key) || {
        key: player.key,
        name: player.name,
        playCount: 0,
        latestPlayedAt: 0,
        games: new Map<string, MutableHistoryPlayerGameEntry>(),
        recordIds: []
      };
      const winnerIds = record.winnerIds || [];
      const isWinner = winnerIds.includes(player.source.id)
        || (!!player.source.linkedPlayerId && winnerIds.includes(player.source.linkedPlayerId));
      const game = current.games.get(gameKey) || {
        key: gameKey,
        name: record.gameName,
        playCount: 0,
        winCount: 0,
        latestPlayedAt: 0,
        companions: new Map<string, HistoryPlayerCompanionEntry>()
      };

      current.name = player.name || current.name;
      current.playCount += 1;
      current.latestPlayedAt = Math.max(current.latestPlayedAt, record.endTime);
      current.recordIds.push(record.id);
      game.playCount += 1;
      game.winCount += isWinner ? 1 : 0;
      game.latestPlayedAt = Math.max(game.latestPlayedAt, record.endTime);
      resolvedPlayers.forEach(companion => {
        if (companion.key === player.key) return;
        const existing = game.companions.get(companion.key);
        game.companions.set(companion.key, {
          key: companion.key,
          name: existing?.name || companion.name,
          playCount: (existing?.playCount || 0) + 1
        });
      });
      current.games.set(gameKey, game);
      playerMap.set(player.key, current);
    });
  });

  return Array.from(playerMap.values()).map(player => {
    const games = Array.from(player.games.values()).map(game => ({
      ...game,
      companions: Array.from(game.companions.values()).sort(sortCompanions)
    }));
    return {
      key: player.key,
      name: player.name,
      playCount: player.playCount,
      gameCount: player.games.size,
      latestPlayedAt: player.latestPlayedAt,
      games: [...games].sort(sortGames),
      recentGames: [...games].sort(sortGamesByRecent),
      recordIds: player.recordIds
    };
  }).sort(sortPlayers);
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
