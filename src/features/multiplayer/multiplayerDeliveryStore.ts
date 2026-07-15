import {
  MultiplayerDeviceRecord,
  MultiplayerOutboxRecord,
  MultiplayerPatchReceiptRecord,
  MultiplayerSequenceRecord,
} from '../../types';
import { db } from '../../db';
import { ScoreValuePatchMessage, TotalAdjustmentPatchMessage } from './protocol';
import { generateId } from '../../utils/idGenerator';

export interface MultiplayerDeliveryStore {
  getDevice(): Promise<MultiplayerDeviceRecord | undefined>;
  putDevice(record: MultiplayerDeviceRecord): Promise<unknown>;
  getSequence(id: string): Promise<MultiplayerSequenceRecord | undefined>;
  putSequence(record: MultiplayerSequenceRecord): Promise<unknown>;
  putOutbox(record: MultiplayerOutboxRecord): Promise<unknown>;
  listOutbox(roomId: string, sessionId: string): Promise<MultiplayerOutboxRecord[]>;
  deleteOutbox(id: string): Promise<unknown>;
  getReceipt(id: string): Promise<MultiplayerPatchReceiptRecord | undefined>;
  putReceipt(record: MultiplayerPatchReceiptRecord): Promise<unknown>;
}

export const multiplayerDeliveryStore: MultiplayerDeliveryStore = {
  getDevice: () => db.multiplayerDevices.get('local-device'),
  putDevice: (record) => db.multiplayerDevices.put(record),
  getSequence: (id) => db.multiplayerSequences.get(id),
  putSequence: (record) => db.multiplayerSequences.put(record),
  putOutbox: (record) => db.multiplayerOutbox.put(record),
  listOutbox: (roomId, sessionId) => db.multiplayerOutbox.where('[roomId+sessionId]').equals([roomId, sessionId]).sortBy('createdAt'),
  deleteOutbox: (id) => db.multiplayerOutbox.delete(id),
  getReceipt: (id) => db.multiplayerPatchReceipts.get(id),
  putReceipt: (record) => db.multiplayerPatchReceipts.put(record),
};

export const getOrCreateMultiplayerDeviceId = async (
  store: MultiplayerDeliveryStore = multiplayerDeliveryStore,
  now: () => number = Date.now
): Promise<string> => {
  const existing = await store.getDevice();
  if (existing) return existing.deviceId;
  const createdAt = now();
  const record: MultiplayerDeviceRecord = {
    id: 'local-device', deviceId: generateId(), createdAt, updatedAt: createdAt,
  };
  await store.putDevice(record);
  return record.deviceId;
};

export const scorePatchSequenceKey = (message: Pick<ScoreValuePatchMessage, 'roomId' | 'deviceId' | 'patch'>): string => {
  const actorId = message.patch.actor.role === 'player' ? message.patch.actor.playerId : 'host';
  return `${message.roomId}:${message.deviceId}:${actorId}:${message.patch.targetPlayerId}:${message.patch.colId}`;
};

export const reserveScorePatchSequence = async (options: {
  store?: MultiplayerDeliveryStore;
  key: string;
  now?: () => number;
}): Promise<number> => {
  const store = options.store ?? multiplayerDeliveryStore;
  const now = options.now ?? Date.now;
  const current = await store.getSequence(options.key);
  const sequence = current?.nextSequence ?? 1;
  await store.putSequence({ id: options.key, nextSequence: sequence + 1, updatedAt: now() });
  return sequence;
};

export const scorePatchOperationKey = (roomId: string, deviceId: string, opId: string): string => `${roomId}:${deviceId}:${opId}`;

export const createOutboxRecord = (message: ScoreValuePatchMessage | TotalAdjustmentPatchMessage): MultiplayerOutboxRecord => ({
  id: scorePatchOperationKey(message.roomId, message.deviceId, message.opId),
  roomId: message.roomId,
  sessionId: message.sessionId,
  deviceId: message.deviceId,
  opId: message.opId,
  message,
  createdAt: message.updatedAt,
  updatedAt: message.updatedAt,
});
