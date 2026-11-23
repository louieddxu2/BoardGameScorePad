import 'fake-indexeddb/auto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { useSessionManager } from '../../hooks/useSessionManager';
import type { GameSession, GameTemplate } from '../../types';
import { migrateFromLocalStorage } from '../../utils/dbMigration';
import { getOfficialTemplateAtVersion, localOfficialVersion } from './officialBoards';

const { showToast, confirm } = vi.hoisted(() => ({ showToast: vi.fn(), confirm: vi.fn() }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm }) }));
vi.mock('../../hooks/useLibrary', () => ({ useLibrary: () => ({ updatePlayer: vi.fn() }) }));
vi.mock('../../i18n/session', () => ({ useSessionTranslation: () => ({ t: (key: string) => key }) }));

// A bundle written by the pre-merge sync: it records the cloud version it holds.
vi.mock('../../data/templates', () => ({
  DEFAULT_TEMPLATES: [
    { id: 'Built-in-Synced', name: '同步過', bggId: '1', officialVersion: 3, createdAt: 1, columns: [{ id: 'c', name: 'v3' }] },
  ],
}));
vi.mock('../../data/templates-en', () => ({ DEFAULT_TEMPLATES_EN: [] }));

const oldBoard: GameTemplate = {
  id: 'Built-in-Synced',
  name: 'Fixture board',
  bggId: '1',
  createdAt: 1,
  columns: [{ id: 'old', name: 'Old column', inputType: 'keypad', isScoring: true, formula: 'a1' }],
};
const oldSession: GameSession = {
  id: 'session-v0', templateId: oldBoard.id, name: oldBoard.name,
  officialVersion: 0, status: 'active', startTime: 1,
  players: [{ id: 'p', name: 'Player', color: 'red', scores: { old: { parts: [7] } }, totalScore: 7 }],
};

const renderSessionManager = () => renderHook(() => useSessionManager({
  getTemplate: async (id) => (await db.builtins.get(id)) ?? null,
  activeSessions: [oldSession], isCloudEnabled: () => false, pinnedIds: [],
}));

