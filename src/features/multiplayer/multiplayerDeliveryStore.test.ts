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

  it('keys delivery operations by room, source device, and operation id', () => {
    expect(scorePatchOperationKey('room-1', 'device-1', 'op-1')).toBe('room-1:device-1:op-1');
  });
});
