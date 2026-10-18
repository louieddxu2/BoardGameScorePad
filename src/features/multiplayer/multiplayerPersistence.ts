import { db } from '../../db';
import { GameSession, GameTemplate, HistoryRecord, MultiplayerPatchReceiptRecord, MultiplayerRoomRecord, MultiplayerSequenceRecord } from '../../types';
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
import type { MultiplayerDeliveryStore } from './multiplayerDeliveryStore';

export interface MultiplayerBootstrapStore {
  getTemplate(id: string): Promise<GameTemplate | undefined>;
  putTemplate(template: GameTemplate): Promise<unknown>;
  putSession(session: GameSession): Promise<unknown>;
  putRoom(room: MultiplayerRoomRecord): Promise<unknown>;
  persistBootstrap(records: MultiplayerBootstrapRecords): Promise<unknown>;
}

export interface MultiplayerBootstrapRecords {
  template?: GameTemplate;
  session: GameSession;
  room: MultiplayerRoomRecord;
  /** Live updates and handoffs must never recreate a deleted local owner. */
  requireExistingSession?: boolean;
  /** The transport owns cancellation; no extra observer or request generation. */
  shouldPersist?: () => boolean;
}

export interface MultiplayerHistoryStore {
  putHistory(record: HistoryRecord): Promise<unknown>;
  deleteSession(sessionId: string): Promise<unknown>;
  deleteRoom(roomId: string): Promise<unknown>;
}

export interface MultiplayerCompletionReleaseStore extends MultiplayerHistoryStore {
  putSession(session: GameSession): Promise<unknown>;
  putTemplate?(template: GameTemplate): Promise<unknown>;
  releaseRoomOwnership?(options: { roomId: string; session: GameSession; template?: GameTemplate; shouldPersist?: () => boolean }): Promise<unknown>;
}

export interface MultiplayerSnapshotStore {
  putSession(session: GameSession): Promise<unknown>;
  putTemplate?(template: GameTemplate): Promise<unknown>;
  updateRoomRevision(roomId: string, revision: number, updatedAt: number): Promise<unknown>;
  /** Atomic updates may return false when the session owner no longer exists. */
  persistSnapshot?(options: {
    session: GameSession;
    roomId: string;
    revision: number;
    updatedAt: number;
  }): Promise<unknown>;
  /** A false result must not commit a receipt, sequence, or room revision. */
  persistAcceptedSnapshot?(options: {
    session: GameSession;
    roomId: string;
    revision: number;
    updatedAt: number;
    receipt: MultiplayerPatchReceiptRecord;
    sequence: MultiplayerSequenceRecord;
  }): Promise<unknown>;
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
  status: 'active',
  revision: options.revision,
  createdAt: options.room.createdAt,
  updatedAt: options.updatedAt,
});

export const persistMultiplayerBootstrapRecords = async (
  store: Pick<MultiplayerBootstrapStore, 'persistBootstrap'>,
  records: MultiplayerBootstrapRecords,
): Promise<boolean> => {
  return await store.persistBootstrap(records) !== false;
};

/**
 * Keeps a completed host room available briefly so a temporarily offline
 * participant can receive the terminal snapshot after reconnecting.
 */
export const retainMultiplayerCompletionRelay = async (options: {
  store: Pick<MultiplayerCompletionReleaseStore, 'putSession'> & Pick<MultiplayerBootstrapStore, 'putRoom'>
    & Partial<Pick<MultiplayerBootstrapStore, 'persistBootstrap'>>;
  room: MultiplayerRoomRecord;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  completedAt: number;
}): Promise<GameSession | null> => {
  const localSession: GameSession = {
    ...cloneJson(options.session),
    status: 'active',
    lastUpdatedAt: options.completedAt,
  };

  const room: MultiplayerRoomRecord = {
    ...cloneJson(options.room),
    status: 'completed',
    revision: options.revision,
    completedAt: options.completedAt,
    completedSession: cloneJson(options.session),
    completedTemplate: cloneJson(options.template),
    updatedAt: options.completedAt,
  };
  if (options.store.persistBootstrap) {
    const persisted = await options.store.persistBootstrap({
      session: localSession, room, requireExistingSession: true,
    });
    if (persisted === false) return null;
  } else {
    await options.store.putSession(localSession);
    await options.store.putRoom(room);
  }
  return localSession;
};

