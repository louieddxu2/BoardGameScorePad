import { db } from '../../db';
import { GameSession, GameTemplate, HistoryRecord, MultiplayerRoomRecord } from '../../types';
import {
  MultiplayerBootstrapStore,
  MultiplayerHistoryStore,
  MultiplayerSnapshotStore,
  PersistedBootstrapImport,
  persistMultiplayerBootstrap,
} from './multiplayerPersistence';
import { createScoreStateSyncAdapter } from './scoreStateSyncAdapter';

export const multiplayerLocalStore: MultiplayerBootstrapStore & MultiplayerHistoryStore & MultiplayerSnapshotStore & {
  getRoom(roomId: string): Promise<MultiplayerRoomRecord | undefined>;
  getRoomBySessionId(sessionId: string): Promise<MultiplayerRoomRecord | undefined>;
  getSession(sessionId: string): Promise<GameSession | undefined>;
  purgeRoomData(roomId: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
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
  getRoomBySessionId(sessionId: string) {
    return db.multiplayerRooms.where('sessionId').equals(sessionId).first();
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
  async purgeRoomData(roomId: string): Promise<void> {
    await db.transaction('rw', [
      db.multiplayerRooms,
      db.multiplayerOutbox,
      db.multiplayerParticipantBindings,
      db.multiplayerPatchReceipts,
      db.multiplayerSequences,
    ], async () => {
      await db.multiplayerRooms.delete(roomId);
      await db.multiplayerOutbox.where('roomId').equals(roomId).delete();
      await db.multiplayerParticipantBindings.where('roomId').equals(roomId).delete();
      await db.multiplayerPatchReceipts.where('roomId').equals(roomId).delete();
      await db.multiplayerSequences.where('id').startsWith(`${roomId}:`).delete();
      await db.multiplayerSequences.where('id').equals(roomId).delete();
    });
  },
  deleteRoom(roomId: string): Promise<void> {
    return this.purgeRoomData(roomId);
  },
};

export const createLocalScoreStateSyncAdapter = (roomId: string, role: 'host' | 'player', options?: {
  onRemoteBootstrap?: (
    message: Parameters<typeof persistMultiplayerBootstrap>[0],
    persisted: PersistedBootstrapImport,
  ) => void | Promise<void>;
}) => {
  return createScoreStateSyncAdapter({
    roomId,
    role,
    store: {
      getRoom: (id) => db.multiplayerRooms.get(id),
      getSession: (id) => db.sessions.get(id),
      getTemplate: (id) => multiplayerLocalStore.getTemplate(id),
      async applyRemoteBootstrap(message) {
        const persisted = await persistMultiplayerBootstrap(message, multiplayerLocalStore, 'player');
        await options?.onRemoteBootstrap?.(message, persisted);
      },
    },
  });
};
