import { HistoryGameEntry, HistoryGamePhotoEntry, getHistoryPlayerKey } from './historyGameEntries';
import { ScoringRule } from '../types';
import { HistorySummary } from './extractDataSummaries';

export type HistoryStatsDateRange = 'all' | 'month' | 'quarter' | 'year';

const DAY_MS = 24 * 60 * 60 * 1000;

export const HISTORY_STATS_DATE_RANGE_ORDER: HistoryStatsDateRange[] = ['all', 'month', 'quarter', 'year'];

const HISTORY_STATS_DATE_RANGE_DAYS: Record<Exclude<HistoryStatsDateRange, 'all'>, number> = {
  month: 30,
  quarter: 90,
  year: 365
};

export interface HistoryStatsPlayer {
  key: string;
  name: string;
  playCount: number;
}

export interface HistoryStatsGame {
  key: string;
  name: string;
  playCount: number;
  lastPlayedAt: number;
  players: HistoryStatsPlayer[];
}

export interface HistoryStatsOverview {
  playCount: number;
  gameCount: number;
  playerCount: number;
  latestPlayedAt?: number;
  games: HistoryStatsGame[];
}

export interface HistoryStatsFilters {
  playerCount?: number | null;
  scoringRule?: ScoringRule | null;
  location?: string | null;
}

export interface HistoryPhotoGridItem {
  recordId: string;
  gameKey: string;
  gameName: string;
  endTime: number;
  photoId: string;
  candidatePhotos: HistoryGamePhotoEntry[];
}

export const getNextHistoryStatsDateRange = (range: HistoryStatsDateRange): HistoryStatsDateRange => {
  const index = HISTORY_STATS_DATE_RANGE_ORDER.indexOf(range);
  return HISTORY_STATS_DATE_RANGE_ORDER[(index + 1) % HISTORY_STATS_DATE_RANGE_ORDER.length];
};

export const filterHistoryEntriesByDateRange = (
  entries: HistoryGameEntry[],
  range: HistoryStatsDateRange,
  now = Date.now()
): HistoryGameEntry[] => {
  if (range === 'all') return entries;

  const days = HISTORY_STATS_DATE_RANGE_DAYS[range];
  const cutoff = now - days * DAY_MS;
  return entries.filter(entry => entry.latestPlayedAt >= cutoff);
};

export const filterHistoryEntriesByStatsFilters = (
  entries: HistoryGameEntry[],
  filters: HistoryStatsFilters
): HistoryGameEntry[] => {
  const location = filters.location?.trim();

  return entries.filter(entry => {
    if (filters.playerCount && !entry.playerCounts.includes(filters.playerCount)) return false;
    if (filters.scoringRule && !entry.scoringRules.includes(filters.scoringRule)) return false;
    if (location && !entry.locations.includes(location)) return false;
    return true;
  });
};

export const buildHistoryStats = (entries: HistoryGameEntry[]): HistoryStatsOverview => {
  const globalPlayers = new Map<string, HistoryStatsPlayer>();

  entries.forEach(entry => {
    entry.players.forEach(player => {
      const existingPlayer = globalPlayers.get(player.key);
      globalPlayers.set(player.key, {
        key: player.key,
        name: existingPlayer?.name || player.name,
        playCount: (existingPlayer?.playCount || 0) + player.playCount
      });
    });
  });

  const latestPlayedAt = entries.reduce<number | undefined>((latest, entry) => {
    if (latest === undefined) return entry.latestPlayedAt;
    return Math.max(latest, entry.latestPlayedAt);
  }, undefined);

  return {
    playCount: entries.reduce((total, entry) => total + entry.playCount, 0),
    gameCount: entries.length,
    playerCount: globalPlayers.size,
    latestPlayedAt,
    games: entries.map(entry => ({
      key: entry.gameKey,
      name: entry.displayName,
      playCount: entry.playCount,
      lastPlayedAt: entry.latestPlayedAt,
      players: entry.players
    }))
  };
};

export const selectHistoryPhotoGridItems = (entries: HistoryGameEntry[], limit = 9): HistoryPhotoGridItem[] => {
  return [...entries]
    .sort((a, b) => b.latestPlayedAt - a.latestPlayedAt)
    .filter(entry => entry.firstRecentPhotoId && entry.firstRecentPhotoRecordId)
    .slice(0, limit)
    .map(entry => ({
      recordId: entry.firstRecentPhotoRecordId!,
      gameKey: entry.gameKey,
      gameName: entry.displayName,
      endTime: entry.latestPlayedAt,
      photoId: entry.firstRecentPhotoId!,
      candidatePhotos: entry.photos
    }));
};

export interface SpecificGameStatsPlayer {
  key: string;
  name: string;
  playCount: number;
  winCount: number;
  winRate: number;
}

export interface SpecificGameStats {
  gameName: string;
  playCount: number;
  latestPlayedAt?: number;
  scoringRule?: ScoringRule;
  players: SpecificGameStatsPlayer[];
}

export const buildSpecificGameStats = (
  gameKey: string,
  records: HistorySummary[],
  options?: { savedPlayers?: { id: string; name: string }[] }
): SpecificGameStats | null => {
  const gameRecords = records.filter(r => {
    const rKey = r.bggId ? `bgg:${r.bggId}` : (r.gameName ? `name:${r.gameName.trim().toLowerCase()}` : `record:${r.id}`);
    return rKey === gameKey;
  });

  if (gameRecords.length === 0) return null;

  const firstRecord = gameRecords[0];
  const gameName = firstRecord.gameName;
  const scoringRule = firstRecord.scoringRule;

  const playCount = gameRecords.length;
  const latestPlayedAt = gameRecords.reduce((max, r) => Math.max(max, r.endTime), 0);

  const savedPlayers = options?.savedPlayers;
  const savedPlayerNameMap = new Map<string, string>();
  if (savedPlayers) {
    savedPlayers.forEach(p => {
      if (p.name?.trim()) {
        savedPlayerNameMap.set(p.name.trim().toLowerCase(), p.name);
      }
    });
  }

  const playerMap = new Map<string, {
    key: string;
    name: string;
    playCount: number;
    winCount: number;
  }>();

  gameRecords.forEach(r => {
    const winnerIds = r.winnerIds || [];

    r.players.forEach(p => {
      const pKey = getHistoryPlayerKey(p);
      if (!pKey) return;

      let displayName = p.name;
      if (savedPlayers) {
        const matched = savedPlayers.find(sp => sp.id === p.linkedPlayerId);
        if (matched) {
          displayName = matched.name;
        } else {
          const nameKey = p.name.trim().toLowerCase();
          displayName = savedPlayerNameMap.get(nameKey) || p.name;
        }
      }

      const isWinner = winnerIds.includes(p.id) || (p.linkedPlayerId && winnerIds.includes(p.linkedPlayerId));

      const existing = playerMap.get(pKey) || {
        key: pKey,
        name: displayName,
        playCount: 0,
        winCount: 0
      };

      existing.playCount += 1;
      if (isWinner) existing.winCount += 1;

      playerMap.set(pKey, existing);
    });
  });

  const players = Array.from(playerMap.values()).map(p => {
    const winRate = p.playCount > 0 ? Math.round((p.winCount / p.playCount) * 100) : 0;
    return {
      key: p.key,
      name: p.name,
      playCount: p.playCount,
      winCount: p.winCount,
      winRate
    };
  }).sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.playCount !== a.playCount) return b.playCount - a.playCount;
    return a.name.localeCompare(b.name);
  });

  return {
    gameName,
    playCount,
    latestPlayedAt: latestPlayedAt || undefined,
    scoringRule,
    players
  };
};
