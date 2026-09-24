import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { DATA_LIMITS } from '../../dataLimits';
import { searchService } from '../../services/searchService';
import { SavedListItem } from '../../types';
import type { GameSession } from '../../types';
import { extractHistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryGameEntries } from '../../utils/historyGameEntries';
import { selectRecentGames } from '../../utils/recentTemplateIds';
import type { RecentGameSummary } from '../../utils/recentTemplateIds';
import type { HistorySummary } from '../../utils/extractDataSummaries';

interface RecentTemplateOptions {
  pinnedIds: string[];
  activeSessions: Pick<GameSession, 'templateId' | 'name' | 'bggId'>[] | undefined;
}

interface RecentHistorySummary extends HistorySummary {
  recentBggId?: string;
}

export const useHistoryQuery = (
  searchQuery: string,
  savedPlayers: SavedListItem[] | undefined,
  recentTemplateOptions: RecentTemplateOptions
) => {
  const isSearching = searchQuery && searchQuery.trim().length > 0;
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const allSummaries = useLiveQuery(async (): Promise<RecentHistorySummary[]> => {
    const records = await db.history.orderBy('endTime').reverse().toArray();
    return records.map(record => ({
      ...extractHistorySummary(record),
      // Keep snapshot fallback scoped to the new recent-games shortcut; other
      // history grouping continues to use the established summary identity.
      recentBggId: record.bggId?.trim() || record.snapshotTemplate?.bggId?.trim() || undefined
    }));
  }, [], []);

  const pinnedGames = useLiveQuery(async (): Promise<RecentGameSummary[]> => {
    const pinnedIds = [...new Set(recentTemplateOptions.pinnedIds)];
    if (pinnedIds.length === 0) return [];

    const [userTemplates, builtins] = await Promise.all([
      db.templates.bulkGet(pinnedIds),
      db.builtins.bulkGet(pinnedIds)
    ]);
    const templatesById = new Map<string, RecentGameSummary>();
    [...userTemplates, ...builtins].forEach(template => {
      if (template && !templatesById.has(template.id)) {
        templatesById.set(template.id, {
          templateId: template.id,
          gameName: template.name,
          bggId: template.bggId
        });
      }
    });
    return [...templatesById.values()];
  }, [recentTemplateOptions.pinnedIds], []);

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

  const recentlyPlayedGames = useMemo<RecentGameSummary[]>(() => {
    const activeSessions = recentTemplateOptions.activeSessions ?? [];
    const excludedTemplateIds = new Set([
      ...recentTemplateOptions.pinnedIds,
      ...activeSessions.map(session => session.templateId)
    ]);
    const activeGames = activeSessions.map(session => ({
      templateId: session.templateId,
      gameName: session.name,
      bggId: session.bggId
    }));

    return selectRecentGames(
      activeSummaries,
      excludedTemplateIds,
      DATA_LIMITS.QUERY.RECENT_GAMES,
      [...(pinnedGames ?? []), ...activeGames],
      summary => summary.recentBggId ?? summary.bggId
    ).map(({ templateId, gameName, recentBggId, bggId }) => ({
      templateId,
      gameName,
      bggId: recentBggId ?? bggId
    }));
  }, [
    activeSummaries,
    recentTemplateOptions.pinnedIds,
    recentTemplateOptions.activeSessions,
    pinnedGames
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
