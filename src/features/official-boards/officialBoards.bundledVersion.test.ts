import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { getOfficialTemplateAtVersion, localOfficialVersion } from './officialBoards';

// A bundle written by the pre-merge sync: it records the cloud version it holds.
vi.mock('../../data/templates', () => ({
  DEFAULT_TEMPLATES: [
    { id: 'Built-in-Synced', name: '同步過', bggId: '1', officialVersion: 3, createdAt: 1, columns: [{ id: 'c', name: 'v3' }] },
  ],
}));

describe('bundled copies that record their cloud version', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
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
});
