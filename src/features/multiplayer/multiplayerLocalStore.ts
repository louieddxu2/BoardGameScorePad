import { db } from '../../db';
import { GameSession, GameTemplate, HistoryRecord, MultiplayerRoomRecord } from '../../types';
import {
  MultiplayerBootstrapStore,
  MultiplayerBootstrapRecords,
  MultiplayerCompletionReleaseStore,
  MultiplayerHistoryStore,
  MultiplayerSnapshotStore,
  PersistedBootstrapImport,
  persistMultiplayerBootstrap,
} from './multiplayerPersistence';
import type { SessionCompletedMessage } from './protocol';
import { createScoreStateSyncAdapter } from './scoreStateSyncAdapter';

const multiplayerRoomCleanupTables = [
  db.multiplayerRooms,
  db.multiplayerOutbox,
  db.multiplayerParticipantBindings,
  db.multiplayerPatchReceipts,
  db.multiplayerSequences,
];

const purgeMultiplayerRoomData = async (roomId: string): Promise<void> => {
  await db.multiplayerRooms.delete(roomId);
  await db.multiplayerOutbox.where('roomId').equals(roomId).delete();
  await db.multiplayerParticipantBindings.where('roomId').equals(roomId).delete();
  await db.multiplayerPatchReceipts.where('roomId').equals(roomId).delete();
  await db.multiplayerSequences.where('id').startsWith(`${roomId}:`).delete();
  await db.multiplayerSequences.where('id').equals(roomId).delete();
};

/** Replace the complete row by primary key, without adding an upsert or table scan. */
const replaceExistingSession = async (session: GameSession, shouldPersist?: () => boolean) => {
  let replaced = false;
  const count = await db.sessions.where('id').equals(session.id).modify(function (this: { value: GameSession }) {
    if (shouldPersist?.() === false) return false;
    this.value = session;
    replaced = true;
  });
  // Dexie 3 returns matched keys even when a modify callback returns false.
  return replaced ? count : 0;
};

export const multiplayerLocalStore: MultiplayerBootstrapStore & MultiplayerHistoryStore & MultiplayerSnapshotStore & MultiplayerCompletionReleaseStore & {
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
  persistBootstrap({ template, session, room, requireExistingSession, shouldPersist }: MultiplayerBootstrapRecords) {
    const tables = template
      ? [db.templates, db.sessions, db.multiplayerRooms]
      : [db.sessions, db.multiplayerRooms];
    return db.transaction('rw', tables, async () => {
      if (shouldPersist?.() === false) return false;
      if (requireExistingSession) {
        if (!await replaceExistingSession(session, shouldPersist)) return false;
      } else {
        await db.sessions.put(session);
      }
      if (template) await db.templates.put(template);
      await db.multiplayerRooms.put(room);
      return true;
    });
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
  persistSnapshot({ session, roomId, revision, updatedAt }) {
    return db.transaction('rw', [db.sessions, db.multiplayerRooms], async () => {
      // A snapshot updates an existing owner, unlike first-join bootstrap.
      // Replace the whole row atomically, but never upsert a deleted session.
      const count = await replaceExistingSession(session);
      if (count === 0) return false;
      await db.multiplayerRooms.update(roomId, { templateId: session.templateId, revision, updatedAt });
      return true;
    });
  },
  persistAcceptedSnapshot({ session, roomId, revision, updatedAt, receipt, sequence }) {
    return db.transaction('rw', [db.sessions, db.multiplayerRooms, db.multiplayerPatchReceipts, db.multiplayerSequences], async () => {
      const count = await replaceExistingSession(session);
      if (count === 0) return false;
      await db.multiplayerRooms.update(roomId, { templateId: session.templateId, revision, updatedAt });
      await db.multiplayerSequences.put(sequence);
      await db.multiplayerPatchReceipts.put(receipt);
      return true;
    });
  },
  putHistory(record: HistoryRecord) {
    return db.history.put(record);
  },
  deleteSession(sessionId: string) {
    // Multiplayer completion already owns and closes its runtime before this
    // transactional cleanup; external deletion paths use sessionDeletionEvents.
    return db.sessions.delete(sessionId);
  },
  async releaseRoomOwnership({ roomId, session, template, shouldPersist }: { roomId: string; session: GameSession; template?: GameTemplate; shouldPersist?: () => boolean }): Promise<boolean> {
    const tables = [db.sessions, ...multiplayerRoomCleanupTables, ...(template ? [db.templates] : [])];
    return db.transaction('rw', tables, async () => {
      if (shouldPersist?.() === false) return false;
      const count = await replaceExistingSession(session, shouldPersist);
      if (shouldPersist?.() === false) return false;
      if (count > 0 && template) await db.templates.put(template);
      await purgeMultiplayerRoomData(roomId);
      return count > 0;
    });
  },
  async purgeRoomData(roomId: string): Promise<void> {
    await db.transaction('rw', multiplayerRoomCleanupTables, () => purgeMultiplayerRoomData(roomId));
  },
  deleteRoom(roomId: string): Promise<void> {
    return this.purgeRoomData(roomId);
  },
};

export const createLocalScoreStateSyncAdapter = (roomId: string, role: 'host' | 'player', options?: {
  applyRemoteBootstrap?: (message: Parameters<typeof persistMultiplayerBootstrap>[0]) => boolean | Promise<boolean>;
  onRemoteBootstrap?: (
    message: Parameters<typeof persistMultiplayerBootstrap>[0],
    persisted: PersistedBootstrapImport,
  ) => void | Promise<void>;
  onRemoteCompletion?: (message: SessionCompletedMessage) => void | Promise<void>;
}) => {
  let bootstrapQueue = Promise.resolve();
  return createScoreStateSyncAdapter({
    roomId,
    role,
    store: {
      getRoom: (id) => db.multiplayerRooms.get(id),
      getSession: (id) => db.sessions.get(id),
      getTemplate: (id) => multiplayerLocalStore.getTemplate(id),
      applyRemoteBootstrap(message, isActive) {
        const task = bootstrapQueue.then(async () => {
          if (!isActive()) return;
          // Finish the first join before processing another template. Once joined,
          // the runtime serializes imports with score/ACK writes itself.
          if (await options?.applyRemoteBootstrap?.(message)) return;
          if (!isActive()) return;
          const persisted = await persistMultiplayerBootstrap(message, multiplayerLocalStore, 'player', isActive);
          if (persisted && isActive()) await options?.onRemoteBootstrap?.(message, persisted);
        });
        bootstrapQueue = task.catch(() => undefined);
        return task;
      },
    },
    onRemoteCompletion: options?.onRemoteCompletion,
  });
};
