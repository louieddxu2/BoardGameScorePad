import { GameSession, GameTemplate, MultiplayerRoomRecord } from '../../types';
import {
  MULTIPLAYER_PROTOCOL_VERSION,
  BootstrapPackageMessage,
  MultiplayerRole,
  MultiplayerRoomInfo,
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

const serializePayload = (payload: ScoreStatePayload): Blob => {
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

const parsePayload = async (item: SyncItem, roomId: string): Promise<BootstrapPackageMessage> => {
  let payload: unknown;
  try {
    payload = JSON.parse(await readSyncItemPayload(item.payload));
  } catch {
    throw new Error('invalid_score_state_item');
  }

  const bootstrap = {
    version: MULTIPLAYER_PROTOCOL_VERSION,
    ...(payload as Record<string, unknown>),
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
    await options.store.applyRemoteBootstrap(await parsePayload(item, options.roomId));
  },
});
