
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useTemplateQuery } from './useTemplateQuery';
import { useSavedGameQuery } from './useSavedGameQuery';
import { useGameOptionAggregator } from '../../features/game-selector/hooks/useGameOptionAggregator';
import { searchService } from '../../services/searchService';
import { GameOption } from '../../features/game-selector/types';
import { BggGameSummary, extractBggGameSummary } from '../../utils/extractDataSummaries';
import { GameTemplate, SavedListItem } from '../../types';

const EMPTY_TEMPLATES: GameTemplate[] = [];
const EMPTY_SAVED_GAMES: SavedListItem[] = [];
const EMPTY_BGG_GAMES: BggGameSummary[] = [];

/**
 * Game Options Query Hook
 * 
 * 職責：整合 Templates、SavedGames 與 BggGames (字典)，
 * 同時提供搜尋後的開始面板選項與未搜尋的共用候選清單。
 */
export const useGameOptionsQuery = (searchQuery: string, pinnedIds: string[], enabled = true) => {
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
    if (!enabled) return [];
    const rawGames = await db.bggGames.toArray();
    return rawGames.map(extractBggGameSummary);
  }, [enabled], []);

  // 3. Aggregate Data (Merge & Deduplicate)
  // 將 BGG Summary 傳入，讓 Aggregator 進行名稱匹配與搜尋索引補完
  // [Update] Pass pinnedIds so Aggregator can determine isPinned status
  const templatesForOptions = useMemo(
    () => enabled ? [...allTemplates, ...allSystemTemplates] : EMPTY_TEMPLATES,
    [enabled, allTemplates, allSystemTemplates]
  );
  const aggregatedOptions = useGameOptionAggregator(
    templatesForOptions,
    enabled ? allSavedGames : EMPTY_SAVED_GAMES,
    enabled ? allBggGames ?? EMPTY_BGG_GAMES : EMPTY_BGG_GAMES,
    pinnedIds
  );

  // 4. Search
  const gameOptions = useMemo(() => {
    if (!enabled) return [];

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
        const originalName = result.item.displayName;

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
  }, [aggregatedOptions, searchQuery, enabled]);

  return {
    gameOptions,
    // Keep this unsearched list as the single source for both surfaces' recency ordering.
    allOptions: aggregatedOptions
  };
};
