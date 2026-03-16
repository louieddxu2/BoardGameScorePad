
import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { extractHistorySummary } from '../../utils/extractDataSummaries';

export const useHistoryQuery = (searchQuery: string) => {
  const isSearching = searchQuery && searchQuery.trim().length > 0;

  // [Optimistic UI] IDs currently being deleted — used to instantly hide items from UI
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // --- HISTORY RECORDS (OPTIMIZED STRATEGY) ---

  // 1. Fetch & Transform (One-pass operation)
  // 直接讀取所有紀錄，並立即轉換為 HistorySummary。
  // 這樣記憶體中只會保留輕量資料，不會持有巨大的 snapshotTemplate。
  const allSummaries = useLiveQuery(async () => {
    const records = await db.history.orderBy('endTime').reverse().toArray();
    return records.map(extractHistorySummary);
  }, [], []); // Empty deps = runs only on DB change

  // 2. Cleanup: When DB confirms deletion (allSummaries updates),
  // remove IDs that are no longer in DB from the pending list
  useEffect(() => {
    if (!allSummaries || pendingDeleteIds.length === 0) return;

    setPendingDeleteIds(prev => prev.filter(id =>
      allSummaries.some(record => record.id === id)
    ));
  }, [allSummaries]);

  // 3. Search & Filter
  const filteredSummaries = useMemo(() => {
    if (!allSummaries) return [];

    // Apply Optimistic Mask — instantly hide items marked for deletion
    let results = pendingDeleteIds.length > 0
      ? allSummaries.filter(r => !pendingDeleteIds.includes(r.id))
      : allSummaries;

    if (isSearching) {
      const searchKeys = [
        { name: 'gameName', weight: 1.0 },
        { name: 'location', weight: 0.9 },
        { name: '_playerNames', weight: 0.9 },
        { name: '_compactDate', weight: 0.8 },
        { name: '_rocDate', weight: 0.8 },
        { name: '_dateStr', weight: 0.6 }
      ];

      results = searchService.search(results, searchQuery, searchKeys);
    }

    return results.slice(0, DATA_LIMITS.QUERY.HISTORY_RECORDS);
  }, [allSummaries, searchQuery, isSearching, pendingDeleteIds]);

  return {
    historyRecords: filteredSummaries,
    historyCount: isSearching
      ? filteredSummaries.length
      : Math.max(0, (allSummaries?.length || 0) - pendingDeleteIds.length),
    setPendingDeleteHistoryIds: setPendingDeleteIds
  };
};
