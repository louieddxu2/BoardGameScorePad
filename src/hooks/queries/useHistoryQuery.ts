
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { extractHistorySummary } from '../../utils/extractDataSummaries';

export const useHistoryQuery = (searchQuery: string) => {
  const isSearching = searchQuery && searchQuery.trim().length > 0;

  // --- HISTORY RECORDS (OPTIMIZED STRATEGY) ---
  
  // 1. Fetch & Transform (One-pass operation)
  // 直接讀取所有紀錄，並立即轉換為 HistorySummary。
  // 這樣記憶體中只會保留輕量資料，不會持有巨大的 snapshotTemplate。
  const allSummaries = useLiveQuery(async () => {
      const records = await db.history.orderBy('endTime').reverse().toArray();
      // 使用新的轉換函數
      return records.map(extractHistorySummary);
  }, [], []); // Empty deps = runs only on DB change

  // 2. Search & Filter
  const filteredSummaries = useMemo(() => {
      if (!allSummaries) return [];
      
      let results = allSummaries;
      if (isSearching) {
          // [Config] Weighted Search Keys
          // 這裡的 keys 必須對應 HistorySummary 的欄位
          const searchKeys = [
              { name: 'gameName', weight: 1.0 },
              { name: 'location', weight: 0.9 },
              { name: '_playerNames', weight: 0.9 },  // 使用底線開頭的扁平欄位
              { name: '_compactDate', weight: 0.8 },
              { name: '_rocDate', weight: 0.8 },
              { name: '_dateStr', weight: 0.6 }
          ];

          results = searchService.search(allSummaries, searchQuery, searchKeys);
      }
      
      // 取出前 N 筆給 UI 顯示
      return results.slice(0, DATA_LIMITS.QUERY.HISTORY_RECORDS);
  }, [allSummaries, searchQuery, isSearching]);

  return {
      // 這裡回傳的是 HistorySummary[]，而非 HistoryRecord[]
      // UI 元件 (HistoryList) 之後需要配合修改型別定義
      historyRecords: filteredSummaries, 
      historyCount: isSearching ? filteredSummaries.length : (allSummaries?.length || 0)
  };
};
