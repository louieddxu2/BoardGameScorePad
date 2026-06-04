import { HistoryGameEntry, HistoryGamePhotoEntry } from './historyGameEntries';
import { ScoringRule } from '../types';

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
