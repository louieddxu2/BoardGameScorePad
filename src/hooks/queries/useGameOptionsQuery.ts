
import { useMemo } from 'react';
import { useTemplateQuery } from './useTemplateQuery';
import { useSavedGameQuery } from './useSavedGameQuery';
import { useGameOptionAggregator } from '../../features/game-selector/hooks/useGameOptionAggregator';
import { searchService } from '../../services/searchService';
import { GameOption } from '../../features/game-selector/types';

/**
 * Game Options Query Hook
 * 
 * 職責：專門為「開始新遊戲」面板提供經過「合併」與「搜尋」的選項列表。
 * 流程：
 * 1. 獲取全量原始資料 (Templates & SavedGames)。
 * 2. 透過 Aggregator 合併為 GameOption 列表。
 * 3. 透過 SearchService 進行統一過濾。
 */
export const useGameOptionsQuery = (searchQuery: string) => {
  // 1. Fetch RAW Data (Pass empty string to bypass internal filtering)
  const { 
    templates: allTemplates, 
    systemTemplates: allSystemTemplates 
  } = useTemplateQuery('');

  const { 
    savedGames: allSavedGames 
  } = useSavedGameQuery('');

  // 2. Aggregate (Merge & Deduplicate)
  // 將來自不同來源的資料整合成統一的選項格式
  const allGameOptions = useGameOptionAggregator(
    [...allTemplates, ...allSystemTemplates],
    allSavedGames
  );

  // 3. Search (Filter)
  // 在合併後的完整清單上進行搜尋，確保能搜尋到所有來源的關鍵字
  const gameOptions = useMemo(() => {
    return searchService.search<GameOption>(allGameOptions, searchQuery, [
      { name: 'displayName', weight: 1.0 },
      { name: '_searchTokens', weight: 0.8 }
    ]);
  }, [allGameOptions, searchQuery]);

  return gameOptions;
};
