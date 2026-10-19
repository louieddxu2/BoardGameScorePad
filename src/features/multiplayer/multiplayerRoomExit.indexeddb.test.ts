import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import type {
  GameSession,
  GameTemplate,
  MultiplayerOutboxRecord,
  MultiplayerParticipantBindingRecord,
  MultiplayerPatchReceiptRecord,
  MultiplayerRoomRecord,
  MultiplayerSequenceRecord,
} from '../../types';
import { createMultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';
import { createMultiplayerSessionManager } from './multiplayerSessionManager';
import { createMultiplayerLocalStore, multiplayerLocalStore } from './multiplayerLocalStore';
import { multiplayerDeliveryStore } from './multiplayerDeliveryStore';
import { multiplayerParticipantBindingStore } from './multiplayerParticipantBinding';
import { MULTIPLAYER_PROTOCOL_VERSION } from './protocol';
import { act, renderHook } from '@testing-library/react';
import { useSessionManager } from '../../hooks/useSessionManager';
import { cleanupService } from '../../services/cleanupService';
import Dexie from 'dexie';
import type { SessionSnapshotMessage } from './protocol';
import { persistMultiplayerSnapshot } from './multiplayerPersistence';
import { applyMultiplayerParticipantBootstrap } from './multiplayerParticipantJoin';
import { multiplayerSessionManager } from './multiplayerSessionManager';
import { imageService } from '../../services/imageService';

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
  const makeBootstrap = (roomId: string, template: GameTemplate, session: GameSession, revision = 1) => ({
    type: 'room:bootstrap' as const,
    roomId,
    package: {
      version: MULTIPLAYER_PROTOCOL_VERSION,
      room: { roomId, hostDeviceId: 'host', createdAt: 1 },
      template, session, revision, exportedAt: revision,
    },
  });

  const makePlayerRuntime = (roomId: string, template: GameTemplate, session: GameSession) =>
    createMultiplayerPlayerRoomRuntime({
      bootstrapMessage: makeBootstrap(roomId, template, session),
      deviceId: 'guest', store: multiplayerLocalStore,
      deliveryStore: multiplayerDeliveryStore, bindingStore: multiplayerParticipantBindingStore,
      transport: { sendToHost: vi.fn(() => true), sendToConnection: vi.fn(() => true),
        broadcastLocalChanges: vi.fn(async () => {}), stop: vi.fn() },
    });

  const gatedTemplateRead = () => {
    let finish!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let reads = 0;
    const getTemplate = async (id: string) => {
      reads += 1;
      const template = (await db.templates.get(id)) ?? null;
      if (reads === 2) {
        entered();
        await gate;
      }
      return template;
    };
    return { getTemplate, started, release: finish };
  };

  it('does not reactivate a departed session after discard and starting another board', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const roomId = 'late-bootstrap-room';
    const template: GameTemplate = { id: 'late-bootstrap-board', name: 'Board', createdAt: 1,
      columns: [{ id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true }] };
    const updatedTemplate: GameTemplate = { ...template,
      columns: [{ ...template.columns[0], formula: '2*a1' }] };
    const session: GameSession = { id: 'late-bootstrap-game', templateId: template.id, name: template.name,
      startTime: 1, status: 'active', players: [{ id: 'p1', name: 'A', color: 'transparent', scores: {}, totalScore: 0 }] };
    const runtime = await makePlayerRuntime(roomId, template, session);
    multiplayerSessionManager.register(roomId, runtime);
    const gate = gatedTemplateRead();
    const { result, unmount } = renderHook(() => useSessionManager({
      getTemplate: gate.getTemplate, activeSessions: [session], isCloudEnabled: () => false, pinnedIds: [],
    }));
    let resume: Promise<boolean> | undefined;
    try {
      await act(async () => { await result.current.resumeSessionById(session.id); });
      resume = applyMultiplayerParticipantBootstrap({
        roomId, bootstrapMessage: makeBootstrap(roomId, updatedTemplate, session, 2),
        resumeSession: (id, shouldActivate) => result.current.resumeSessionById(id, shouldActivate),
      });
      await gate.started;
      expect(runtime.session.template.columns[0].formula).toBe('2*a1');

      runtime.leaveRoom();
      act(() => { result.current.updateSession({ ...runtime.session.session, note: 'ordinary projection' }, { template: runtime.session.template }); });
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true, awaitLocalCleanup: false });
      await act(async () => { await result.current.discardSessionById(session.id); });
      const otherBoard: GameTemplate = { id: 'other-board', name: 'Other Board', createdAt: 3, columns: [] };
      await db.templates.put(otherBoard);
      await act(async () => { expect(await result.current.startSession(otherBoard, 1)).toBeTruthy(); });
      const newSessionId = result.current.currentSession!.id;
      act(() => { result.current.updateSession({ ...result.current.currentSession!, note: 'autosave survives stale resume' }); });

      gate.release();
      await act(async () => { await resume; });
      expect(result.current.currentSession?.id).toBe(newSessionId);
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(await db.sessions.get(newSessionId)).toMatchObject({ note: 'autosave survives stale resume' });
      expect(await db.sessions.get(session.id)).toBeUndefined();
    } finally {
      gate.release();
      await act(async () => { await resume?.catch(() => false); });
      unmount();
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true, awaitLocalCleanup: false });
      await multiplayerSessionManager.waitForRoomCleanup(roomId);
      vi.useRealTimers();
    }
  });

  it('does not replace a participant projection when a template reload finishes after leave', async () => {
    const roomId = 'late-reload-room';
    const template: GameTemplate = { id: 'late-reload-board', name: 'Board', createdAt: 1,
      columns: [{ id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true }] };
    const updatedTemplate: GameTemplate = { ...template,
      columns: [{ ...template.columns[0], formula: 'a1×c1', constants: { c1: 2 } }] };
    const session: GameSession = { id: 'late-reload-game', templateId: template.id, name: template.name,
      startTime: 1, status: 'active', players: [{ id: 'p1', name: 'A', color: 'transparent', scores: {}, totalScore: 0 }] };
    const confirmedSession: GameSession = { ...session,
      players: [{ ...session.players[0], scores: { points: { parts: [7] } }, totalScore: 14 }] };
    const runtime = await makePlayerRuntime(roomId, template, session);
    multiplayerSessionManager.register(roomId, runtime);
    const gate = gatedTemplateRead();
    const { result, unmount } = renderHook(() => useSessionManager({
      getTemplate: gate.getTemplate, activeSessions: [session], isCloudEnabled: () => false, pinnedIds: [],
    }));
    let resume: Promise<boolean> | undefined;
    try {
      await act(async () => { await result.current.resumeSessionById(session.id); });
      resume = applyMultiplayerParticipantBootstrap({
        roomId, bootstrapMessage: makeBootstrap(roomId, updatedTemplate, confirmedSession, 2),
        resumeSession: (id, shouldActivate) => result.current.resumeSessionById(id, shouldActivate),
      });
      await gate.started;
      expect(runtime.session.session.players[0].scores.points?.parts).toEqual([7]);
      expect(runtime.session.session.players[0].totalScore).toBe(14);
      const pendingPatch = runtime.controller.queueScoreValuePatch({
        actor: { role: 'player', playerId: 'p1' }, targetPlayerId: 'p1', colId: 'points',
        scoreValue: { parts: [8] },
      });
      await pendingPatch;
      expect(runtime.session.session.players[0].scores.points?.parts).toEqual([8]);
      expect(runtime.session.session.players[0].totalScore).toBe(16);
      runtime.leaveRoom();
      act(() => { result.current.updateSession(runtime.session.session, { template: runtime.session.template }); });
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true, awaitLocalCleanup: false });
      expect(result.current.currentSession?.players[0].scores.points?.parts).toEqual([8]);
      expect(result.current.currentSession?.players[0].totalScore).toBe(16);
      expect(result.current.activeTemplate?.columns[0]).toMatchObject({ formula: 'a1×c1', constants: { c1: 2 } });

      gate.release();
      await act(async () => { await resume; });
      expect(result.current.currentSession?.players[0].scores.points?.parts).toEqual([8]);
      expect(result.current.currentSession?.players[0].totalScore).toBe(16);
      expect(result.current.activeTemplate?.columns[0]).toMatchObject({ formula: 'a1×c1', constants: { c1: 2 } });
    } finally {
      gate.release();
      await act(async () => { await resume?.catch(() => false); });
      unmount();
      await multiplayerSessionManager.closeRoom(roomId, { deleteLocalRoom: true, awaitLocalCleanup: false });
      await multiplayerSessionManager.waitForRoomCleanup(roomId);
    }
  });

  it('does not activate an older resume or leak its image URL when a newer resume wins', async () => {
    const oldTemplate: GameTemplate = { id: 'old-image-board', name: 'Old', createdAt: 1, columns: [], imageId: 'old-image' };
    const newTemplate: GameTemplate = { id: 'new-image-board', name: 'New', createdAt: 2, columns: [] };
    const oldSession: GameSession = { id: 'old-image-game', templateId: oldTemplate.id, name: 'Old', startTime: 1, status: 'active', players: [] };
    const newSession: GameSession = { id: 'new-image-game', templateId: newTemplate.id, name: 'New', startTime: 2, status: 'active', players: [] };
    await db.templates.bulkPut([oldTemplate, newTemplate]);
    await db.sessions.bulkPut([oldSession, newSession]);
    let finishImage!: (value: { id: string; blob: Blob } | undefined) => void;
    let imageRequested!: () => void;
    const imageGate = new Promise<{ id: string; blob: Blob } | undefined>(resolve => { finishImage = resolve; });
    const requested = new Promise<void>(resolve => { imageRequested = resolve; });
    const getImage = vi.spyOn(imageService, 'getImage').mockImplementation(async () => {
      imageRequested();
      return imageGate as Promise<any>;
    });
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:late-resume');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSessionManager({
      getTemplate: async id => (await db.templates.get(id)) ?? null,
      activeSessions: [oldSession, newSession], isCloudEnabled: () => false, pinnedIds: [],
    }));
    try {
      let oldResume!: Promise<boolean>;
      act(() => { oldResume = result.current.resumeSessionById(oldSession.id); });
      await requested;
      await act(async () => { expect(await result.current.resumeSessionById(newSession.id)).toBe(true); });
      finishImage({ id: 'old-image', blob: new Blob(['late']) });
      await act(async () => { await oldResume; });
      expect(result.current.currentSession?.id).toBe(newSession.id);
      expect(createUrl).not.toHaveBeenCalled();
      expect(revokeUrl).not.toHaveBeenCalled();
    } finally {
      finishImage(undefined);
      unmount();
      getImage.mockRestore();
      createUrl.mockRestore();
      revokeUrl.mockRestore();
    }
  });

  it('does not overwrite received scores with the ordinary resume autosave', async () => {
    const template: GameTemplate = { id: 'autosave-board', name: 'Board', createdAt: 1,
      columns: [{ id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true }] };
    const session: GameSession = { id: 'autosave-game', templateId: template.id, name: template.name,
      startTime: 1, status: 'active', players: [{ id: 'p1', name: 'A', color: 'transparent', scores: {}, totalScore: 0 }] };
    await db.templates.put(template);
    await db.sessions.put(session);
    await db.multiplayerRooms.put({ roomId: 'autosave-room', sessionId: session.id, templateId: template.id,
      role: 'player', hostDeviceId: 'host', status: 'active', revision: 1, createdAt: 1, updatedAt: 1 });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result, unmount } = renderHook(() => useSessionManager({
      getTemplate: async id => (await multiplayerLocalStore.getTemplate(id)) ?? null,
      activeSessions: [session], isCloudEnabled: () => false, pinnedIds: [],
    }));
    try {
      await act(async () => { await result.current.resumeSessionById(session.id); });
      const confirmed = { ...session, players: [{ ...session.players[0], scores: { points: { parts: [7] } }, totalScore: 7 }] };
      await multiplayerLocalStore.persistSnapshot!({ session: confirmed, roomId: 'autosave-room', revision: 2, updatedAt: 2 });
      expect((await db.sessions.get(session.id))?.players[0].scores.points?.parts).toEqual([7]);
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect((await db.sessions.get(session.id))?.players[0].scores.points?.parts).toEqual([7]);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

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

  it('keeps a same-room rejoin and its delivery data when the old page drains later', async () => {
    const oldStore = createMultiplayerLocalStore();
    const newStore = createMultiplayerLocalStore();
    const session: GameSession = { id: 'game', templateId: 'board', name: 'Old', startTime: 1,
      status: 'active', players: [] };
    const room: MultiplayerRoomRecord = { roomId: 'room', sessionId: session.id, templateId: session.templateId,
      role: 'player' as const, hostDeviceId: 'host', status: 'active' as const,
      revision: 1, createdAt: 1, updatedAt: 1 };
    await oldStore.persistBootstrap({ session, room });

    let finishDrain!: () => void;
    const drain = new Promise<void>(resolve => { finishDrain = resolve; });
    const runtime = { role: 'player', session: { session }, stop: vi.fn(), whenIdle: () => drain } as any;
    const manager = createMultiplayerSessionManager(oldStore);
    manager.register(room.roomId, runtime);

    await manager.closeRoom(room.roomId, { deleteLocalRoom: true, awaitLocalCleanup: false });
    // The cleanup is intentionally still pending, but no IndexedDB transaction is open.
    const freshSession: GameSession = { ...session, name: 'New page session' };
    expect(await newStore.persistBootstrap({ session: freshSession, room: { ...room, revision: 7 } })).toBe(true);
    const binding: MultiplayerParticipantBindingRecord = { id: 'binding', roomId: room.roomId,
      sessionId: session.id, deviceId: 'device', playerId: 'p1', updatedAt: 7 };
    const outbox: MultiplayerOutboxRecord = { id: 'outbox', roomId: room.roomId, sessionId: session.id,
      deviceId: 'device', opId: 'op', message: { value: 7 }, createdAt: 7, updatedAt: 7 };
    const receipt: MultiplayerPatchReceiptRecord = { id: 'receipt', roomId: room.roomId, sessionId: session.id,
      deviceId: 'device', opId: 'op', acceptedRevision: 7, updatedAt: 7 };
    const sequence: MultiplayerSequenceRecord = { id: `${room.roomId}:device`, nextSequence: 8, updatedAt: 7 };
    await db.multiplayerParticipantBindings.put(binding);
    await db.multiplayerOutbox.put(outbox);
    await db.multiplayerPatchReceipts.put(receipt);
    await db.multiplayerSequences.put(sequence);

    finishDrain();
    await manager.waitForRoomCleanup(room.roomId);

    expect(await db.sessions.get(session.id)).toEqual(freshSession);
    expect(await db.multiplayerRooms.get(room.roomId)).toMatchObject({ revision: 7, localOwnerId: expect.any(String) });
    expect(await db.multiplayerParticipantBindings.get('binding')).toBeDefined();
    expect(await db.multiplayerOutbox.get('outbox')).toBeDefined();
    expect(await db.multiplayerPatchReceipts.get('receipt')).toBeDefined();
    expect(await db.multiplayerSequences.get(`${room.roomId}:device`)).toBeDefined();
  });

  it('rechecks the generation guard inside the transaction before purging an owned room', async () => {
    const store = createMultiplayerLocalStore();
    const session: GameSession = { id: 'owned-game', templateId: 'board', name: 'Owned', startTime: 1,
      status: 'active', players: [] };
    const room: MultiplayerRoomRecord = { roomId: 'owned-room', sessionId: session.id, templateId: session.templateId,
      role: 'player' as const, hostDeviceId: 'host', status: 'active' as const,
      revision: 1, createdAt: 1, updatedAt: 1 };
    await store.persistBootstrap({ session, room });
    const outbox: MultiplayerOutboxRecord = { id: 'owned-outbox', roomId: room.roomId,
      sessionId: session.id, deviceId: 'device', opId: 'op', message: {}, createdAt: 1, updatedAt: 1 };
    await db.multiplayerOutbox.put(outbox);

    const shouldPurge = vi.fn(() => false);
    await store.purgeOwnedRoomData(room.roomId, shouldPurge);
    expect(await db.multiplayerRooms.get(room.roomId)).toBeDefined();
    expect(await db.multiplayerOutbox.get('owned-outbox')).toBeDefined();
    expect(shouldPurge).toHaveBeenCalledOnce();

    await store.purgeOwnedRoomData(room.roomId, () => true);
    expect(await db.multiplayerRooms.get(room.roomId)).toBeUndefined();
    expect(await db.multiplayerOutbox.get('owned-outbox')).toBeUndefined();
  });

  it.each([
    { localOwnerId: undefined, sessionExists: true },
    { localOwnerId: undefined, sessionExists: false },
    { localOwnerId: 'closed-page', sessionExists: true },
    { localOwnerId: 'closed-page', sessionExists: false },
  ])('protects a foreign or legacy room only while its session exists ($localOwnerId, $sessionExists)', async ({ localOwnerId, sessionExists }) => {
    const store = createMultiplayerLocalStore();
    const session: GameSession = { id: 'legacy-game', templateId: 'board', name: 'Legacy', startTime: 1,
      status: 'active', players: [] };
    const room: MultiplayerRoomRecord = { roomId: 'legacy-room', sessionId: session.id, localOwnerId,
      templateId: session.templateId, role: 'player', hostDeviceId: 'host', status: 'active',
      revision: 1, createdAt: 1, updatedAt: 1 };
    const binding: MultiplayerParticipantBindingRecord = { id: 'legacy-binding', roomId: room.roomId,
      sessionId: session.id, deviceId: 'device', playerId: 'p1', updatedAt: 1 };
    const outbox: MultiplayerOutboxRecord = { id: 'legacy-outbox', roomId: room.roomId,
      sessionId: session.id, deviceId: 'device', opId: 'op', message: { value: 1 }, createdAt: 1, updatedAt: 1 };
    const receipt: MultiplayerPatchReceiptRecord = { id: 'legacy-receipt', roomId: room.roomId,
      sessionId: session.id, deviceId: 'device', opId: 'op', acceptedRevision: 1, updatedAt: 1 };
    const sequence: MultiplayerSequenceRecord = { id: `${room.roomId}:device`, nextSequence: 2, updatedAt: 1 };

    if (sessionExists) await db.sessions.put(session);
    await db.multiplayerRooms.put(room); // Not owned by the current store/page.
    await db.multiplayerParticipantBindings.put(binding);
    await db.multiplayerOutbox.put(outbox);
    await db.multiplayerPatchReceipts.put(receipt);
    await db.multiplayerSequences.put(sequence);

    await store.purgeOwnedRoomData(room.roomId, () => true);

    expect(await db.multiplayerRooms.get(room.roomId) !== undefined).toBe(sessionExists);
    expect(await db.multiplayerParticipantBindings.get(binding.id) !== undefined).toBe(sessionExists);
    expect(await db.multiplayerOutbox.get(outbox.id) !== undefined).toBe(sessionExists);
    expect(await db.multiplayerPatchReceipts.get(receipt.id) !== undefined).toBe(sessionExists);
    expect(await db.multiplayerSequences.get(sequence.id) !== undefined).toBe(sessionExists);
    expect(await db.sessions.get(session.id) !== undefined).toBe(sessionExists);
  });

  it('does not overwrite an existing session with a late snapshot after the runtime becomes inactive', async () => {
    const store = createMultiplayerLocalStore();
    const session: GameSession = { id: 'snapshot-game', templateId: 'board', name: 'Saved locally', startTime: 1,
      status: 'active', players: [] };
    const room: MultiplayerRoomRecord = { roomId: 'snapshot-room', sessionId: session.id,
      templateId: session.templateId, role: 'player', hostDeviceId: 'host', status: 'active',
      revision: 1, createdAt: 1, updatedAt: 1 };
    await store.persistBootstrap({ session, room });
    const lateSnapshot: SessionSnapshotMessage = {
      type: 'session:snapshot', roomId: room.roomId, sessionId: session.id,
      session: { ...session, name: 'Late remote snapshot' }, revision: 2, updatedAt: 2,
    };
    let activityChecks = 0;
    const isActive = () => ++activityChecks === 1;

    expect(await persistMultiplayerSnapshot(lateSnapshot, store, isActive)).toBeNull();
    expect(activityChecks).toBe(2);
    expect(await db.sessions.get(session.id)).toEqual(session);
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
