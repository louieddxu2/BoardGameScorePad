import { describe, it, expect } from 'vitest';
import { db } from './db';

describe('database schema guard (v33)', () => {
  it('keeps expected schema version', () => {
    expect(db.verno).toBe(33);
  });

  it('includes key tables required by migration path', () => {
    const schema = (db as any)._dbSchema;

    expect(schema).toBeTruthy();
    expect(schema.history).toBeTruthy();
    expect(schema.savedPlayers).toBeTruthy();
    expect(schema.savedLocations).toBeTruthy();
    expect(schema.savedCurrentSession).toBeTruthy();
    expect(schema.multiplayerRooms).toBeTruthy();
    expect(schema.savedGameLifecycleContexts).toBeTruthy();
  });

  it('keeps expected primary keys for critical entities', () => {
    const schema = (db as any)._dbSchema;

    expect(schema.history.primKey.keyPath).toBe('id');
    expect(schema.savedPlayers.primKey.keyPath).toBe('id');
    expect(schema.savedLocations.primKey.keyPath).toBe('id');
    expect(schema.savedCurrentSession.primKey.keyPath).toBe('id');
    expect(schema.multiplayerRooms.primKey.keyPath).toBe('roomId');
    expect(schema.multiplayerOutbox).toBeTruthy();
    expect(schema.multiplayerPatchReceipts).toBeTruthy();
    expect(schema.multiplayerParticipantBindings).toBeTruthy();
    expect(schema.savedGameLifecycleContexts.primKey.keyPath).toBe('id');
  });
});

