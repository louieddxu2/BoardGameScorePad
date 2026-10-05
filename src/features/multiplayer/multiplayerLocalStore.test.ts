import { describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { multiplayerLocalStore } from './multiplayerLocalStore';
import { multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { persistAcceptedMultiplayerSnapshot } from './multiplayerPersistence';
import { SessionSnapshotMessage } from './protocol';

describe('multiplayerLocalStore purgeRoomData & deleteRoom', () => {
  it('commits an accepted snapshot, revision, watermark and receipt in one transaction', async () => {
    const putSession = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1');
    const updateRoom = vi.spyOn(db.multiplayerRooms, 'update').mockResolvedValue(1);
    const putSequence = vi.spyOn(db.multiplayerSequences, 'put').mockResolvedValue('watermark');
    const putReceipt = vi.spyOn(db.multiplayerPatchReceipts, 'put').mockResolvedValue('receipt');
    const transaction = vi.spyOn(db, 'transaction').mockImplementation(((mode: unknown, tables: unknown, callback: () => Promise<unknown>) => {
      expect(mode).toBe('rw');
      expect(tables).toEqual([db.sessions, db.multiplayerRooms, db.multiplayerPatchReceipts, db.multiplayerSequences]);
      return callback();
    }) as any);
    const snapshot: SessionSnapshotMessage = {
      type: 'session:snapshot', roomId: 'room-1', sessionId: 'session-1', revision: 2, updatedAt: 20,
      session: { id: 'session-1', templateId: 'template-1', name: 'Test', startTime: 1, status: 'active', players: [] },
    };
    const sequence = { id: 'room-1:accepted:session-1:device:p1:p1:score:points', nextSequence: 3, updatedAt: 20 };
    const receipt = { id: 'room-1:device:op-1', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device', opId: 'op-1', acceptedRevision: 2, updatedAt: 20 };
    try {
      await persistAcceptedMultiplayerSnapshot(snapshot, multiplayerLocalStore, multiplayerDeliveryStore, receipt, sequence);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(putSession).toHaveBeenCalledExactlyOnceWith(snapshot.session);
      expect(updateRoom).toHaveBeenCalledExactlyOnceWith('room-1', { revision: 2, updatedAt: 20 });
      expect(putSequence).toHaveBeenCalledExactlyOnceWith(sequence);
      expect(putReceipt).toHaveBeenCalledExactlyOnceWith(receipt);
      putReceipt.mockRejectedValueOnce(new Error('receipt write failed'));
      await expect(persistAcceptedMultiplayerSnapshot(snapshot, multiplayerLocalStore, multiplayerDeliveryStore, receipt, sequence)).rejects.toThrow('receipt write failed');
    } finally {
      for (const spy of [transaction, putSession, updateRoom, putSequence, putReceipt]) spy.mockRestore();
    }
  });
  it('returns room ownership and purges room data in one transaction', async () => {
    const putSessionSpy = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1' as any);
    const deleteRoomSpy = vi.spyOn(db.multiplayerRooms, 'delete').mockResolvedValue(undefined as any);
    const outboxWhereSpy = vi.spyOn(db.multiplayerOutbox, 'where').mockReturnValue({ equals: vi.fn().mockReturnValue({ delete: vi.fn().mockResolvedValue(1) }) } as any);
    const bindingWhereSpy = vi.spyOn(db.multiplayerParticipantBindings, 'where').mockReturnValue({ equals: vi.fn().mockReturnValue({ delete: vi.fn().mockResolvedValue(1) }) } as any);
    const receiptWhereSpy = vi.spyOn(db.multiplayerPatchReceipts, 'where').mockReturnValue({ equals: vi.fn().mockReturnValue({ delete: vi.fn().mockResolvedValue(1) }) } as any);
    const sequenceWhereSpy = vi.spyOn(db.multiplayerSequences, 'where').mockReturnValue({
      startsWith: vi.fn().mockReturnValue({ delete: vi.fn().mockResolvedValue(1) }),
      equals: vi.fn().mockReturnValue({ delete: vi.fn().mockResolvedValue(1) }),
    } as any);
    const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(((mode: unknown, tables: unknown, callback: () => Promise<unknown>) => {
      expect(mode).toBe('rw');
      expect(tables).toEqual([
        db.sessions,
        db.multiplayerRooms,
        db.multiplayerOutbox,
        db.multiplayerParticipantBindings,
        db.multiplayerPatchReceipts,
        db.multiplayerSequences,
      ]);
      return callback();
    }) as any);

    try {
      await multiplayerLocalStore.releaseRoomOwnership!({ roomId: 'room-1', session: { id: 'session-1' } as any });

      expect(putSessionSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
      expect(deleteRoomSpy).toHaveBeenCalledWith('room-1');
      expect(outboxWhereSpy).toHaveBeenCalledWith('roomId');
      expect(bindingWhereSpy).toHaveBeenCalledWith('roomId');
      expect(receiptWhereSpy).toHaveBeenCalledWith('roomId');
      expect(sequenceWhereSpy).toHaveBeenCalledWith('id');
    } finally {
      transactionSpy.mockRestore();
      putSessionSpy.mockRestore();
      deleteRoomSpy.mockRestore();
      outboxWhereSpy.mockRestore();
      bindingWhereSpy.mockRestore();
      receiptWhereSpy.mockRestore();
      sequenceWhereSpy.mockRestore();
    }
  });

  it('persists bootstrap records in one transaction', async () => {
    const putTemplateSpy = vi.spyOn(db.templates, 'put').mockResolvedValue('template-1' as any);
    const putSessionSpy = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1' as any);
    const putRoomSpy = vi.spyOn(db.multiplayerRooms, 'put').mockResolvedValue('room-1' as any);
    const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(((mode: unknown, tables: unknown, callback: () => Promise<unknown>) => {
      expect(mode).toBe('rw');
      expect(tables).toEqual([db.templates, db.sessions, db.multiplayerRooms]);
      return callback();
    }) as any);

    try {
      await multiplayerLocalStore.persistBootstrap!({
        template: { id: 'template-1' } as any,
        session: { id: 'session-1', templateId: 'template-1' } as any,
        room: { roomId: 'room-1', sessionId: 'session-1' } as any,
      });

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(putTemplateSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'template-1' }));
      expect(putSessionSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
      expect(putRoomSpy).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-1' }));
    } finally {
      transactionSpy.mockRestore();
      putTemplateSpy.mockRestore();
      putSessionSpy.mockRestore();
      putRoomSpy.mockRestore();
    }
  });

  it('purges orphan data across all 5 multiplayer tables for a specified roomId', async () => {
    const deleteRoomSpy = vi.spyOn(db.multiplayerRooms, 'delete').mockResolvedValue(undefined as any);

    const outboxDeleteSpy = vi.fn().mockResolvedValue(1);
    const outboxWhereSpy = vi.spyOn(db.multiplayerOutbox, 'where').mockReturnValue({
      equals: vi.fn().mockReturnValue({ delete: outboxDeleteSpy }),
    } as any);

    const bindingDeleteSpy = vi.fn().mockResolvedValue(1);
    const bindingWhereSpy = vi.spyOn(db.multiplayerParticipantBindings, 'where').mockReturnValue({
      equals: vi.fn().mockReturnValue({ delete: bindingDeleteSpy }),
    } as any);

    const receiptDeleteSpy = vi.fn().mockResolvedValue(1);
    const receiptWhereSpy = vi.spyOn(db.multiplayerPatchReceipts, 'where').mockReturnValue({
      equals: vi.fn().mockReturnValue({ delete: receiptDeleteSpy }),
    } as any);

    const seqStartsWithDeleteSpy = vi.fn().mockResolvedValue(1);
    const seqEqualsDeleteSpy = vi.fn().mockResolvedValue(1);
    const sequenceWhere = ((field: unknown) => {
      if (field === 'id') {
        return {
          startsWith: vi.fn().mockReturnValue({ delete: seqStartsWithDeleteSpy }),
          equals: vi.fn().mockReturnValue({ delete: seqEqualsDeleteSpy }),
        };
      }
      return {};
    }) as unknown as typeof db.multiplayerSequences.where;
    const seqWhereSpy = vi.spyOn(db.multiplayerSequences, 'where').mockImplementation(sequenceWhere);

    const transaction = async (_mode: unknown, _tables: unknown, cb: () => Promise<unknown>) => {
      return cb();
    };
    vi.spyOn(db, 'transaction').mockImplementation(transaction as unknown as typeof db.transaction);

    await multiplayerLocalStore.purgeRoomData('room-1');

    expect(deleteRoomSpy).toHaveBeenCalledWith('room-1');
    expect(outboxWhereSpy).toHaveBeenCalledWith('roomId');
    expect(outboxDeleteSpy).toHaveBeenCalled();
    expect(bindingWhereSpy).toHaveBeenCalledWith('roomId');
    expect(bindingDeleteSpy).toHaveBeenCalled();
    expect(receiptWhereSpy).toHaveBeenCalledWith('roomId');
    expect(receiptDeleteSpy).toHaveBeenCalled();
    expect(seqWhereSpy).toHaveBeenCalledWith('id');
    expect(seqStartsWithDeleteSpy).toHaveBeenCalled();
    expect(seqEqualsDeleteSpy).toHaveBeenCalled();
  });

  it('deleteRoom delegates to purgeRoomData', async () => {
    const purgeSpy = vi.spyOn(multiplayerLocalStore, 'purgeRoomData').mockResolvedValue();
    await multiplayerLocalStore.deleteRoom('room-test');
    expect(purgeSpy).toHaveBeenCalledWith('room-test');
  });
});
