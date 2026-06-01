import { SavedListItem } from '../types';
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

export interface HistoryGameEntryOptions {
  savedPlayers?: Pick<SavedListItem, 'id' | 'name'>[];
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

const createHistoryPlayerResolver = (options?: HistoryGameEntryOptions) => {
  const savedPlayers = options?.savedPlayers;

  if (!savedPlayers) {
    return (player: HistorySummary['players'][number]): HistoryGamePlayerEntry | null => {
      const key = getHistoryPlayerKey(player);
      return key ? { key, name: player.name, playCount: 0 } : null;
    };
  }

  const savedPlayerById = new Map(savedPlayers.map(player => [player.id, player]));
  const savedPlayerByName = new Map<string, Pick<SavedListItem, 'id' | 'name'>>();

  savedPlayers.forEach(player => {
    const normalizedName = normalizeName(player.name);
    if (normalizedName && !savedPlayerByName.has(normalizedName)) {
      savedPlayerByName.set(normalizedName, player);
    }
  });

  return (player: HistorySummary['players'][number]): HistoryGamePlayerEntry | null => {
    if (isDefaultPlayerName(player.name)) return null;

    const linkedPlayer = player.linkedPlayerId ? savedPlayerById.get(player.linkedPlayerId) : undefined;
    if (linkedPlayer) {
      return { key: `player:${linkedPlayer.id}`, name: linkedPlayer.name || player.name, playCount: 0 };
    }

    const nameMatchedPlayer = savedPlayerByName.get(normalizeName(player.name));
    if (nameMatchedPlayer) {
      return { key: `player:${nameMatchedPlayer.id}`, name: nameMatchedPlayer.name || player.name, playCount: 0 };
    }

    return null;
  };
};

const sortByCountThenName = (a: HistoryGamePlayerEntry, b: HistoryGamePlayerEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  return a.name.localeCompare(b.name);
};

const sortByCountThenRecent = (a: HistoryGameEntry, b: HistoryGameEntry) => {
  if (b.playCount !== a.playCount) return b.playCount - a.playCount;
  return b.latestPlayedAt - a.latestPlayedAt;
};

export const buildHistoryGameEntries = (records: HistorySummary[], options?: HistoryGameEntryOptions): HistoryGameEntry[] => {
  const gameMap = new Map<string, MutableHistoryGameEntry>();
  const resolveHistoryPlayer = createHistoryPlayerResolver(options);

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
      const resolvedPlayer = resolveHistoryPlayer(player);
      if (!resolvedPlayer) return;

      const existingPlayer = currentGame.players.get(resolvedPlayer.key);
      currentGame.players.set(resolvedPlayer.key, {
        key: resolvedPlayer.key,
        name: existingPlayer?.name || resolvedPlayer.name,
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
