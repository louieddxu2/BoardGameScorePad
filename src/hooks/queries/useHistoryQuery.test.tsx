import 'fake-indexeddb/auto';
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';
import { useHistoryQuery } from './useHistoryQuery';
import { LanguageProvider } from '../../i18n';
import HistoryStatsPanel from '../../components/dashboard/HistoryStatsPanel';
import { HistoryView } from '../../components/dashboard/views/HistoryView';
import { buildHistoryPhotoRecapContext } from '../../utils/historyPhotoRecapContext';
import { buildHistoryStats } from '../../utils/historyStats';
import type { HistoryRecord } from '../../types';
import type { HistoryPhotoRecapSnapshot } from '../../utils/historyPhotoRecapContext';
import type { HistoryDateFilter } from '../../utils/historyDateFilter';

vi.mock('../../hooks/useModalBackHandler', () => ({ useModalBackHandler: () => ({ zIndex: 120 }) }));
vi.mock('../../components/dashboard/HistoryPhotoGridShareModal', () => ({
  default: ({ recap }: { recap: HistoryPhotoRecapSnapshot | null }) => recap ?
    <output data-testid="recap-context">{recap.context.dateLabel}</output> : null
}));
const record = (id: string, year: number, month: number, day: number, name = 'Orchard'): HistoryRecord => ({
  id, templateId: name, gameName: name, startTime: 1, endTime: new Date(year, month - 1, day, 12).getTime(),
  players: [], winnerIds: [], location: 'Comets', snapshotTemplate: { id: name, name, columns: [], createdAt: 1 }
});
const singleDay = (year: number, month: number, day: number): HistoryDateFilter => ({
  kind: 'custom', precision: 'day', range: false, start: { year, month, day }, end: { year, month, day }, startOpen: false, endOpen: false
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 2, 12));
  localStorage.setItem('app_language', 'zh-TW');
  await db.history.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('shared history date query', () => {
  it('filters whole records before aggregation, sharing counts, statistics and recap dates', async () => {
    await db.history.bulkPut([record('old', 2026, 10, 31), record('today', 2026, 11, 2), record('tomorrow', 2026, 11, 3)]);
    const read = vi.spyOn(db.history, 'orderBy');
    const { result } = renderHook(() => useHistoryQuery('', undefined));
    await waitFor(() => expect(result.current.historyCount).toBe(3));
    const reads = read.mock.calls.length;
    act(() => result.current.setHistoryDateFilter(singleDay(2026, 11, 2)));
    expect(result.current.historyRecords.map(row => row.id)).toEqual(['today']);
    expect(result.current.historyStatsRecords.map(row => row.id)).toEqual(['today']);
    expect(result.current.historyCount).toBe(1);
    expect(buildHistoryStats(result.current.historyGameEntries).playCount).toBe(1);
    expect(buildHistoryPhotoRecapContext(result.current.historyGameEntries, result.current.historyStatsRecords).dateLabel).toBe('2026.11.02');
    expect(read).toHaveBeenCalledTimes(reads);
  });

  it('keeps all date text formats searchable alongside the calendar filter', async () => {
    await db.history.bulkPut([record('one', 2026, 11, 2), record('two', 2026, 11, 2, 'Lagoon'), record('old', 1995, 4, 27)]);
    const { result, rerender } = renderHook(({ query }) => useHistoryQuery(query, undefined), { initialProps: { query: '' } });
    await waitFor(() => expect(result.current.historyCount).toBe(3));
    act(() => result.current.setHistoryDateFilter(singleDay(2026, 11, 2)));
    rerender({ query: 'Orchard Comets' });
    expect(result.current.historyRecords.map(row => row.id)).toEqual(['one']);
    for (const date of ['2026/11/02', '261102', '1151102']) {
      rerender({ query: date });
      expect(result.current.historyRecords.map(row => row.id).sort()).toEqual(['one', 'two']);
    }
    rerender({ query: 'Orchard 1995/04/27' });
    expect(result.current.historyCount).toBe(0);
    rerender({ query: '' });
    expect(result.current.historyCount).toBe(2);
    expect(result.current.historyDateFilter.kind).toBe('custom');
  });

  it('counts all matches before the list cap and preserves optimistic deletion', async () => {
    const count = DATA_LIMITS.QUERY.HISTORY_RECORDS + 3;
    await db.history.bulkPut(Array.from({ length: count }, (_, i) => record(`row-${i}`, 2026, 11, 2)));
    const { result } = renderHook(() => useHistoryQuery('', undefined));
    await waitFor(() => expect(result.current.historyCount).toBe(count));
    act(() => result.current.setHistoryDateFilter(singleDay(2026, 11, 2)));
    expect(result.current.historyRecords).toHaveLength(DATA_LIMITS.QUERY.HISTORY_RECORDS);
    expect(result.current.historyStatsRecords).toHaveLength(count);
    act(() => result.current.setPendingDeleteHistoryIds(['row-0']));
    expect(result.current.historyCount).toBe(count - 1);
    expect(result.current.historyStatsRecords.some(row => row.id === 'row-0')).toBe(false);
    await act(async () => { await db.history.delete('row-0'); });
    await waitFor(() => expect(result.current.historyCount).toBe(count - 1));
  });

  it('refreshes This month on foregrounding and preserves a fixed custom month', async () => {
    await db.history.bulkPut([record('oct', 2026, 10, 31), record('nov', 2026, 11, 1), record('dec', 2026, 12, 1)]);
    const { result } = renderHook(() => useHistoryQuery('', undefined));
    await waitFor(() => expect(result.current.historyCount).toBe(3));
    act(() => result.current.setHistoryDateFilter({ kind: 'month' }));
    expect(result.current.historyRecords.map(row => row.id)).toEqual(['nov']);
    vi.setSystemTime(new Date(2026, 11, 2));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(result.current.historyRecords.map(row => row.id)).toEqual(['dec']);
    const fixed = { ...singleDay(2026, 11, 2), precision: 'month' } as HistoryDateFilter;
    act(() => result.current.setHistoryDateFilter(fixed));
    expect(result.current.historyRecords.map(row => row.id)).toEqual(['nov']);
    vi.setSystemTime(new Date(2027, 0, 2));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.historyRecords.map(row => row.id)).toEqual(['nov']);
  });

  it('updates the visible list, stats and photo recap together through the real selector', async () => {
    await db.history.bulkPut([record('oct', 2026, 10, 31), record('nov', 2026, 11, 2)]);
    const Harness = () => {
      const data = useHistoryQuery('', undefined);
      const [statsVisible, setStatsVisible] = useState(true);
      return <><output data-testid="list">{data.historyRecords.map(row => row.id).join(',')}</output>
        <output data-testid="total">{data.historyCount}</output>
        <button onClick={() => setStatsVisible(current => !current)}>Toggle stats</button>
        <HistoryView records={data.historyRecords} totalCount={data.historyCount} searchQuery=""
          dateFilter={data.historyDateFilter} onDateFilterChange={data.setHistoryDateFilter} showDateFilter={!statsVisible}
          onDelete={() => {}} onSelect={() => {}} />
        {statsVisible && <HistoryStatsPanel entries={data.historyGameEntries} records={data.historyStatsRecords}
          dateFilter={data.historyDateFilter} onDateFilterChange={data.setHistoryDateFilter} onSearchClick={() => {}} />}
      </>;
    };
    render(<LanguageProvider><Harness /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: '這個月' }));
    expect(screen.getByTestId('list')).toHaveTextContent(/^nov$/);
    expect(screen.getByTestId('total')).toHaveTextContent(/^1$/);
    fireEvent.click(screen.getByTitle('照片回顧'));
    expect(screen.getByTestId('recap-context')).toHaveTextContent('2026.11.02');
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: '全期間' }));
    expect(screen.getByTestId('total')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('recap-context')).toHaveTextContent(/^2026.11.02$/);
    fireEvent.click(screen.getByRole('button', { name: /^篩選時間:/ }));
    fireEvent.click(screen.getByRole('button', { name: '這個月' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle stats' }));
    expect(screen.getByRole('button', { name: /^篩選時間:/ })).toHaveTextContent('這個月');
    expect(screen.getByTestId('total')).toHaveTextContent(/^1$/);
    fireEvent.click(screen.getByRole('button', { name: '清除日期篩選' }));
    expect(screen.getByTestId('total')).toHaveTextContent(/^2$/);
    expect(screen.queryByRole('button', { name: '清除日期篩選' })).not.toBeInTheDocument();
  });
});
