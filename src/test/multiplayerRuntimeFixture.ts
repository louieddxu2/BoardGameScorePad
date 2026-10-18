import { util } from 'peerjs';
import type { GameSession, GameTemplate, MultiplayerParticipantBindingRecord, MultiplayerRoomRecord } from '../types';
import type { MultiplayerDeliveryStore } from '../features/multiplayer/multiplayerDeliveryStore';
import type { MultiplayerParticipantBindingStore } from '../features/multiplayer/multiplayerParticipantBinding';
import type { MultiplayerPlayerRoomStore, MultiplayerRoomRecoveryStore } from '../features/multiplayer/multiplayerRoomRuntime';

// Shared with the existing four-player simulation. Each simulated device gets
// its own store; the rendered participant can instead use the real Dexie store.
export const createRuntimeStore = (): MultiplayerRoomRecoveryStore & MultiplayerPlayerRoomStore & {
  deleteSession(id: string): Promise<void>;
  releaseRoomOwnership(options: { roomId: string; session: GameSession; template?: GameTemplate; shouldPersist?: () => boolean }): Promise<boolean>;
} => {
  const templates = new Map<string, GameTemplate>();
  const sessions = new Map<string, GameSession>();
  const rooms = new Map<string, MultiplayerRoomRecord>();
  return {
    getTemplate: async id => templates.get(id),
    getRoom: async id => rooms.get(id),
    getSession: async id => sessions.get(id),
    putTemplate: async value => { templates.set(value.id, value); },
    putSession: async value => { sessions.set(value.id, value); },
    putRoom: async value => { rooms.set(value.roomId, value); },
    persistBootstrap: async ({ template, session, room, requireExistingSession, shouldPersist }) => {
      if (shouldPersist?.() === false || (requireExistingSession && !sessions.has(session.id))) return false;
      if (template) templates.set(template.id, template);
      sessions.set(session.id, session);
      rooms.set(room.roomId, room);
      return true;
    },
    releaseRoomOwnership: async ({ roomId, session, template, shouldPersist }) => {
      if (shouldPersist?.() === false) return false;
      const exists = sessions.has(session.id);
      if (exists) {
        sessions.set(session.id, session);
        if (template) templates.set(template.id, template);
      }
      rooms.delete(roomId);
      return exists;
    },
    deleteSession: async id => { sessions.delete(id); },
    updateRoomRevision: async (roomId, revision, updatedAt) => {
      const room = rooms.get(roomId);
      if (room) rooms.set(roomId, { ...room, revision, updatedAt });
    },
    deleteRoom: async id => { rooms.delete(id); },
  };
};

export const createDeliveryStore = (): MultiplayerDeliveryStore => {
  const outbox = new Map<string, any>();
  const receipts = new Map<string, any>();
  const sequences = new Map<string, any>();
  return {
    getDevice: async () => undefined, putDevice: async () => undefined,
    getSequence: async id => sequences.get(id), putSequence: async record => { sequences.set(record.id, record); },
    putOutbox: async record => { outbox.set(record.id, record); },
    listOutbox: async (roomId, sessionId) => [...outbox.values()].filter(record => record.roomId === roomId && record.sessionId === sessionId),
    deleteOutbox: async id => { outbox.delete(id); },
    getReceipt: async id => receipts.get(id), putReceipt: async record => { receipts.set(record.id, record); },
  };
};

export const createBindingStore = (): MultiplayerParticipantBindingStore => {
  const records = new Map<string, MultiplayerParticipantBindingRecord>();
  return {
    get: async id => records.get(id), put: async record => { records.set(record.id, record); },
    delete: async id => { records.delete(id); },
  };
};

export const throughPeerJs = <T,>(message: T): T => {
  const bytes = util.pack(message as Parameters<typeof util.pack>[0]);
  if (!(bytes instanceof ArrayBuffer)) throw new Error('Unexpected async codec fixture');
  return util.unpack(bytes) as unknown as T;
};
