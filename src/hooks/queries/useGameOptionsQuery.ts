
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
export const useGameOptionsQuery = (searchQuery: string, pinnedIds: string[]) => {
  // 1. Fetch Local Data
  // Pass pinnedIds to ensure pinned simple templates are visible
  const {
    templates: allTemplates,
    systemTemplates: allSystemTemplates
  } = useTemplateQuery('', pinnedIds);

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
  // [Update] Pass pinnedIds so Aggregator can determine isPinned status
  const aggregatedOptions = useGameOptionAggregator(
    [...allTemplates, ...allSystemTemplates],
    allSavedGames,
    allBggGames || [],
    pinnedIds
  );

  // 4. Search
  const gameOptions = useMemo(() => {
    const fuseResults = searchService.searchWithMatches<GameOption>(aggregatedOptions, searchQuery, [
      { name: 'displayName', weight: 1.0 },
      { name: '_searchTokens', weight: 0.8 }
    ]);

    return fuseResults.map(result => {
      // 若沒有匹配資訊，直接回傳原物件 (雖然 searchWithMatches 預設會給)
      if (!result.matches || result.matches.length === 0) {
        return result.item;
      }

      // 找出 _searchTokens 的匹配
      const tokenMatch = result.matches.find(m => m.key === '_searchTokens');
      if (tokenMatch && tokenMatch.value) {
        const matchedMatched = tokenMatch.value;
        const originalName = result.item.bggName || result.item.displayName;

        // 如果命中的別名和原本的名字不同，則動態覆寫 displayName
        if (matchedMatched.toLowerCase() !== originalName.toLowerCase()) {
          return {
            ...result.item,
            cleanName: matchedMatched,
            displayName: `${matchedMatched} (${originalName})`
          };
        }
      }

      return result.item;
    });
  }, [aggregatedOptions, searchQuery]);

  return gameOptions;
};
