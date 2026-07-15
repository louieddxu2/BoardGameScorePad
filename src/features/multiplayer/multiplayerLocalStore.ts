import { db } from '../../db';
import { GameSession, GameTemplate, HistoryRecord, MultiplayerRoomRecord } from '../../types';
import {
  MultiplayerBootstrapStore,
  MultiplayerHistoryStore,
  MultiplayerSnapshotStore,
  persistMultiplayerBootstrap,
} from './multiplayerPersistence';
import { createScoreStateSyncAdapter } from './scoreStateSyncAdapter';

export const multiplayerLocalStore: MultiplayerBootstrapStore & MultiplayerHistoryStore & MultiplayerSnapshotStore & {
  getRoom(roomId: string): Promise<MultiplayerRoomRecord | undefined>;
  getSession(sessionId: string): Promise<GameSession | undefined>;
} = {
  async getTemplate(id: string): Promise<GameTemplate | undefined> {
    return (await db.templates.get(id)) ?? await db.builtins.get(id);
  },
  putTemplate(template: GameTemplate) {
    return db.templates.put(template);
  },
  putSession(session: GameSession) {
    return db.sessions.put(session);
  },
  putRoom(room: MultiplayerRoomRecord) {
    return db.multiplayerRooms.put(room);
  },
  getRoom(roomId: string) {
    return db.multiplayerRooms.get(roomId);
  },
  getSession(sessionId: string) {
    return db.sessions.get(sessionId);
  },
  updateRoomRevision(roomId: string, revision: number, updatedAt: number) {
    return db.multiplayerRooms.update(roomId, { revision, updatedAt });
  },
  putHistory(record: HistoryRecord) {
    return db.history.put(record);
  },
  deleteSession(sessionId: string) {
    return db.sessions.delete(sessionId);
  },
  deleteRoom(roomId: string) {
    return db.multiplayerRooms.delete(roomId);
  },
};

export const createLocalScoreStateSyncAdapter = (roomId: string, role: 'host' | 'player', options?: {
  onRemoteBootstrap?: (message: Parameters<typeof persistMultiplayerBootstrap>[0]) => void | Promise<void>;
}) => {
  return createScoreStateSyncAdapter({
    roomId,
    role,
    store: {
      getRoom: (id) => db.multiplayerRooms.get(id),
      getSession: (id) => db.sessions.get(id),
      getTemplate: (id) => multiplayerLocalStore.getTemplate(id),
      async applyRemoteBootstrap(message) {
        await persistMultiplayerBootstrap(message, multiplayerLocalStore, 'player');
        await options?.onRemoteBootstrap?.(message);
      },
    },
  });
};
