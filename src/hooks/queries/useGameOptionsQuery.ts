
import { useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useTemplateQuery } from './useTemplateQuery';
import { useSavedGameQuery } from './useSavedGameQuery';
import { useGameOptionAggregator } from '../../features/game-selector/hooks/useGameOptionAggregator';
import { searchService } from '../../services/searchService';
import { GameOption } from '../../features/game-selector/types';
import { BggGameSummary, extractBggGameSummary } from '../../utils/extractDataSummaries';
import { GameTemplate, SavedListItem } from '../../types';
import { getGameSearchNames, getRecentSearchUids, normalizeGameSearch } from '../../features/game-selector/utils/searchRanking';
import { LanguageContext } from '../../i18n';
import { computeOfficialLaunchStates, localOfficialVersion } from '../../features/official-boards/officialBoards';
import { mergeOfficialGameInfo } from '../../features/official-boards/officialGameInfo';
import type { OfficialCatalogEntry } from '../../features/official-boards/types';

const EMPTY_CATALOG: OfficialCatalogEntry[] = [];

const useIsOnline = () => {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

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
    systemTemplates: allSystemTemplates,
    hiddenTemplateIdentities,
    templatesLoaded
  } = useTemplateQuery('', pinnedIds, false, undefined, enabled);

  const {
    savedGames: allSavedGames,
    savedGamesLoaded
  } = useSavedGameQuery('');

  // 2. Fetch BGG Dictionary (Lite Summary)
  // [Optimization] 使用 extractBggGameSummary 轉換為輕量物件
  const allBggGames = useLiveQuery(async () => {
    if (!enabled) return undefined;
    const rawGames = await db.bggGames.toArray();
    return rawGames.map(extractBggGameSummary);
  }, [enabled]);

  // 3. Aggregate Data (Merge & Deduplicate)
  // 將 BGG Summary 傳入，讓 Aggregator 進行名稱匹配與搜尋索引補完
  // [Update] Pass pinnedIds so Aggregator can determine isPinned status
  // 3a. Official catalog (local copy) for the current language.
  // Read the language without requiring a provider (zh-TW is the app default).
  const isEnglish = (useContext(LanguageContext)?.language ?? 'zh-TW').startsWith('en');
  const localOfficialCatalog = useLiveQuery(
    async () => enabled ? db.officialCatalog.toArray() : undefined,
    [enabled]
  );
  const officialCatalog = localOfficialCatalog ?? EMPTY_CATALOG;
  const languageCatalog = useMemo(
    () => officialCatalog.filter(entry =>
      typeof entry.version === 'number' && typeof entry.lang === 'string' && entry.lang.startsWith('en') === isEnglish),
    [officialCatalog, isEnglish]
  );

  // Aliases and other game info from the official catalog fill in the local BGG dictionary.
  const bggGamesForOptions = useMemo(
    () => (allBggGames ? mergeOfficialGameInfo(allBggGames, officialCatalog) : allBggGames),
    [allBggGames, officialCatalog]
  );

  // Official boards published only to the cloud have no local template yet. List
  // them by name so they can be found and started (the board downloads on start).
  const cloudOnlyTemplates = useMemo<GameTemplate[]>(() => {
    // Until built-ins have loaded, every catalog entry would look cloud-only.
    if (!enabled || !templatesLoaded || languageCatalog.length === 0) return EMPTY_TEMPLATES;
    const present = new Set(allSystemTemplates.map(t => t.sourceTemplateId || t.id));
    return languageCatalog
      .filter(entry => !present.has(entry.id))
      .map(entry => ({ id: entry.id, name: entry.name, bggId: entry.bggId, columns: [], createdAt: 0, updatedAt: entry.updatedAt }));
  }, [enabled, templatesLoaded, languageCatalog, allSystemTemplates]);

  const templatesForOptions = useMemo(
    () => enabled ? [...allTemplates, ...allSystemTemplates, ...cloudOnlyTemplates] : EMPTY_TEMPLATES,
    [enabled, allTemplates, allSystemTemplates, cloudOnlyTemplates]
  );
  const localGameDataLoaded = templatesLoaded && savedGamesLoaded && allBggGames !== undefined;
  const mergedOptions = useGameOptionAggregator(
    templatesForOptions,
    enabled ? allSavedGames : EMPTY_SAVED_GAMES,
    enabled ? bggGamesForOptions ?? EMPTY_BGG_GAMES : EMPTY_BGG_GAMES,
    pinnedIds,
    localGameDataLoaded,
    hiddenTemplateIdentities
  );

  // 3b. Mark options whose official board must be downloaded or has a newer version.
  // A user's own edited copy (shadow) has its own ID, so it never gets a status.
  const isOnline = useIsOnline();
  const aggregatedOptions = useMemo(() => {
    if (!templatesLoaded || languageCatalog.length === 0) return mergedOptions;
    const localVersions = new Map<string, number>();
    allSystemTemplates.forEach(t => {
      if (!t.sourceTemplateId) localVersions.set(t.id, localOfficialVersion(t));
    });
    const states = computeOfficialLaunchStates(languageCatalog, localVersions);
    if (states.size === 0) return mergedOptions;
    return mergedOptions.map(option => {
      const state = option.templateId ? states.get(option.templateId) : undefined;
      if (!state) return option;
      return { ...option, officialBoardStatus: state === 'needs_download' && !isOnline ? 'needs_connection' as const : state };
    });
  }, [mergedOptions, templatesLoaded, languageCatalog, allSystemTemplates, isOnline]);

  const recentSearchUids = useMemo(() => getRecentSearchUids(aggregatedOptions), [aggregatedOptions]);

  // 4. Search
  const gameOptions = useMemo(() => {
    if (!enabled) return [];
    const normalizedQuery = normalizeGameSearch(searchQuery);
    if (!normalizedQuery) return aggregatedOptions;

    const fuseResults = searchService.searchWithMatches<GameOption>(aggregatedOptions, searchQuery, [
      { name: 'displayName', weight: 1.0 },
      { name: '_searchTokens', weight: 0.8 }
    ], { includeScore: true });

    return fuseResults.map(result => {
      const names = getGameSearchNames(result.item);
      const item: GameOption = { ...result.item, _searchRanking: {
        query: normalizedQuery,
        score: result.score,
        recentMatch: recentSearchUids.has(result.item.uid) && names.some(name => name.includes(normalizedQuery)),
        exactNameMatch: names.includes(normalizedQuery)
      } };
      // 若沒有匹配資訊，直接回傳原物件 (雖然 searchWithMatches 預設會給)
      if (!result.matches || result.matches.length === 0) {
        return item;
      }

      // 找出 _searchTokens 的匹配
      const tokenMatch = result.matches.find(m => m.key === '_searchTokens');
      if (tokenMatch && tokenMatch.value) {
        const matchedMatched = tokenMatch.value;
        const originalName = result.item.displayName;

        // 如果命中的別名和原本的名字不同，則動態覆寫 displayName
        if (matchedMatched.toLowerCase() !== originalName.toLowerCase()) {
          return {
            ...item,
            cleanName: matchedMatched,
            displayName: `${matchedMatched} (${originalName})`
          };
        }
      }

      return item;
    });
  }, [aggregatedOptions, searchQuery, enabled, recentSearchUids]);

  return {
    gameOptions,
    gameOptionsLoaded: enabled && localGameDataLoaded && localOfficialCatalog !== undefined,
    // Keep this unsearched list as the single source for both surfaces' recency ordering.
    allOptions: aggregatedOptions
  };
};
