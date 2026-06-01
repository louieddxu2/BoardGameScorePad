import { HistorySummary } from './extractDataSummaries';

export interface HistoryGamePlayerEntry {
  key: string;
  name: string;
  playCount: number;
}

export interface HistoryGameEntry {
  gameKey: string;
  displayName: string;
  bggId?: string;
  templateIds: string[];
  recordIds: string[];
  playCount: number;
  latestPlayedAt: number;
  players: HistoryGamePlayerEntry[];
  firstRecentPhotoId?: string;
  firstRecentPhotoRecordId?: string;
  photoCount: number;
}

interface MutableHistoryGameEntry {
  gameKey: string;
  displayName: string;
  bggId?: string;
  templateIds: Set<string>;
  recordIds: string[];
  playCount: number;
  latestPlayedAt: number;
  players: Map<string, HistoryGamePlayerEntry>;
  firstRecentPhotoId?: string;
  firstRecentPhotoRecordId?: string;
  photoCount: number;
}

const normalizeName = (name: string | undefined): string => (name || '').trim().toLowerCase();

const isDefaultPlayerName = (name: string | undefined): boolean => {
  return /^(\u73a9\u5bb6|Player)\s?\d+$/i.test((name || '').trim());
};

export const getHistoryGameKey = (record: HistorySummary): string => {
  if (record.bggId) return `bgg:${record.bggId}`;
  const normalizedName = normalizeName(record.gameName);
  return normalizedName ? `name:${normalizedName}` : `record:${record.id}`;
};

export const getHistoryPlayerKey = (player: HistorySummary['players'][number]): string | null => {
  if (player.linkedPlayerId) return `player:${player.linkedPlayerId}`;
  if (isDefaultPlayerName(player.name)) return null;

  const normalizedName = normalizeName(player.name);
  return normalizedName ? `name:${normalizedName}` : null;
};

const sortByCountThenName = (a: HistoryGamePlayerEntry, b: HistoryGamePlayerEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  return a.name.localeCompare(b.name);
};

const sortByCountThenRecent = (a: HistoryGameEntry, b: HistoryGameEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  return b.latestPlayedAt - a.latestPlayedAt;
};

export const buildHistoryGameEntries = (records: HistorySummary[]): HistoryGameEntry[] => {
  const gameMap = new Map<string, MutableHistoryGameEntry>();

  records.forEach(record => {
    const gameKey = getHistoryGameKey(record);
    const currentGame = gameMap.get(gameKey) || {
      gameKey,
      displayName: record.gameName,
      bggId: record.bggId,
      templateIds: new Set<string>(),
      recordIds: [],
      playCount: 0,
      latestPlayedAt: 0,
      players: new Map<string, HistoryGamePlayerEntry>(),
      photoCount: 0
    };

    if (record.firstPhotoId) {
      currentGame.photoCount += 1;
      if (!currentGame.firstRecentPhotoId || record.endTime >= currentGame.latestPlayedAt) {
        currentGame.firstRecentPhotoId = record.firstPhotoId;
        currentGame.firstRecentPhotoRecordId = record.id;
      }
    }

    currentGame.playCount += 1;
    currentGame.recordIds.push(record.id);
    currentGame.latestPlayedAt = Math.max(currentGame.latestPlayedAt, record.endTime);
    if (record.bggId && !currentGame.bggId) currentGame.bggId = record.bggId;
    if (record.templateId) currentGame.templateIds.add(record.templateId);

    record.players.forEach(player => {
      const playerKey = getHistoryPlayerKey(player);
      if (!playerKey) return;

      const existingPlayer = currentGame.players.get(playerKey);
      currentGame.players.set(playerKey, {
        key: playerKey,
        name: existingPlayer?.name || player.name,
        playCount: (existingPlayer?.playCount || 0) + 1
      });
    });

    gameMap.set(gameKey, currentGame);
  });

  return Array.from(gameMap.values()).map(game => ({
    gameKey: game.gameKey,
    displayName: game.displayName,
    bggId: game.bggId,
    templateIds: Array.from(game.templateIds),
    recordIds: game.recordIds,
    playCount: game.playCount,
    latestPlayedAt: game.latestPlayedAt,
    players: Array.from(game.players.values()).sort(sortByCountThenName),
    firstRecentPhotoId: game.firstRecentPhotoId,
    firstRecentPhotoRecordId: game.firstRecentPhotoRecordId,
    photoCount: game.photoCount
  })).sort(sortByCountThenRecent);
};