describe('bundled copies that record their cloud version', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    localStorage.clear();
    showToast.mockClear();
    confirm.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('counts as that version locally', () => {
    expect(localOfficialVersion({ officialVersion: 3 })).toBe(3);
  });

  it('answers for its own version, and other versions come from the cloud', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const version = Number(new URL(String(input)).searchParams.get('version'));
      return new Response(
        JSON.stringify({ id: 'Built-in-Synced', bggId: '1', lang: 'zh-TW', name: '同步過', version, payload: { columns: [{ id: 'c', name: `v${version}` }] } }),
        { status: 200 }
      );
    });
    expect((await getOfficialTemplateAtVersion('Built-in-Synced', 3))?.columns.map((c) => c.name)).toEqual(['v3']);
    expect(fetchMock).not.toHaveBeenCalled();

    // A game started on the original bundled copy (v0) resumes on v0, not on the newer bundle.
    expect((await getOfficialTemplateAtVersion('Built-in-Synced', 0))?.columns.map((c) => c.name)).toEqual(['v0']);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('version')).toBe('0');
  });

  it('resumes offline with the old columns after a bundled upgrade', async () => {
    await db.builtins.bulkPut([oldBoard, { ...oldBoard, id: 'Built-in-Removed' }, { ...oldBoard, id: 'Built-in-Still-In-Use' }]);
    await db.sessions.bulkPut([oldSession, { ...oldSession, id: 'legacy-session', templateId: 'Built-in-Still-In-Use', officialVersion: undefined }]);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await migrateFromLocalStorage();

    expect((await db.builtins.get(oldBoard.id))?.officialVersion).toBe(3);
    expect(await db.builtins.get('Built-in-Removed')).toBeUndefined();
    expect(await db.officialVersions.get(['Built-in-Removed', 0])).toBeUndefined();
    expect(await db.officialVersions.get(['Built-in-Still-In-Use', 0])).toBeDefined();
    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSessionById(oldSession.id)).toBe(true); });
    expect(result.current.activeTemplate?.columns.map(column => column.id)).toEqual(['old']);
    expect(result.current.currentSession?.players[0].scores.old).toEqual({ parts: [7] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the session closed when its version is unavailable instead of using new columns', async () => {
    await db.builtins.put({ ...oldBoard, officialVersion: 3 });
    await db.sessions.put(oldSession);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSessionById(oldSession.id)).toBe(false); });
    expect(result.current.currentSession).toBeNull();
    expect(showToast).toHaveBeenCalledWith({ message: 'resume_official_version_missing', type: 'error' });
    expect(await db.sessions.get(oldSession.id)).toEqual(oldSession);
  });

  it('recovers the original online even after the board was removed from the local catalog', async () => {
    await db.sessions.put(oldSession);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      id: oldBoard.id, version: 0, name: oldBoard.name, bggId: oldBoard.bggId,
      payload: oldBoard,
    }));

    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSession(oldBoard.id)).toMatchObject({ sessionId: oldSession.id }); });
    expect(result.current.activeTemplate?.columns.map(column => column.id)).toEqual(['old']);
    expect(confirm).not.toHaveBeenCalled();
    expect(await db.gameCatalog.count()).toBe(0);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('version')).toBe('0');
    expect(await db.officialVersions.get([oldBoard.id, 0])).toBeDefined();
  });

  it.each([false, true])('changes the saved game only when the player accepts a replacement (%s)', async (accepted) => {
    const sharedScore = { parts: [5] };
    const saved = { ...oldSession, players: [{ ...oldSession.players[0], scores: { old: { parts: [7] }, shared: sharedScore } }] };
    const newer: GameTemplate = {
      ...oldBoard, officialVersion: 3,
      columns: [{ ...oldBoard.columns[0], id: 'shared', formula: 'a1×c1', constants: { c1: 2 } }],
    };
    await db.sessions.put(saved);
    await db.builtins.put(newer);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    confirm.mockResolvedValue(accepted);

    const { result } = renderSessionManager();
    await act(async () => { expect(Boolean(await result.current.resumeSession(oldBoard.id))).toBe(accepted); });
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmText: 'resume_official_version_replace' }));
    const recorded = await db.sessions.get(saved.id);
    if (!accepted) {
      expect(recorded).toEqual(saved);
      expect(result.current.currentSession).toBeNull();
      return;
    }
    expect(recorded).toMatchObject({
      officialVersion: 3,
      players: [{ scores: { shared: sharedScore }, totalScore: 10 }],
    });
    expect(recorded?.players[0].scores).not.toHaveProperty('old');
    expect(result.current.activeTemplate?.officialVersion).toBe(3);
  });

  it('can offer the latest cloud version when both the original and the local copy are missing', async () => {
    await db.sessions.put(oldSession);
    confirm.mockResolvedValue(true);
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname + url.search);
      if (url.searchParams.has('version')) return Response.json({ error: 'version_not_found' }, { status: 404 });
      return Response.json({ id: oldBoard.id, version: 2, name: oldBoard.name, bggId: oldBoard.bggId, payload: oldBoard });
    });

    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSession(oldBoard.id)).toMatchObject({ sessionId: oldSession.id }); });
    expect(calls).toEqual([
      '/api/official/template/Built-in-Synced?version=0',
      '/api/official/template/Built-in-Synced',
    ]);
    expect((await db.sessions.get(oldSession.id))?.officialVersion).toBe(2);
  });

  it('offers a newer locally archived version when the current board is missing offline', async () => {
    await db.sessions.put(oldSession);
    const replacement = { ...oldBoard, officialVersion: 2 };
    await db.officialVersions.put({ id: oldBoard.id, version: 2, template: replacement });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    confirm.mockImplementation(async () => {
      // An update pruned the candidate while the user was deciding.
      await db.officialVersions.delete([oldBoard.id, 2]);
      return true;
    });

    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSession(oldBoard.id)).toMatchObject({ sessionId: oldSession.id }); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await db.sessions.get(oldSession.id))?.officialVersion).toBe(2);
    expect(await db.officialVersions.get([oldBoard.id, 2])).toBeDefined();
  });

  it('pins the loaded version if a board changed before the new game was saved', async () => {
    await db.builtins.put({ ...oldBoard, officialVersion: 3 });
    const { result } = renderHook(() => useSessionManager({
      getTemplate: async () => oldBoard,
      activeSessions: [], isCloudEnabled: () => false, pinnedIds: [],
    }));

    await act(async () => { expect(await result.current.startSession(oldBoard, 1)).toBeTruthy(); });
    expect((await db.sessions.get(result.current.currentSession!.id))?.officialVersion).toBe(0);
    expect(await db.officialVersions.get([oldBoard.id, 0])).toBeDefined();
  });

  it('leaves a session alone if it changed while the replacement prompt was open', async () => {
    await db.sessions.put(oldSession);
    await db.builtins.put({ ...oldBoard, officialVersion: 3 });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    confirm.mockImplementation(async () => {
      await db.sessions.update(oldSession.id, { note: 'Saved elsewhere' });
      return true;
    });

    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSession(oldBoard.id)).toBeNull(); });
    expect(await db.sessions.get(oldSession.id)).toEqual({ ...oldSession, note: 'Saved elsewhere' });
  });

  it('does not replace the board of an active multiplayer room with a device-local version', async () => {
    await db.sessions.put(oldSession);
    await db.builtins.put({ ...oldBoard, officialVersion: 3 });
    await db.multiplayerRooms.put({
      roomId: 'room', sessionId: oldSession.id, templateId: oldBoard.id,
      role: 'host', hostDeviceId: 'host', status: 'active', revision: 1, createdAt: 1, updatedAt: 1,
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderSessionManager();
    await act(async () => { expect(await result.current.resumeSession(oldBoard.id)).toBeNull(); });
    expect(confirm).not.toHaveBeenCalled();
    expect(await db.sessions.get(oldSession.id)).toEqual(oldSession);
  });
});
