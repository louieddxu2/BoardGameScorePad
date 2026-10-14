import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameSession } from '../../types';
import { db } from '../../db';
import { createLocalScoreStateSyncAdapter, multiplayerLocalStore } from './multiplayerLocalStore';
import { multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { persistAcceptedMultiplayerSnapshot, persistMultiplayerSnapshot } from './multiplayerPersistence';
import { SessionSnapshotMessage } from './protocol';
import { createScoreStateSyncItem } from './scoreStateSyncAdapter';

describe('multiplayerLocalStore purgeRoomData & deleteRoom', () => {
  afterEach(() => vi.restoreAllMocks());

  it('cancels queued and in-flight initial sync after its transport stops, without falling back to another import', async () => {
    let started!: () => void;
    let release!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const getTemplate = vi.spyOn(multiplayerLocalStore, 'getTemplate').mockImplementation(async () => {
      started(); await blocked; return undefined;
    });
    const persistBootstrap = vi.spyOn(multiplayerLocalStore, 'persistBootstrap').mockResolvedValue(true);
    const onRemoteBootstrap = vi.fn();
    const adapter = createLocalScoreStateSyncAdapter('room-1', 'player', { onRemoteBootstrap });
    const item = createScoreStateSyncItem({ room: { roomId: 'room-1', hostDeviceId: 'host', createdAt: 1 },
      template: { id: 'template-1', name: 'Test', columns: [], createdAt: 1 },
      session: { id: 'session-1', templateId: 'template-1', name: 'Test', startTime: 1, players: [], status: 'active' },
      revision: 2, exportedAt: 2 });
    const first = adapter.upsertRemoteItem(item);
    await reading;
    const queued = adapter.upsertRemoteItem(item);
    adapter.stop?.();
    release();
    await Promise.all([first, queued]);
    await adapter.upsertRemoteItem(item);
    expect(getTemplate).toHaveBeenCalledOnce();
    expect(persistBootstrap).not.toHaveBeenCalled();
    expect(onRemoteBootstrap).not.toHaveBeenCalled();
  });

  it('requires an existing session for live bootstrap and skips all related writes when its owner is missing', async () => {
    const modify = vi.fn().mockResolvedValue(0);
    vi.spyOn(db.sessions, 'where').mockReturnValue({ equals: vi.fn().mockReturnValue({ modify }) } as any);
    const putSession = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1');
    const putTemplate = vi.spyOn(db.templates, 'put').mockResolvedValue('template-1');
    const putRoom = vi.spyOn(db.multiplayerRooms, 'put').mockResolvedValue('room-1');
    vi.spyOn(db, 'transaction').mockImplementation(((mode: unknown, tables: unknown, callback: () => Promise<unknown>) => {
      expect(mode).toBe('rw');
      expect(tables).toEqual([db.templates, db.sessions, db.multiplayerRooms]);
      return callback();
    }) as any);
    expect(await multiplayerLocalStore.persistBootstrap({ requireExistingSession: true,
      template: { id: 'template-1' } as any, session: { id: 'session-1' } as any,
      room: { roomId: 'room-1' } as any })).toBe(false);
    expect(modify).toHaveBeenCalledOnce();
    for (const write of [putSession, putTemplate, putRoom]) expect(write).not.toHaveBeenCalled();
  });

  it('does not treat Dexie matched keys as a committed bootstrap if cancellation happens before modification', async () => {
    const row: { value: GameSession } = { value: { id: 'session-1', name: 'Old' } as GameSession };
    const shouldPersist = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const modify = vi.fn(async (replace: (this: { value: GameSession }) => unknown) => {
      expect(replace.call(row)).toBe(false);
      return 1; // Actual Dexie 3 behavior: one matched key, but no mutation.
    });
    vi.spyOn(db.sessions, 'where').mockReturnValue({ equals: vi.fn().mockReturnValue({ modify }) } as any);
    const putSession = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1');
    const putTemplate = vi.spyOn(db.templates, 'put').mockResolvedValue('template-1');
    const putRoom = vi.spyOn(db.multiplayerRooms, 'put').mockResolvedValue('room-1');
    vi.spyOn(db, 'transaction').mockImplementation(((_mode: unknown, _tables: unknown, callback: () => Promise<unknown>) => callback()) as any);
    expect(await multiplayerLocalStore.persistBootstrap({ requireExistingSession: true, shouldPersist,
      session: { id: 'session-1', name: 'Changed' } as GameSession, template: { id: 'template-1' } as any,
      room: { roomId: 'room-1' } as any })).toBe(false);
    expect(row.value.name).toBe('Old');
    for (const write of [putSession, putTemplate, putRoom]) expect(write).not.toHaveBeenCalled();
  });
  it('lets an active runtime consume template updates before standalone persistence and recovers after a failed import', async () => {
    const getTemplate = vi.spyOn(multiplayerLocalStore, 'getTemplate').mockResolvedValue(undefined);
    const persistBootstrap = vi.spyOn(multiplayerLocalStore, 'persistBootstrap').mockResolvedValue(undefined);
    const applyRemoteBootstrap = vi.fn().mockRejectedValueOnce(new Error('temporary import failure')).mockResolvedValue(true);
    const onRemoteBootstrap = vi.fn();
    const adapter = createLocalScoreStateSyncAdapter('room-1', 'player', { applyRemoteBootstrap, onRemoteBootstrap });
    const item = createScoreStateSyncItem({
      room: { roomId: 'room-1', hostDeviceId: 'host', createdAt: 1 },
      template: { id: 'template-1', name: 'Test', columns: [], createdAt: 1 },
      session: { id: 'session-1', templateId: 'template-1', name: 'Test', startTime: 1, players: [], status: 'active' },
      revision: 2, exportedAt: 2,
    });
    try {
      await expect(adapter.upsertRemoteItem(item)).rejects.toThrow('temporary import failure');
      await adapter.upsertRemoteItem(item);
      expect(applyRemoteBootstrap).toHaveBeenCalledTimes(2);
      expect(getTemplate).not.toHaveBeenCalled();
      expect(persistBootstrap).not.toHaveBeenCalled();
      expect(onRemoteBootstrap).not.toHaveBeenCalled();
    } finally {
      getTemplate.mockRestore();
      persistBootstrap.mockRestore();
    }
  });

  it.each(['local', 'accepted'] as const)('commits the %s snapshot and its forked template identity in the existing transaction', async kind => {
    const snapshot: SessionSnapshotMessage = {
      type: 'session:snapshot', roomId: 'room-1', sessionId: 'session-1', revision: 2, updatedAt: 20,
      session: { id: 'session-1', templateId: 'forked-template', name: 'Test', startTime: 1, status: 'active', players: [] },
    };
    const row: { value: GameSession } = { value: { ...snapshot.session, templateId: 'template-1', note: 'removed note' } };
    const modify = vi.fn(async (replace: (this: { value: GameSession }) => void) => {
      replace.call(row);
      return 1;
    });
    const equals = vi.fn().mockReturnValue({ modify });
    const where = vi.spyOn(db.sessions, 'where').mockReturnValue({ equals } as any);
    const putSession = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1');
    const updateRoom = vi.spyOn(db.multiplayerRooms, 'update').mockResolvedValue(1);
    const putSequence = vi.spyOn(db.multiplayerSequences, 'put').mockResolvedValue('watermark');
    const putReceipt = vi.spyOn(db.multiplayerPatchReceipts, 'put').mockResolvedValue('receipt');
    const transaction = vi.spyOn(db, 'transaction').mockImplementation(((mode: unknown, tables: unknown, callback: () => Promise<unknown>) => {
      expect(mode).toBe('rw');
      expect(tables).toEqual(kind === 'accepted'
        ? [db.sessions, db.multiplayerRooms, db.multiplayerPatchReceipts, db.multiplayerSequences]
        : [db.sessions, db.multiplayerRooms]);
      return callback();
    }) as any);
    const sequence = { id: 'room-1:accepted:session-1:device:p1:p1:score:points', nextSequence: 3, updatedAt: 20 };
    const receipt = { id: 'room-1:device:op-1', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device', opId: 'op-1', acceptedRevision: 2, updatedAt: 20 };
    try {
      const result = kind === 'accepted'
        ? await persistAcceptedMultiplayerSnapshot(snapshot, multiplayerLocalStore, multiplayerDeliveryStore, receipt, sequence)
        : await persistMultiplayerSnapshot(snapshot, multiplayerLocalStore);
      expect(result).toEqual(kind === 'accepted' ? true : snapshot.session);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(where).toHaveBeenCalledExactlyOnceWith('id');
      expect(equals).toHaveBeenCalledExactlyOnceWith('session-1');
      expect(modify).toHaveBeenCalledOnce();
      expect(row.value).toEqual(snapshot.session);
      expect(row.value).not.toHaveProperty('note');
      expect(putSession).not.toHaveBeenCalled();
      expect(updateRoom).toHaveBeenCalledExactlyOnceWith('room-1', { templateId: 'forked-template', revision: 2, updatedAt: 20 });
      if (kind === 'accepted') {
        expect(putSequence).toHaveBeenCalledExactlyOnceWith(sequence);
        expect(putReceipt).toHaveBeenCalledExactlyOnceWith(receipt);
        putReceipt.mockRejectedValueOnce(new Error('receipt write failed'));
        await expect(persistAcceptedMultiplayerSnapshot(snapshot, multiplayerLocalStore, multiplayerDeliveryStore, receipt, sequence)).rejects.toThrow('receipt write failed');
      } else {
        expect(putSequence).not.toHaveBeenCalled();
        expect(putReceipt).not.toHaveBeenCalled();
      }
    } finally {
      for (const spy of [transaction, where, putSession, updateRoom, putSequence, putReceipt]) spy.mockRestore();
    }
  });

  it.each(['local', 'accepted'] as const)('does not recreate a deleted owner or commit delivery metadata for a %s snapshot', async kind => {
    const modify = vi.fn().mockResolvedValue(0);
    const equals = vi.fn().mockReturnValue({ modify });
    const where = vi.spyOn(db.sessions, 'where').mockReturnValue({ equals } as any);
    const putSession = vi.spyOn(db.sessions, 'put').mockResolvedValue('session-1');
    const updateRoom = vi.spyOn(db.multiplayerRooms, 'update').mockResolvedValue(1);
    const putSequence = vi.spyOn(db.multiplayerSequences, 'put').mockResolvedValue('watermark');
    const putReceipt = vi.spyOn(db.multiplayerPatchReceipts, 'put').mockResolvedValue('receipt');
    const transaction = vi.spyOn(db, 'transaction').mockImplementation(((mode: unknown, tables: unknown, callback: () => Promise<unknown>) => {
      expect(mode).toBe('rw');
      expect(tables).toEqual(kind === 'local' ? [db.sessions, db.multiplayerRooms]
        : [db.sessions, db.multiplayerRooms, db.multiplayerPatchReceipts, db.multiplayerSequences]);
      return callback();
    }) as any);
    const snapshot: SessionSnapshotMessage = {
      type: 'session:snapshot', roomId: 'room-1', sessionId: 'session-1', revision: 2, updatedAt: 20,
      session: { id: 'session-1', templateId: 'template-1', name: 'Test', startTime: 1, status: 'active', players: [] },
    };
    const result = kind === 'local' ? await persistMultiplayerSnapshot(snapshot, multiplayerLocalStore)
      : await persistAcceptedMultiplayerSnapshot(snapshot, multiplayerLocalStore, multiplayerDeliveryStore,
        { id: 'room-1:device:op-1', roomId: 'room-1', sessionId: 'session-1', deviceId: 'device', opId: 'op-1', acceptedRevision: 2, updatedAt: 20 },
        { id: 'watermark', nextSequence: 3, updatedAt: 20 });
    expect(result).toBe(kind === 'local' ? null : false);
    expect(transaction).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledExactlyOnceWith('id');
    expect(equals).toHaveBeenCalledExactlyOnceWith('session-1');
    expect(modify).toHaveBeenCalledOnce();
    for (const write of [putSession, updateRoom, putSequence, putReceipt]) expect(write).not.toHaveBeenCalled();
  });
  it.each([true, false])('purges room data atomically without recreating a missing session (owner exists: %s)', async ownerExists => {
    const replacement: { value: GameSession } = { value: { id: 'session-1' } as GameSession };
    const modify = vi.fn(async (replace: (this: { value: GameSession }) => void) => {
      if (!ownerExists) return 0;
      replace.call(replacement);
      return 1;
    });
    const sessionsWhere = vi.spyOn(db.sessions, 'where').mockReturnValue({ equals: vi.fn().mockReturnValue({ modify }) } as any);
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
      expect(await multiplayerLocalStore.releaseRoomOwnership!({ roomId: 'room-1', session: { id: 'session-1' } as any })).toBe(ownerExists);

      expect(sessionsWhere).toHaveBeenCalledExactlyOnceWith('id');
      expect(modify).toHaveBeenCalledOnce();
      expect(replacement.value.id).toBe('session-1');
      expect(putSessionSpy).not.toHaveBeenCalled();
      expect(deleteRoomSpy).toHaveBeenCalledWith('room-1');
      expect(outboxWhereSpy).toHaveBeenCalledWith('roomId');
      expect(bindingWhereSpy).toHaveBeenCalledWith('roomId');
      expect(receiptWhereSpy).toHaveBeenCalledWith('roomId');
      expect(sequenceWhereSpy).toHaveBeenCalledWith('id');
    } finally {
      transactionSpy.mockRestore();
      sessionsWhere.mockRestore();
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
