export const MULTIPLAYER_PENDING_JOIN_STORAGE_KEY = 'boardgame-scorepad-pending-room-join';
export const MULTIPLAYER_UPDATE_JOIN_STORAGE_KEY = 'boardgame-scorepad-update-room-join';
export const MULTIPLAYER_UPDATE_ROOM_QUERY_PARAM = 'resumeRoom';

const UPDATE_AUTHORIZATION_TTL_MS = 60_000;
const LEGACY_PENDING_JOIN_TTL_MS = 30 * 60_000;

type StoredRoomJoin = { roomId: string; createdAt: number };

const readStoredRoomJoin = (storage: Pick<Storage, 'getItem'>, key: string): StoredRoomJoin | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredRoomJoin>;
    return typeof value.roomId === 'string' && value.roomId !== '' && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? { roomId: value.roomId, createdAt: value.createdAt }
      : null;
  } catch {
    return null;
  }
};

const isFresh = (record: StoredRoomJoin, now: number, ttlMs: number) => (
  record.createdAt <= now + 5_000 && now - record.createdAt <= ttlMs
);

export const getPendingMultiplayerRoomJoin = (storage: Pick<Storage, 'getItem'>) => (
  readStoredRoomJoin(storage, MULTIPLAYER_PENDING_JOIN_STORAGE_KEY)
);

export const rememberPendingMultiplayerRoomJoin = (
  storage: Pick<Storage, 'setItem'>,
  roomId: string,
  now = Date.now(),
) => {
  storage.setItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY, JSON.stringify({ roomId, createdAt: now }));
};

export const clearPendingMultiplayerRoomJoin = (storage: Pick<Storage, 'removeItem'>) => {
  storage.removeItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY);
};

export const createMultiplayerJoinUrl = (origin: string, pathname: string, roomId: string) => {
  const encodedRoomId = encodeURIComponent(roomId);
  return `${origin}${pathname}?room=${encodedRoomId}&${MULTIPLAYER_UPDATE_ROOM_QUERY_PARAM}=${encodedRoomId}`;
};

/** Grants one short-lived reload permission for the room currently being joined. */
export const authorizeMultiplayerJoinAfterUpdate = (
  storage: Pick<Storage, 'setItem'>,
  roomId: string,
  now = Date.now(),
) => {
  storage.setItem(MULTIPLAYER_UPDATE_JOIN_STORAGE_KEY, JSON.stringify({ roomId, createdAt: now }));
};

/**
 * Consumes an update-only join permission. The legacy query fallback lets the
 * first fixed release recover a QR scan that began under the preceding build,
 * whose controllerchange handler could not write the new permission yet.
 */
export const consumeMultiplayerJoinAfterUpdate = (options: {
  storage: Pick<Storage, 'getItem' | 'removeItem'>;
  legacyRoomId?: string | null;
  isReloadNavigation?: boolean;
  now?: number;
}): string | null => {
  const now = options.now ?? Date.now();
  const authorized = readStoredRoomJoin(options.storage, MULTIPLAYER_UPDATE_JOIN_STORAGE_KEY);
  try {
    options.storage.removeItem(MULTIPLAYER_UPDATE_JOIN_STORAGE_KEY);
  } catch {
    // A storage failure simply disables automatic recovery.
  }
  if (authorized && isFresh(authorized, now, UPDATE_AUTHORIZATION_TTL_MS)) return authorized.roomId;

  if (!options.legacyRoomId || options.isReloadNavigation !== true) return null;
  const pending = getPendingMultiplayerRoomJoin(options.storage);
  return pending && pending.roomId === options.legacyRoomId && isFresh(pending, now, LEGACY_PENDING_JOIN_TTL_MS)
    ? pending.roomId
    : null;
};
