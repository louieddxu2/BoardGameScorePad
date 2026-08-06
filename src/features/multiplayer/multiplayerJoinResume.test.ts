import { describe, expect, it } from 'vitest';
import {
  MULTIPLAYER_PENDING_JOIN_STORAGE_KEY,
  MULTIPLAYER_UPDATE_JOIN_STORAGE_KEY,
  authorizeMultiplayerJoinAfterUpdate,
  consumeMultiplayerJoinAfterUpdate,
  createMultiplayerJoinUrl,
} from './multiplayerJoinResume';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe('multiplayer update join resume', () => {
  it('builds a QR URL with a cross-version update fallback', () => {
    expect(createMultiplayerJoinUrl('https://score.example', '/play', 'room / 1')).toBe(
      'https://score.example/play?room=room%20%2F%201&resumeRoom=room%20%2F%201',
    );
  });

  it('consumes a current service-worker authorization only once', () => {
    const storage = createStorage();
    authorizeMultiplayerJoinAfterUpdate(storage, 'room-1', 1_000);

    expect(consumeMultiplayerJoinAfterUpdate({ storage, now: 1_001 })).toBe('room-1');
    expect(consumeMultiplayerJoinAfterUpdate({ storage, now: 1_002 })).toBeNull();
    expect(storage.values.has(MULTIPLAYER_UPDATE_JOIN_STORAGE_KEY)).toBe(false);
  });

  it('accepts the cross-version query fallback only for a matching reload', () => {
    const storage = createStorage();
    storage.setItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY, JSON.stringify({ roomId: 'room-1', createdAt: 1_000 }));

    expect(consumeMultiplayerJoinAfterUpdate({ storage, legacyRoomId: 'room-1', isReloadNavigation: false, now: 1_001 })).toBeNull();
    expect(consumeMultiplayerJoinAfterUpdate({ storage, legacyRoomId: 'room-other', isReloadNavigation: true, now: 1_001 })).toBeNull();
    expect(consumeMultiplayerJoinAfterUpdate({ storage, legacyRoomId: 'room-1', isReloadNavigation: true, now: 1_001 })).toBe('room-1');
  });

  it('rejects expired update and legacy permissions', () => {
    const storage = createStorage();
    authorizeMultiplayerJoinAfterUpdate(storage, 'room-1', 1_000);
    storage.setItem(MULTIPLAYER_PENDING_JOIN_STORAGE_KEY, JSON.stringify({ roomId: 'room-1', createdAt: 1_000 }));

    expect(consumeMultiplayerJoinAfterUpdate({ storage, legacyRoomId: 'room-1', isReloadNavigation: true, now: 2_000_000 })).toBeNull();
  });
});
