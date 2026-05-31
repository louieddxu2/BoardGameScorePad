import { HistorySummary } from './extractDataSummaries';

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

export interface HistoryPhotoGridItem {
  recordId: string;
  gameKey: string;
  gameName: string;
  endTime: number;
  photoId: string;
}

const getGameKey = (record: HistorySummary): string => {
  return record.templateId || `name:${record.gameName.trim().toLowerCase()}`;
};

const getPlayerKey = (player: HistorySummary['players'][number]): string => {
  return player.linkedPlayerId || `name:${player.name.trim().toLowerCase()}`;
};

const sortByCountThenRecent = <T extends { playCount: number; lastPlayedAt?: number }>(a: T, b: T) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
};

export const buildHistoryStats = (records: HistorySummary[]): HistoryStatsOverview => {
  const gameMap = new Map<string, {
    key: string;
    name: string;
    playCount: number;
    lastPlayedAt: number;
    players: Map<string, HistoryStatsPlayer>;
  }>();
  const globalPlayers = new Map<string, HistoryStatsPlayer>();

  records.forEach(record => {
    const gameKey = getGameKey(record);
    const currentGame = gameMap.get(gameKey) || {
      key: gameKey,
      name: record.gameName,
      playCount: 0,
      lastPlayedAt: 0,
      players: new Map<string, HistoryStatsPlayer>()
    };

    currentGame.playCount += 1;
    currentGame.lastPlayedAt = Math.max(currentGame.lastPlayedAt, record.endTime);

    record.players.forEach(player => {
      const playerKey = getPlayerKey(player);
      const existingGamePlayer = currentGame.players.get(playerKey);
      currentGame.players.set(playerKey, {
        key: playerKey,
        name: existingGamePlayer?.name || player.name,
        playCount: (existingGamePlayer?.playCount || 0) + 1
      });

      const existingGlobalPlayer = globalPlayers.get(playerKey);
      globalPlayers.set(playerKey, {
        key: playerKey,
        name: existingGlobalPlayer?.name || player.name,
        playCount: (existingGlobalPlayer?.playCount || 0) + 1
      });
    });

    gameMap.set(gameKey, currentGame);
  });

  const games = Array.from(gameMap.values()).map(game => ({
    key: game.key,
    name: game.name,
    playCount: game.playCount,
    lastPlayedAt: game.lastPlayedAt,
    players: Array.from(game.players.values()).sort((a, b) => b.playCount - a.playCount || a.name.localeCompare(b.name))
  })).sort(sortByCountThenRecent);

  const latestPlayedAt = records.reduce<number | undefined>((latest, record) => {
    if (latest === undefined) return record.endTime;
    return Math.max(latest, record.endTime);
  }, undefined);

  return {
    playCount: records.length,
    gameCount: games.length,
    playerCount: globalPlayers.size,
    latestPlayedAt,
    games
  };
};

export const selectHistoryPhotoGridItems = (records: HistorySummary[], limit = 9): HistoryPhotoGridItem[] => {
  const seenGames = new Set<string>();
  const items: HistoryPhotoGridItem[] = [];

  for (const record of records) {
    if (!record.firstPhotoId) continue;
    const gameKey = getGameKey(record);
    if (seenGames.has(gameKey)) continue;

    seenGames.add(gameKey);
    items.push({
      recordId: record.id,
      gameKey,
      gameName: record.gameName,
      endTime: record.endTime,
      photoId: record.firstPhotoId
    });

    if (items.length >= limit) break;
  }

  return items;
};
