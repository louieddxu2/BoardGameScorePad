import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import type { GameTemplate } from '../../types';
import { syncCatalog } from './catalogSync';
import { installOfficialPack } from './officialPack';
import {
  computeOfficialLaunchStates,
  ensureOfficialBoard,
  getOfficialTemplateAtVersion,
  reapplyDownloadedOfficialVersions,
} from './officialBoards';
import type { OfficialCatalogEntry } from './types';

const entry = (id: string, version: number, extra: Partial<OfficialCatalogEntry> = {}): OfficialCatalogEntry => ({
  id,
  bggId: '31260',
  lang: 'zh-TW',
  name: '農家樂',
  version,
  bundled: true,
  updatedAt: 1,
  ...extra,
});

const board = (id: string, columns: string[], officialVersion?: number): GameTemplate => ({
  id,
  name: '農家樂',
  bggId: '31260',
  columns: columns.map((name, i) => ({ id: `c${i}`, name }) as GameTemplate['columns'][number]),
  createdAt: 1,
  ...(officialVersion === undefined ? {} : { officialVersion }),
});

type Route = (url: string) => unknown | Promise<unknown>;
const mockWorker = (route: Route) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const body = await route(url);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200 });
  });

describe('official boards (local)', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
  afterEach(() => vi.restoreAllMocks());

  it('marks boards that are missing or older locally', () => {
    const states = computeOfficialLaunchStates(
      [entry('Built-in-A', 2), entry('Built-in-B', 1), entry('Built-in-C', 0), entry('Built-in-D', 3)],
      new Map([['Built-in-A', 0], ['Built-in-B', 1], ['Built-in-C', 0]])
    );
    expect(Object.fromEntries(states)).toEqual({ 'Built-in-A': 'update_available', 'Built-in-D': 'needs_download' });
  });

  it('downloads the catalog version on start and falls back to the local copy offline', async () => {
    await db.builtins.put(board('Built-in-Agricola', ['田地']));
    await db.officialCatalog.put(entry('Built-in-Agricola', 2));
    const fetchMock = mockWorker(() => ({ ...entry('Built-in-Agricola', 2), payload: board('Built-in-Agricola', ['田地', '牧場']) }));

    const ready = await ensureOfficialBoard('Built-in-Agricola');
    expect(ready.status).toBe('ready');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/official/template/Built-in-Agricola?version=2');
    const installed = await db.builtins.get('Built-in-Agricola');
    expect(installed?.officialVersion).toBe(2);
    expect(installed?.columns).toHaveLength(2);
    expect((await getOfficialTemplateAtVersion('Built-in-Agricola', 0))?.columns.map(c => c.name)).toEqual(['田地']);

    // Already current: no second download.
    await ensureOfficialBoard('Built-in-Agricola');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A newer version that cannot be downloaded falls back to the local v2.
    await db.officialCatalog.put(entry('Built-in-Agricola', 3));
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const fallback = await ensureOfficialBoard('Built-in-Agricola');
    expect(fallback.status).toBe('fallback');
    expect(fallback.status === 'fallback' && fallback.template.officialVersion).toBe(2);
  });

  it('reports unavailable when a cloud-only board cannot be downloaded the first time', async () => {
    await db.officialCatalog.put(entry('Built-in-New', 1));
    mockWorker(() => new Response('{}', { status: 500 }));
    expect((await ensureOfficialBoard('Built-in-New')).status).toBe('unavailable');
    expect(await db.builtins.get('Built-in-New')).toBeUndefined();
  });

  it('resumes the started version and keeps downloads across a bundled rebuild', async () => {
    await db.builtins.put(board('Built-in-Agricola', ['田地']));
    await db.officialCatalog.put(entry('Built-in-Agricola', 1));
    mockWorker((url) => {
      const version = Number(new URL(url).searchParams.get('version'));
      return { ...entry('Built-in-Agricola', version), payload: board('Built-in-Agricola', version === 1 ? ['v1'] : ['v2', 'x']) };
    });
    await ensureOfficialBoard('Built-in-Agricola');
    await db.officialCatalog.put(entry('Built-in-Agricola', 2));
    await ensureOfficialBoard('Built-in-Agricola');

    // A session that started on v1 still gets v1 after updating to v2.
    expect((await getOfficialTemplateAtVersion('Built-in-Agricola', 1))?.columns.map((c) => c.name)).toEqual(['v1']);

    // Rebuilding bundled built-ins would put back v0; the newest download is reapplied.
    await db.builtins.put(board('Built-in-Agricola', ['田地']));
    expect(await reapplyDownloadedOfficialVersions()).toBe(1);
    expect((await db.builtins.get('Built-in-Agricola'))?.officialVersion).toBe(2);
    expect((await getOfficialTemplateAtVersion('Built-in-Agricola', 0))?.columns.map(c => c.name)).toEqual(['田地']);
  });

  it('syncs the catalog from a snapshot, then only changes after its version', async () => {
    const calls: string[] = [];
    mockWorker((url) => {
      calls.push(new URL(url).pathname + new URL(url).search);
      if (url.endsWith('/api/official/catalog')) {
        return { generation: 3, throughVersion: 10, generatedAt: 1, templates: [entry('Built-in-A', 1), entry('Built-in-B', 0)] };
      }
      const after = Number(new URL(url).searchParams.get('after'));
      if (after === 10) {
        return {
          changes: [
            { templateId: 'Built-in-A', catalogVersion: 11, deleted: false, template: entry('Built-in-A', 2) },
            { templateId: 'Built-in-B', catalogVersion: 12, deleted: true },
          ],
          throughVersion: 12,
          hasMore: false,
        };
      }
      return { changes: [], throughVersion: after, hasMore: false };
    });

    const first = await syncCatalog('official');
    expect(first).toMatchObject({ ran: 'snapshot', changed: 4, state: { throughVersion: 12, generation: 3 } });
    expect((await db.officialCatalog.toArray()).map((e) => [e.id, e.version])).toEqual([['Built-in-A', 2]]);

    // Within 6 hours an automatic sync does nothing; a manual check asks for changes after 12.
    expect((await syncCatalog('official')).ran).toBe('none');
    const manual = await syncCatalog('official', 'changes');
    expect(manual).toMatchObject({ ran: 'changes', changed: 0 });
    expect(calls).toEqual([
      '/api/official/catalog',
      '/api/official/catalog/changes?after=10',
      '/api/official/catalog/changes?after=12',
    ]);
  });

  it('gives up on a slow download at start and uses the local copy', async () => {
    await db.builtins.put(board('Built-in-Agricola', ['田地']));
    await db.officialCatalog.put(entry('Built-in-Agricola', 2));
    // A Worker that never answers: only the abort signal ends the request.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
    );
    const started = Date.now();
    const result = await ensureOfficialBoard('Built-in-Agricola', 30);
    expect(result.status).toBe('fallback');
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('official pack (first open)', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  const packItem = (id: string, version: number, columns: string[]) => ({
    id,
    bggId: '31260',
    name: '農家樂',
    version,
    payload: { name: '農家樂', columns: columns.map((name, i) => ({ id: `c${i}`, name })) },
  });

  it('installs newer and missing boards once and keeps the bundled ones', async () => {
    await db.builtins.put(board('Built-in-Agricola', ['田地']));
    await db.builtins.put(board('Built-in-Same', ['A']));
    const fetchMock = mockWorker(() => ({
      lang: 'zh-TW',
      throughVersion: 70,
      builtAt: 1,
      templates: [
        packItem('Built-in-Agricola', 2, ['田地', '牧場']),
        packItem('Built-in-Same', 0, ['changed in cloud']),
        packItem('Built-in-CloudOnly', 0, ['X']),
      ],
    }));

    expect(await installOfficialPack('zh-TW')).toBe(2);
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname + new URL(String(url)).search)).toEqual([
      '/api/official/pack?lang=zh-TW',
    ]);
    expect((await db.builtins.get('Built-in-Agricola'))?.officialVersion).toBe(2);
    expect((await db.builtins.get('Built-in-Same'))?.columns.map((c) => c.name)).toEqual(['A']);
    expect((await db.builtins.get('Built-in-CloudOnly'))?.officialVersion).toBe(0);
    expect((await getOfficialTemplateAtVersion('Built-in-Agricola', 0))?.columns.map(c => c.name)).toEqual(['田地']);

    // A board only the cloud has survives a rebuild of the bundled built-ins and can be resumed at v0.
    await db.builtins.delete('Built-in-CloudOnly');
    await reapplyDownloadedOfficialVersions();
    expect((await getOfficialTemplateAtVersion('Built-in-CloudOnly', 0))?.columns.map((c) => c.name)).toEqual(['X']);

    // Installed once per language: a later open does not download again.
    expect(await installOfficialPack('zh-TW')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on a later open when the download fails', async () => {
    mockWorker(() => new Response(JSON.stringify({ error: 'pack_not_found' }), { status: 404 }));
    await expect(installOfficialPack('en')).rejects.toMatchObject({ code: 'pack_not_found' });
    expect(localStorage.getItem('sm_official_pack_installed_en')).toBeNull();
  });
});
