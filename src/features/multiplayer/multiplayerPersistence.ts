import { db } from '../../db';
import { GameSession, GameTemplate, HistoryRecord, MultiplayerRoomRecord } from '../../types';
import { createHistoryRecordFromFinalSnapshot } from './multiplayerHistory';
import {
  BootstrapPackageMessage,
  SessionSnapshotMessage,
  MultiplayerRole,
  MultiplayerRoomInfo,
  isBootstrapPackageMessage,
  isSessionSnapshotMessage,
} from './protocol';
import { resolveBootstrapImport, TemplateImportDecision } from './sessionBootstrap';

export interface MultiplayerBootstrapStore {
  getTemplate(id: string): Promise<GameTemplate | undefined>;
  putTemplate(template: GameTemplate): Promise<unknown>;
  putSession(session: GameSession): Promise<unknown>;
  putRoom(room: MultiplayerRoomRecord): Promise<unknown>;
}

export interface MultiplayerHistoryStore {
  putHistory(record: HistoryRecord): Promise<unknown>;
  deleteSession(sessionId: string): Promise<unknown>;
  deleteRoom(roomId: string): Promise<unknown>;
}

export interface MultiplayerCompletionReleaseStore extends MultiplayerHistoryStore {
  putSession(session: GameSession): Promise<unknown>;
}

export interface MultiplayerSnapshotStore {
  putSession(session: GameSession): Promise<unknown>;
  putTemplate?(template: GameTemplate): Promise<unknown>;
  updateRoomRevision(roomId: string, revision: number, updatedAt: number): Promise<unknown>;
}

export interface PersistedBootstrapImport {
  decision: TemplateImportDecision;
  session: GameSession;
  templateForSession: GameTemplate;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createMultiplayerRoomRecord = (options: {
  room: MultiplayerRoomInfo;
  session: GameSession;
  revision: number;
  role: MultiplayerRole;
  updatedAt: number;
}): MultiplayerRoomRecord => ({
  roomId: options.room.roomId,
  sessionId: options.session.id,
  templateId: options.session.templateId,
  hostDeviceId: options.room.hostDeviceId,
  role: options.role,
  revision: options.revision,
  createdAt: options.room.createdAt,
  updatedAt: options.updatedAt,
});

/** Keeps one local template per ID, using a deterministic copy only when local is newer. */
export const persistMultiplayerBootstrap = async (
  message: BootstrapPackageMessage,
  store: MultiplayerBootstrapStore,
  role: MultiplayerRole = 'player'
): Promise<PersistedBootstrapImport> => {
  if (!isBootstrapPackageMessage(message)) {
    throw new Error('invalid_bootstrap_message');
  }

  const localTemplate = await store.getTemplate(message.package.template.id);
  const resolved = resolveBootstrapImport(message.package, localTemplate);

  if (
    resolved.decision.action === 'add-new' ||
    resolved.decision.action === 'overwrite-local' ||
    resolved.decision.action === 'add-session-copy'
  ) {
    await store.putTemplate(cloneJson(resolved.templateForSession));
  }

  await store.putSession(cloneJson(resolved.session));
  await store.putRoom(createMultiplayerRoomRecord({
    room: message.package.room,
    session: resolved.session,
    revision: message.package.revision,
    role,
    updatedAt: message.package.exportedAt,
  }));

  return {
    decision: resolved.decision,
    session: resolved.session,
    templateForSession: resolved.templateForSession,
  };
};

export const persistMultiplayerSnapshot = async (
  message: SessionSnapshotMessage,
  store: MultiplayerSnapshotStore
): Promise<GameSession> => {
  if (!isSessionSnapshotMessage(message)) {
    throw new Error('invalid_session_snapshot');
  }

  const session = cloneJson(message.session);
  await store.putSession(session);
  await store.updateRoomRevision(message.roomId, message.revision, message.updatedAt);
  return session;
};

/** Saves a final snapshot for every participant and clears its active-session copy. */
export const persistMultiplayerCompletion = async (options: {
  store: MultiplayerHistoryStore;
  roomId: string;
  template: GameTemplate;
  session: GameSession;
  completedAt: number;
  location?: string;
}): Promise<HistoryRecord> => {
  const record = createHistoryRecordFromFinalSnapshot({
    template: options.template,
    session: options.session,
    completedAt: options.completedAt,
    location: options.location,
  });

  const execute = async () => {
    await options.store.putHistory(record);
    await options.store.deleteSession(options.session.id);
    await options.store.deleteRoom(options.roomId);
  };

  if (typeof indexedDB === 'undefined') {
    await execute();
  } else {
    try {
      await db.transaction(
        'rw',
        [
          db.history,
          db.sessions,
          db.multiplayerRooms,
          db.multiplayerOutbox,
          db.multiplayerParticipantBindings,
          db.multiplayerPatchReceipts,
          db.multiplayerSequences,
        ],
        execute
      );
    } catch (err: any) {
      if (err?.name === 'MissingAPIError' || err?.message?.includes('IndexedDB API missing')) {
        await execute();
      } else {
        throw err;
      }
    }
  }

  return record;
};

/** Returns ownership of a completed room session to the local device. */
export const releaseMultiplayerRoomOwnership = async (options: {
  store: Pick<MultiplayerCompletionReleaseStore, 'putSession' | 'deleteRoom'>;
  roomId: string;
  session: GameSession;
  completedAt: number;
}): Promise<GameSession> => {
  const localSession: GameSession = {
    ...cloneJson(options.session),
    status: 'active',
    lastUpdatedAt: options.completedAt,
  };
  await options.store.putSession(localSession);
  await options.store.deleteRoom(options.roomId);
  return localSession;
};
