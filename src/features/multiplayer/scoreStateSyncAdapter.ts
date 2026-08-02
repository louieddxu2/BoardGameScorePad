import { GameSession, GameTemplate, MultiplayerRoomRecord } from '../../types';
import {
  MULTIPLAYER_PROTOCOL_VERSION,
  BootstrapPackageMessage,
  MultiplayerRole,
  MultiplayerRoomInfo,
  SessionCompletedMessage,
  isSessionCompletedMessage,
  isSessionBootstrapPackage,
} from './protocol';

export interface SyncScope {
  sessionStart: number;
  roomKey: string;
}

export interface SyncItemMeta {
  id: string;
  version: number;
}

export interface SyncItem {
  id: string;
  version: number;
  payload: Blob;
  meta?: Record<string, unknown>;
}

export interface ScoreStateSyncStore {
  getRoom(roomId: string): Promise<MultiplayerRoomRecord | undefined>;
  getSession(sessionId: string): Promise<GameSession | undefined>;
  getTemplate(templateId: string): Promise<GameTemplate | undefined>;
  applyRemoteBootstrap(message: BootstrapPackageMessage): Promise<void>;
}

export interface ScoreStateSyncAdapter {
  getScope(): SyncScope;
  listMetas(): Promise<SyncItemMeta[]>;
  getItem(id: string): Promise<SyncItem | null>;
  upsertRemoteItem(item: SyncItem): Promise<void>;
}

interface ScoreStatePayload {
  room: MultiplayerRoomInfo;
  template: GameTemplate;
  session: GameSession;
  revision: number;
  exportedAt: number;
}

const serializePayload = (payload: ScoreStatePayload | SessionCompletedMessage): Blob => {
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
};

export const readSyncItemPayload = async (blob: Blob): Promise<string> => {
  if (typeof (blob as Blob & { text?: () => Promise<string> }).text === 'function') {
    return (blob as Blob & { text: () => Promise<string> }).text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
};

const parsePayload = async (item: SyncItem, roomId: string): Promise<BootstrapPackageMessage | SessionCompletedMessage> => {
  let payload: unknown;
  try {
    payload = JSON.parse(await readSyncItemPayload(item.payload));
  } catch {
    throw new Error('invalid_score_state_item');
  }

  if (item.meta?.kind === 'session-completion') {
    if (!isSessionCompletedMessage(payload) || payload.roomId !== roomId || payload.sessionId !== item.id || payload.revision !== item.version) {
      throw new Error('invalid_score_completion_item');
    }
    return payload;
  }

  const bootstrap = {
    ...(payload as Record<string, unknown>),
    version: MULTIPLAYER_PROTOCOL_VERSION,
  };

  if (!isSessionBootstrapPackage(bootstrap) ||
    bootstrap.room.roomId !== roomId ||
    bootstrap.session.id !== item.id ||
    bootstrap.revision !== item.version) {
    throw new Error('invalid_score_state_item');
  }

  return {
    type: 'room:bootstrap',
    roomId,
    package: bootstrap,
  };
};

/**
 * Adapter for the metadata-first P2P handshake kit. Only the host publishes
 * canonical score-state; player writes arrive through compact score patches.
 */
export const createScoreStateSyncAdapter = (options: {
  roomId: string;
  role: MultiplayerRole;
  store: ScoreStateSyncStore;
  onRemoteCompletion?: (message: SessionCompletedMessage) => void | Promise<void>;
}): ScoreStateSyncAdapter => ({
  getScope() {
    return { sessionStart: 0, roomKey: options.roomId };
  },

  async listMetas() {
    const room = await options.store.getRoom(options.roomId);
    if (!room) return [];
    return [{ id: room.sessionId, version: room.revision }];
  },

  async getItem(id) {
    if (options.role !== 'host') return null;

    const room = await options.store.getRoom(options.roomId);
    if (!room || room.sessionId !== id) return null;

    if (room.status === 'completed') {
      const [session, template] = await Promise.all([
        Promise.resolve(room.completedSession ?? options.store.getSession(room.sessionId)),
        Promise.resolve(room.completedTemplate ?? options.store.getTemplate(room.templateId)),
      ]);
      if (!session || !template) return null;
      const completedAt = room.completedAt ?? room.updatedAt;
      const finalSession: GameSession = {
        ...session,
        status: 'completed',
        lastUpdatedAt: completedAt,
      };
      const completion: SessionCompletedMessage = {
        type: 'session:completed',
        roomId: room.roomId,
        sessionId: session.id,
        template,
        finalSession,
        revision: room.revision,
        completedAt,
      };
      return {
        id: session.id,
        version: room.revision,
        meta: { kind: 'session-completion' },
        payload: serializePayload(completion),
      };
    }

    const [session, template] = await Promise.all([
      options.store.getSession(room.sessionId),
      options.store.getTemplate(room.templateId),
    ]);
    if (!session || !template) return null;

    return {
      id: session.id,
      version: room.revision,
      meta: { kind: 'score-state' },
      payload: serializePayload({
        room: {
          roomId: room.roomId,
          hostDeviceId: room.hostDeviceId,
          createdAt: room.createdAt,
        },
        template,
        session,
        revision: room.revision,
        exportedAt: room.updatedAt,
      }),
    };
  },

  async upsertRemoteItem(item) {
    if (options.role !== 'player') return;
    const payload = await parsePayload(item, options.roomId);
    if (isSessionCompletedMessage(payload)) {
      await options.onRemoteCompletion?.(payload);
      return;
    }
    await options.store.applyRemoteBootstrap(payload);
  },
});
