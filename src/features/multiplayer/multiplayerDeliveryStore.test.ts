import { describe, expect, it } from 'vitest';
import { MultiplayerDeliveryStore, getOrCreateMultiplayerDeviceId, reserveScorePatchSequence, scorePatchOperationKey } from './multiplayerDeliveryStore';

const records = new Map<string, any>();
const createStore = (): MultiplayerDeliveryStore => ({
  getDevice: async () => records.get('device'), putDevice: async (record) => { records.set('device', record); },
  getSequence: async (id) => records.get(`sequence:${id}`), putSequence: async (record) => { records.set(`sequence:${record.id}`, record); },
  putOutbox: async () => undefined, listOutbox: async () => [], deleteOutbox: async () => undefined,
  getReceipt: async () => undefined, putReceipt: async () => undefined,
});

describe('multiplayer delivery store helpers', () => {
  it('keeps one durable device id and monotonic per-cell sequences', async () => {
    records.clear();
    const store = createStore();
    const first = await getOrCreateMultiplayerDeviceId(store, () => 10);
    const second = await getOrCreateMultiplayerDeviceId(store, () => 20);
    expect(second).toBe(first);
    await expect(reserveScorePatchSequence({ store, key: 'room:p1:points', now: () => 30 })).resolves.toBe(1);
    await expect(reserveScorePatchSequence({ store, key: 'room:p1:points', now: () => 40 })).resolves.toBe(2);
  });

  it('keys delivery operations by room, source device, and operation id', () => {
    expect(scorePatchOperationKey('room-1', 'device-1', 'op-1')).toBe('room-1:device-1:op-1');
  });
});
