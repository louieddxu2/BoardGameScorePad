
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useTemplateQuery } from './useTemplateQuery';
import { useSavedGameQuery } from './useSavedGameQuery';
import { useGameOptionAggregator } from '../../features/game-selector/hooks/useGameOptionAggregator';
import { searchService } from '../../services/searchService';
import { GameOption } from '../../features/game-selector/types';
import { extractBggGameSummary } from '../../utils/extractDataSummaries';

/**
 * Game Options Query Hook
 * 
 * 職責：專門為「開始新遊戲」面板提供選項列表。
 * 策略：整合 Templates、SavedGames 與 BggGames (字典)。
 */
export const useGameOptionsQuery = (searchQuery: string) => {
  // 1. Fetch Local Data
  const { 
    templates: allTemplates, 
    systemTemplates: allSystemTemplates 
  } = useTemplateQuery('');

  const { 
    savedGames: allSavedGames 
  } = useSavedGameQuery('');

  // 2. Fetch BGG Dictionary (Lite Summary)
  // [Optimization] 使用 extractBggGameSummary 轉換為輕量物件
  const allBggGames = useLiveQuery(async () => {
    const rawGames = await db.bggGames.toArray();
    return rawGames.map(extractBggGameSummary);
  }, [], []);

  // 3. Aggregate Data (Merge & Deduplicate)
  // 將 BGG Summary 傳入，讓 Aggregator 進行名稱匹配與搜尋索引補完
  const aggregatedOptions = useGameOptionAggregator(
    [...allTemplates, ...allSystemTemplates],
    allSavedGames,
    allBggGames || []
  );

  // 4. Search
  const gameOptions = useMemo(() => {
    return searchService.search<GameOption>(aggregatedOptions, searchQuery, [
      { name: 'displayName', weight: 1.0 },
      { name: '_searchTokens', weight: 0.8 }
    ]);
  }, [aggregatedOptions, searchQuery]);

  return gameOptions;
};
