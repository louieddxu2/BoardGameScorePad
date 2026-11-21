import 'fake-indexeddb/auto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { useSessionManager } from '../../hooks/useSessionManager';
import type { GameSession, GameTemplate } from '../../types';
import { migrateFromLocalStorage } from '../../utils/dbMigration';
import { getOfficialTemplateAtVersion, localOfficialVersion } from './officialBoards';

const showToast = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ showToast }) }));
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
    await db.builtins.bulkPut([oldBoard, { ...oldBoard, id: 'Built-in-Removed' }]);
    await db.sessions.put(oldSession);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await migrateFromLocalStorage();

    expect((await db.builtins.get(oldBoard.id))?.officialVersion).toBe(3);
    expect(await db.builtins.get('Built-in-Removed')).toBeUndefined();
    expect(await db.officialVersions.get(['Built-in-Removed', 0])).toBeDefined();
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
    expect(showToast).toHaveBeenCalledWith({ message: 'msg_template_read_failed', type: 'error' });
    expect(await db.sessions.get(oldSession.id)).toEqual(oldSession);
  });
});
