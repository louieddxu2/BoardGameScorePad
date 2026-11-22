
import { useEffect, useMemo, useState } from 'react';
import { DATA_LIMITS } from '../dataLimits';
import { getRecentOptions } from '../features/game-selector/utils/sortStrategies';
import { useTemplateQuery } from './queries/useTemplateQuery';
import { useHistoryQuery } from './queries/useHistoryQuery';
import { useSessionQuery } from './queries/useSessionQuery';
import { useLibraryQuery } from './queries/useLibraryQuery';
import { useSavedGameQuery } from './queries/useSavedGameQuery';
import { useGameOptionsQuery } from './queries/useGameOptionsQuery';
import type { GameOption } from '../features/game-selector/types';

/**
 * App Queries Aggregator
 * 
 * 職責：作為應用程式頂層的資料供應站，聚合所有特定的查詢 Hook。
 * 注意：此 Hook 不應包含具體的資料處理邏輯 (如搜尋、排序、合併)，
 * 這些邏輯應封裝在各自的 ./queries/*.ts Hook 中。
 */
export const useAppQueries = (
  searchQuery: string,
  pinnedIds: string[],
  isDbReady: boolean,
  { historyRequested = false, gameOptionsRequested = false } = {},
) => {
  const savedGameData = useSavedGameQuery();
  const templateData = useTemplateQuery(searchQuery, pinnedIds, isDbReady);

  // 2. Global / Context Queries (No search dependency)
  const sessionData = useSessionQuery();
  const libraryData = useLibraryQuery();
  const historyData = useHistoryQuery(searchQuery, libraryData.savedPlayersAll, isDbReady && historyRequested);

  // 3. Start Game Panel Query (Merge then Search)
  // 這是一個專門的 Hook，負責處理「開始新遊戲」時的候選名單邏輯
  const gameOptionData = useGameOptionsQuery(searchQuery, pinnedIds, {
    ...templateData.unfiltered,
    hiddenTemplateIdentities: templateData.hiddenTemplateIdentities,
    templatesLoaded: templateData.templatesLoaded,
    ...savedGameData,
  }, isDbReady, gameOptionsRequested);
  // Home and the FAB share getRecentOptions; Home skips pinned/active rows because
  // those already have dedicated rows in its quick-start section. The FAB passes
  // the same active-session IDs to its recent slice.
  const recentlyPlayedGames = useMemo(() => {
    const activeTemplateIds = new Set((sessionData.activeSessions ?? []).map(session => session.templateId));
    return getRecentOptions(gameOptionData.allOptions, DATA_LIMITS.QUERY.RECENT_GAMES, activeTemplateIds);
  }, [gameOptionData.allOptions, sessionData.activeSessions]);
  const recentsReady = sessionData.activeSessionsLoaded && gameOptionData.recentlyPlayedGamesLoaded;
  // Keep the last complete list visible if a newly saved game needs dictionary matching.
  const [previousRecents, setPreviousRecents] = useState<GameOption[]>();
  useEffect(() => {
    if (recentsReady) setPreviousRecents(recentlyPlayedGames);
  }, [recentsReady, recentlyPlayedGames]);
  const isLibraryLoading = !isDbReady || !sessionData.activeSessionsLoaded
    || (!recentsReady && previousRecents === undefined);

  return {
    // Spread all data props from sub-hooks
    ...templateData,
    ...historyData,
    ...sessionData,
    ...libraryData,

    // The merged options list
    gameOptions: gameOptionData.gameOptions,
    gameOptionsLoaded: gameOptionData.gameOptionsLoaded,
    recentlyPlayedGames: recentsReady ? recentlyPlayedGames : previousRecents ?? recentlyPlayedGames,
    isLibraryLoading,

    // Optimistic UI actions
    setPendingDeleteHistoryIds: historyData.setPendingDeleteHistoryIds
  };
};
