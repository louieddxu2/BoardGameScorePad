import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { SavedListItem } from '../../types';
import { extractHistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryGameEntries } from '../../utils/historyGameEntries';
import { selectRecentGames } from '../../utils/recentTemplateIds';
import type { RecentGameSummary } from '../../utils/recentTemplateIds';

interface RecentTemplateOptions {
  pinnedIds: string[];
  activeSessionIds: string[];
}

export const useHistoryQuery = (
  searchQuery: string,
  savedPlayers: SavedListItem[] | undefined,
  recentTemplateOptions: RecentTemplateOptions
) => {
  const isSearching = searchQuery && searchQuery.trim().length > 0;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const allSummaries = useLiveQuery(async () => {
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

  const recentHistoryCandidates = useMemo(() => {
    const seenTemplateIds = new Set<string>();
    const candidates: typeof activeSummaries = [];

    for (const summary of activeSummaries) {
      const { templateId } = summary;
      if (!templateId || seenTemplateIds.has(templateId)) continue;
      seenTemplateIds.add(templateId);
      candidates.push(summary);
    }

    return candidates;
  }, [activeSummaries]);

  const recentlyPlayedGames = useMemo<RecentGameSummary[]>(() => {
    const excludedTemplateIds = new Set([
      ...recentTemplateOptions.pinnedIds,
      ...recentTemplateOptions.activeSessionIds
    ]);

    return selectRecentGames(
      recentHistoryCandidates,
      excludedTemplateIds,
      DATA_LIMITS.QUERY.RECENT_GAMES
    ).map(({ templateId, gameName, bggId }) => ({ templateId, gameName, bggId }));
  }, [
    recentHistoryCandidates,
    recentTemplateOptions.pinnedIds,
    recentTemplateOptions.activeSessionIds
  ]);

  const historyGameEntries = useMemo(() => {
    return buildHistoryGameEntries(activeSummaries, { savedPlayers });
  }, [activeSummaries, savedPlayers]);

  const filteredSummaries = useMemo(() => {
    let results = activeSummaries;

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

    return results;
  }, [activeSummaries, searchQuery, isSearching]);

  return {
    historyRecords: filteredSummaries.slice(0, DATA_LIMITS.QUERY.HISTORY_RECORDS),
    historyStatsRecords: filteredSummaries,
    historyGameEntries,
    recentlyPlayedGames,
    historyCount: isSearching ? filteredSummaries.length : activeSummaries.length,
    setPendingDeleteHistoryIds: setPendingDeleteIds
  };
};
