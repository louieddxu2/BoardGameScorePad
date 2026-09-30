import { describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { MultiplayerDeliveryStore, getOrCreateMultiplayerDeviceId, reserveScorePatchSequence, reserveSequenceAndPutOutbox, scorePatchOperationKey } from './multiplayerDeliveryStore';

const records = new Map<string, any>();
const outboxRecords = new Map<string, any>();
const createStore = (): MultiplayerDeliveryStore => ({
  getDevice: async () => records.get('device'), putDevice: async (record) => { records.set('device', record); },
  getSequence: async (id) => records.get(`sequence:${id}`), putSequence: async (record) => { records.set(`sequence:${record.id}`, record); },
  putOutbox: async (record) => { outboxRecords.set(record.id, record); }, listOutbox: async () => [], deleteOutbox: async () => undefined,
  getReceipt: async () => undefined, putReceipt: async () => undefined,
});

describe('multiplayer delivery store helpers', () => {
  it('keeps one durable device id and monotonic per-cell sequences', async () => {
    records.clear();
    outboxRecords.clear();
    const store = createStore();
    const first = await getOrCreateMultiplayerDeviceId(store, () => 10);
    const second = await getOrCreateMultiplayerDeviceId(store, () => 20);
    expect(second).toBe(first);
    await expect(reserveScorePatchSequence({ store, key: 'room:p1:points', now: () => 30 })).resolves.toBe(1);
    await expect(reserveScorePatchSequence({ store, key: 'room:p1:points', now: () => 40 })).resolves.toBe(2);
  });

  it('enqueues the reserved sequence and outbox record in one IndexedDB transaction', async () => {
    records.clear();
    outboxRecords.clear();
    const store = createStore();
    const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(((...args: any[]) => {
      expect(args[0]).toBe('rw');
      expect(args[1]).toBe(db.multiplayerSequences);
      expect(args[2]).toBe(db.multiplayerOutbox);
      return args[args.length - 1]();
    }) as any);
    vi.stubGlobal('indexedDB', {});

    try {
      const message = await reserveSequenceAndPutOutbox({
        store,
        key: 'room:device:p1:points',
        now: () => 30,
        createMessage: (sequence) => ({
          type: 'score:valuePatch' as const,
          roomId: 'room', sessionId: 'session', opId: 'op-1', deviceId: 'device', sequence,
          patch: { actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: null },
          updatedAt: 40,
        }),
      });

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(message.sequence).toBe(1);
      expect(records.get('sequence:room:device:p1:points')).toMatchObject({ nextSequence: 2, updatedAt: 30 });
      expect(outboxRecords.get('room:device:op-1')?.message).toEqual(message);
    } finally {
      transactionSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('does not leave a sequence behind when the outbox write fails', async () => {
    records.clear();
    outboxRecords.clear();
    const baseStore = createStore();
    const store: MultiplayerDeliveryStore = {
      ...baseStore,
      putOutbox: async () => { throw new Error('outbox write failed'); },
    };
    const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(((...args: any[]) => {
      const recordsBefore = new Map(records);
      const outboxRecordsBefore = new Map(outboxRecords);
      return Promise.resolve(args[args.length - 1]()).catch((error) => {
        records.clear();
        recordsBefore.forEach((value, key) => records.set(key, value));
        outboxRecords.clear();
        outboxRecordsBefore.forEach((value, key) => outboxRecords.set(key, value));
        throw error;
      });
    }) as any);
    vi.stubGlobal('indexedDB', {});

    try {
      await expect(reserveSequenceAndPutOutbox({
        store,
        key: 'room:device:p1:points',
        now: () => 30,
        createMessage: (sequence) => ({
          type: 'score:valuePatch' as const,
          roomId: 'room', sessionId: 'session', opId: 'op-failed', deviceId: 'device', sequence,
          patch: { actor: { role: 'player' as const, playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points', scoreValue: null },
          updatedAt: 40,
        }),
      })).rejects.toThrow('outbox write failed');

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(records.has('sequence:room:device:p1:points')).toBe(false);
      expect(outboxRecords.size).toBe(0);
    } finally {
      transactionSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('keys delivery operations by room, source device, and operation id', () => {
    expect(scorePatchOperationKey('room-1', 'device-1', 'op-1')).toBe('room-1:device-1:op-1');
  });
});
