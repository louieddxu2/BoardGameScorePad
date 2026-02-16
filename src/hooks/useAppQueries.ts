
import { useTemplateQuery } from './queries/useTemplateQuery';
import { useHistoryQuery } from './queries/useHistoryQuery';
import { useSessionQuery } from './queries/useSessionQuery';
import { useLibraryQuery } from './queries/useLibraryQuery';
import { useSavedGameQuery } from './queries/useSavedGameQuery';
import { useGameOptionsQuery } from './queries/useGameOptionsQuery';

/**
 * App Queries Aggregator
 * 
 * 職責：作為應用程式頂層的資料供應站，聚合所有特定的查詢 Hook。
 * 注意：此 Hook 不應包含具體的資料處理邏輯 (如搜尋、排序、合併)，
 * 這些邏輯應封裝在各自的 ./queries/*.ts Hook 中。
 */
export const useAppQueries = (searchQuery: string, pinnedIds: string[]) => {
  
  // 1. Dashboard View Queries (Library & History)
  // 這些 Hook 內部已經實作了針對各自資料類型的搜尋過濾邏輯
  const templateData = useTemplateQuery(searchQuery, pinnedIds);
  const historyData = useHistoryQuery(searchQuery);
  const savedGameData = useSavedGameQuery(searchQuery);
  
  // 2. Global / Context Queries (No search dependency)
  const sessionData = useSessionQuery();
  const libraryData = useLibraryQuery();

  // 3. Start Game Panel Query (Merge then Search)
  // 這是一個專門的 Hook，負責處理「開始新遊戲」時的候選名單邏輯
  const gameOptions = useGameOptionsQuery(searchQuery, pinnedIds);

  return {
      // Spread all data props from sub-hooks
      ...templateData,
      ...historyData,
      ...savedGameData,
      ...sessionData,
      ...libraryData,
      
      // The merged options list
      gameOptions
  };
};
