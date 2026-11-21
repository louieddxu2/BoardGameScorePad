import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db';
import { cloudClient } from '../../../services/cloudClient';
import type { ShareCatalogEntry } from '../../official-boards/types';
import { matchShareCatalog, useCloudTemplateSuggestion } from './useCloudTemplateSuggestion';

vi.mock('../../official-boards/catalogSync', () => ({ syncCatalog: vi.fn(async () => undefined) }));

const entry = (id: string, name: string, extra: Partial<ShareCatalogEntry> = {}): ShareCatalogEntry => ({
  id,
  name,
  createdAt: 1,
  ...extra,
});

describe('shared boards for the explore dialog', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    cloudClient.clearCache();
  });
  afterEach(() => vi.restoreAllMocks());

  it('matches by BGG ID or by a name containing the game name, most downloaded first', () => {
    const entries = [
      entry('a', '農家樂 簡易版', { downloadCount: 1 }),
      entry('b', 'Something', { bggId: '31260', downloadCount: 5 }),
      entry('c', '別的遊戲', { bggName: 'Agricola' }),
      entry('d', '無關'),
    ];
    expect(matchShareCatalog(entries, '農家樂', '31260').map((e) => e.id)).toEqual(['b', 'a']);
    expect(matchShareCatalog(entries, 'agricola').map((e) => e.id)).toEqual(['c']);
  });

  it('asks the cloud nothing when the local catalog has no board for the game', async () => {
    await db.shareCatalog.put(entry('x1', '其他遊戲'));
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useCloudTemplateSuggestion('農家樂', undefined, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches only the matched boards, by ID, and keeps the catalog order', async () => {
    await db.shareCatalog.bulkPut([
      entry('m1', '農家樂 A', { downloadCount: 1 }),
      entry('m2', '農家樂 B', { downloadCount: 9 }),
      entry('n1', '其他遊戲'),
    ]);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const ids = new URL(String(input)).searchParams.get('ids')!.split(',');
      return new Response(
        JSON.stringify(ids.map((id) => ({ id, name: id, payload: { columns: [{ id: 'c', name: '分數' }] }, createdAt: 1 }))),
        { status: 200 }
      );
    });
    const { result } = renderHook(() => useCloudTemplateSuggestion('農家樂', undefined, true));
    await waitFor(() => expect(result.current.suggestions).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('ids')).toBe('m2,m1');
    expect(result.current.suggestions.map((s) => s.id)).toEqual(['m2', 'm1']);
  });
});