/** Keeps one local template per ID, using a deterministic copy only when local is newer. */
export const persistMultiplayerBootstrap = async (
  message: BootstrapPackageMessage,
  store: MultiplayerBootstrapStore,
  role: MultiplayerRole = 'player',
  shouldPersist?: () => boolean,
  requireExistingSession = false,
): Promise<PersistedBootstrapImport | null> => {
  if (!isBootstrapPackageMessage(message)) {
    throw new Error('invalid_bootstrap_message');
  }

  if (shouldPersist?.() === false) return null;
  const localTemplate = await store.getTemplate(message.package.template.id);
  if (shouldPersist?.() === false) return null;
  const resolved = resolveBootstrapImport(message.package, localTemplate);

  const templateToPersist = (
    resolved.decision.action === 'add-new' ||
    resolved.decision.action === 'overwrite-local' ||
    resolved.decision.action === 'add-session-copy'
  ) ? cloneJson(resolved.templateForSession) : undefined;

  const sessionToPersist = cloneJson(resolved.session);
  const roomToPersist = createMultiplayerRoomRecord({
    room: message.package.room,
    session: sessionToPersist,
    revision: message.package.revision,
    role,
    updatedAt: message.package.exportedAt,
  });
  if (!await persistMultiplayerBootstrapRecords(store, {
    template: templateToPersist,
    session: sessionToPersist,
    room: roomToPersist,
    ...(shouldPersist ? { shouldPersist } : {}),
    ...(requireExistingSession ? { requireExistingSession: true } : {}),
  })) return null;

  return {
    decision: resolved.decision,
    session: resolved.session,
    templateForSession: resolved.templateForSession,
  };
};

export const persistMultiplayerSnapshot = async (
  message: SessionSnapshotMessage,
  store: MultiplayerSnapshotStore
): Promise<GameSession | null> => {
  if (!isSessionSnapshotMessage(message)) {
    throw new Error('invalid_session_snapshot');
  }

  const session = cloneJson(message.session);
  if (store.persistSnapshot) {
    const persisted = await store.persistSnapshot({
      session,
      roomId: message.roomId,
      revision: message.revision,
      updatedAt: message.updatedAt,
    });
    if (persisted === false) return null; // The local record was retired; never recreate it.
  } else {
    await store.putSession(session);
    await store.updateRoomRevision(message.roomId, message.revision, message.updatedAt);
  }
  return session;
};

/** The production store atomically commits inputs, revision, receipt and watermark. */
export const persistAcceptedMultiplayerSnapshot = async (
  message: SessionSnapshotMessage,
  store: MultiplayerSnapshotStore,
  delivery: MultiplayerDeliveryStore,
  receipt: MultiplayerPatchReceiptRecord,
  sequence: MultiplayerSequenceRecord,
): Promise<boolean> => {
  if (!isSessionSnapshotMessage(message)) throw new Error('invalid_session_snapshot');
  if (store.persistAcceptedSnapshot) {
    const persisted = await store.persistAcceptedSnapshot({
      session: cloneJson(message.session), roomId: message.roomId, revision: message.revision,
      updatedAt: message.updatedAt, receipt, sequence,
    });
    return persisted !== false;
  } else {
    // Custom/in-memory stores used outside IndexedDB retain the same write order.
    if (!await persistMultiplayerSnapshot(message, store)) return false;
    await delivery.putSequence(sequence);
    await delivery.putReceipt(receipt);
    return true;
  }
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
  store: Pick<MultiplayerCompletionReleaseStore, 'putSession' | 'putTemplate' | 'deleteRoom' | 'releaseRoomOwnership'>;
  roomId: string;
  session: GameSession;
  template?: GameTemplate;
  completedAt: number;
  shouldPersist?: () => boolean;
}): Promise<GameSession | null> => {
  if (options.shouldPersist?.() === false) return null;
  const localSession: GameSession = {
    ...cloneJson(options.session),
    status: 'active',
    lastUpdatedAt: options.completedAt,
  };
  if (options.store.releaseRoomOwnership) {
    if (await options.store.releaseRoomOwnership({ roomId: options.roomId, session: localSession,
      ...(options.shouldPersist ? { shouldPersist: options.shouldPersist } : {}),
      ...(options.template ? { template: options.template } : {}) }) === false) return null;
  } else {
    if (options.template) await options.store.putTemplate?.(options.template);
    if (options.shouldPersist?.() === false) return null;
    await options.store.putSession(localSession);
    if (options.shouldPersist?.() === false) return null;
    await options.store.deleteRoom(options.roomId);
  }
  return localSession;
};
