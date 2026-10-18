import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import type { GameSession, GameTemplate } from '../../types';
import { createMultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import { createMultiplayerSessionManager } from './multiplayerSessionManager';
import { multiplayerLocalStore } from './multiplayerLocalStore';
import { multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { multiplayerParticipantBindingStore } from './multiplayerParticipantBinding';
import { MULTIPLAYER_PROTOCOL_VERSION } from './protocol';
import { act, renderHook } from '@testing-library/react';
import { useSessionManager } from '../../hooks/useSessionManager';
import { cleanupService } from '../../services/cleanupService';
import Dexie from 'dexie';

// Keep Dexie's actual transaction and promise-zone implementation. Only the
// browser storage backend is simulated; no production/user database is opened.
vi.mock('../../db', async () => {
  const { default: Dexie } = await import('dexie');
  const { indexedDB, IDBKeyRange } = await import('fake-indexeddb');
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  const database = new Dexie('multiplayer-room-exit-regression', { indexedDB, IDBKeyRange });
  database.version(1).stores({
    templates: 'id', builtins: 'id', sessions: 'id, templateId, status',
    multiplayerRooms: 'roomId, sessionId, templateId', multiplayerDevices: 'id',
    templatePrefs: 'templateId', templateShareCache: 'templateId', images: 'id, relatedId',
    multiplayerSequences: 'id',
    multiplayerOutbox: 'id, roomId, sessionId, [roomId+sessionId], deviceId',
    multiplayerParticipantBindings: 'id, roomId, sessionId, deviceId',
    multiplayerPatchReceipts: 'id, roomId',
  });
  Object.assign(database, { templateRegistry: { templates: null, templatePrefs: null,
    templateShareCache: null, multiplayerRooms: 'templateId', sessions: 'templateId' } });
  return { db: database };
});

vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../i18n/session', () => ({ useSessionTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/googleDrive', () => ({ googleDriveService: {}, getAutoConnectPreference: () => false }));
vi.mock('../recommendation/SessionPlayerInitializer', () => ({
  applyRecommendationsToPlayers: async (session: GameSession) => session.players,
}));

beforeEach(async () => { await db.open(); });
afterEach(async () => { await db.delete(); });

describe('participant room exit with real Dexie transactions', () => {
  it('can delete a board while its old room row is still awaiting cleanup', async () => {
    await db.templates.put({ id: 'board', name: 'Board', columns: [], createdAt: 1 });
    await db.multiplayerRooms.put({ roomId: 'room', sessionId: 'game', templateId: 'board',
      role: 'player', hostDeviceId: 'host', status: 'active', revision: 1, createdAt: 1, updatedAt: 1 });
    await cleanupService.fullTemplateCleanup('board');
    expect(await db.templates.get('board')).toBeUndefined();
    expect(await db.multiplayerRooms.get('room')).toBeUndefined();
  });

  it('does not commit a cancelled ownership handoff after waiting for a database writer', async () => {
    const session: GameSession = { id: 'game', templateId: 'board', name: 'Local', startTime: 1,
      status: 'active', players: [] };
    await db.sessions.put(session);
    await db.multiplayerRooms.put({ roomId: 'room', sessionId: session.id, templateId: session.templateId,
      role: 'player', hostDeviceId: 'host', status: 'active', revision: 1, createdAt: 1, updatedAt: 1 });
    let startWriter!: () => void;
    let finishWriter!: () => void;
    const started = new Promise<void>(resolve => { startWriter = resolve; });
    const gate = new Promise<void>(resolve => { finishWriter = resolve; });
    const writer = db.transaction('rw', db.sessions, async () => {
      startWriter();
      await Dexie.waitFor(gate);
    });
    await started;
    let active = true;
    const handoff = Dexie.ignoreTransaction(() => multiplayerLocalStore.releaseRoomOwnership!({
      roomId: 'room', session: { ...session, name: 'Late host result' }, shouldPersist: () => active,
    }));
    active = false;
    finishWriter();
    const [, persisted] = await Promise.all([writer, handoff]);
    expect(persisted).toBe(false);
    const [saved, room] = await Dexie.ignoreTransaction(() => Promise.all([
      db.sessions.get(session.id), db.multiplayerRooms.get('room'),
    ]));
    expect(saved).toEqual(session);
    expect(room).toBeDefined();
  });

  it.each([false, true])('can leave, discard, delete and start again (writes pending: %s)', async (writesPending) => {
    const template: GameTemplate = { id: 'board', name: 'Board', createdAt: 1,
      columns: [{ id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true }] };
    const session: GameSession = { id: 'game', templateId: template.id, name: template.name,
      startTime: 1, status: 'active', players: [{ id: 'p1', name: 'A', color: 'transparent', scores: {}, totalScore: 0 }] };
    const runtime = await createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: { type: 'room:bootstrap', roomId: 'room', package: {
        version: MULTIPLAYER_PROTOCOL_VERSION,
        room: { roomId: 'room', hostDeviceId: 'host', createdAt: 1 },
        template, session, revision: 1, exportedAt: 1,
      } },
      deviceId: 'guest', store: multiplayerLocalStore,
      deliveryStore: multiplayerDeliveryStore, bindingStore: multiplayerParticipantBindingStore,
      transport: { sendToHost: vi.fn(() => true), sendToConnection: vi.fn(() => true),
        broadcastLocalChanges: vi.fn(async () => {}), stop: vi.fn() },
    });
    const manager = createMultiplayerSessionManager();
    manager.register('room', runtime);
    const { result, unmount } = renderHook(() => useSessionManager({
      getTemplate: async id => (await multiplayerLocalStore.getTemplate(id)) ?? null,
      activeSessions: [runtime.session.session], isCloudEnabled: () => false, pinnedIds: [],
    }));
    await act(async () => { await result.current.resumeSessionById(session.id); });
    const write = runtime.controller.queueScoreValuePatch({ actor: { role: 'player', playerId: 'p1' },
      targetPlayerId: 'p1', colId: 'points', scoreValue: { parts: [7] } });
    const receive = runtime.receive({ type: 'session:snapshot', roomId: 'room', sessionId: session.id,
      session, revision: 2, updatedAt: 2 });
    if (!writesPending) await Promise.all([write, receive]);
    runtime.leaveRoom();
    await manager.closeRoom('room', { deleteLocalRoom: true, awaitLocalCleanup: false });
    await act(async () => { await result.current.discardSessionById(session.id); });
    expect(result.current.currentSession).toBeNull();
    expect(await db.sessions.get(session.id)).toBeUndefined();
    await cleanupService.fullTemplateCleanup(template.id);
    expect(await db.templates.get(template.id)).toBeUndefined();
    await manager.waitForRoomCleanup('room');
    await Promise.all([write, receive]);
    await db.templates.put(template);
    await act(async () => { expect(await result.current.startSession(template, 4)).toBeTruthy(); });
    const nextId = result.current.currentSession!.id;
    await act(async () => { await result.current.discardSessionById(nextId); });
    expect(await db.multiplayerRooms.count()).toBe(0);
    expect(await db.multiplayerOutbox.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(result.current.currentSession).toBeNull();
    unmount();
  });
});
