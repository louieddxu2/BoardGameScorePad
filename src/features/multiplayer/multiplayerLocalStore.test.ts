import { describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { multiplayerLocalStore } from './multiplayerLocalStore';

describe('multiplayerLocalStore purgeRoomData & deleteRoom', () => {
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
