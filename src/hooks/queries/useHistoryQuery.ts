import { useMemo, useState, useEffect, useCallback, useReducer } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { SavedListItem } from '../../types';
import { extractHistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryGameEntries } from '../../utils/historyGameEntries';
import type { HistorySummary } from '../../utils/extractDataSummaries';
import { ALL_HISTORY_DATES, matchesHistoryDate, resolveHistoryDateFilter, type HistoryDateFilter } from '../../utils/historyDateFilter';

export const useHistoryQuery = (
  searchQuery: string,
  savedPlayers: SavedListItem[] | undefined
) => {
  const isSearching = searchQuery && searchQuery.trim().length > 0;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [historyDateFilter, setDateFilter] = useState<HistoryDateFilter>(ALL_HISTORY_DATES);
  const [, refreshCalendar] = useReducer((revision: number) => revision + 1, 0);
  const setHistoryDateFilter = useCallback((filter: HistoryDateFilter) => {
    refreshCalendar();
    setDateFilter(filter);
  }, []);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) refreshCalendar(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const allSummaries = useLiveQuery(async (): Promise<HistorySummary[]> => {
    const records = await db.history.orderBy('endTime').reverse().toArray();
    return records.map(extractHistorySummary);
  }, [], []);

  useEffect(() => {
    if (!allSummaries || pendingDeleteIds.length === 0) return;

    setPendingDeleteIds(prev => prev.filter(id =>
      allSummaries.some(record => record.id === id)
    ));
  }, [allSummaries, pendingDeleteIds.length]);

  const activeSummaries = useMemo(() => {
    if (!allSummaries) return [];
    return pendingDeleteIds.length > 0
      ? allSummaries.filter(record => !pendingDeleteIds.includes(record.id))
      : allSummaries;
  }, [allSummaries, pendingDeleteIds]);

  // Re-evaluate the calendar month on ordinary query/UI renders as well as foregrounding.
  const currentMonth = new Date();
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
  const dateBounds = useMemo(() => resolveHistoryDateFilter(historyDateFilter), [historyDateFilter, monthKey]);
  const filteredSummaries = useMemo(() => {
    let results = historyDateFilter.kind === 'all' ? activeSummaries :
      activeSummaries.filter(record => matchesHistoryDate(record.endTime, dateBounds));

    if (isSearching) {
      const searchKeys = [
        { name: 'gameName', weight: 1.0 },
        { name: 'location', weight: 0.9 },
        { name: '_playerNames', weight: 0.9 }
      ];

      results = searchService.search(results, searchQuery, searchKeys);
    }

    return results;
  }, [activeSummaries, searchQuery, isSearching, dateBounds, historyDateFilter.kind]);
  const historyGameEntries = useMemo(() => buildHistoryGameEntries(filteredSummaries, { savedPlayers }), [filteredSummaries, savedPlayers]);

  return {
    historyRecords: filteredSummaries.slice(0, DATA_LIMITS.QUERY.HISTORY_RECORDS),
    historyStatsRecords: filteredSummaries,
    historyGameEntries,
    historyCount: filteredSummaries.length,
    historyDateFilter,
    setHistoryDateFilter,
    setPendingDeleteHistoryIds: setPendingDeleteIds
  };
};
