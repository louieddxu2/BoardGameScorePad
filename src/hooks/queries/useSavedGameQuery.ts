
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { searchService } from '../../services/searchService';
import { SavedListItem } from '../../types';

export const useSavedGameQuery = (searchQuery: string) => {
  // 1. 讀取資料 (Fetch)
  // 為了支援客戶端模糊搜尋，我們讀取全部遊戲資料 (無上限)
  // 依照 usageCount (常用度) 排序
  const allSavedGames = useLiveQuery<SavedListItem[]>(async () => {
      return await db.savedGames
          .orderBy('usageCount').reverse()
          .toArray();
  }, []);

  // 2. 搜尋過濾 (Search & Filter)
  const filteredSavedGames = useMemo<SavedListItem[]>(() => {
      if (!allSavedGames) return [];

      // 定義搜尋權重：名稱最重要，別名次之
      const searchKeys = [
          { name: 'name', weight: 1.0 },
          { name: 'altName', weight: 0.8 }, // 支援搜尋英文/別名
          { name: 'bggId', weight: 0.5 }    // 支援搜尋 BGG ID
      ];

      return searchService.search<SavedListItem>(allSavedGames, searchQuery, searchKeys);
  }, [allSavedGames, searchQuery]);

  return {
      savedGames: filteredSavedGames
  };
};
