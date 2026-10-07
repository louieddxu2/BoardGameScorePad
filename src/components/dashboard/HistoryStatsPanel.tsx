import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, Gamepad2, Images, MapPin, Search, Users } from 'lucide-react';
import { HistoryGameEntry, buildHistoryGameEntries, createHistoryPlayerResolver } from '../../utils/historyGameEntries';
import { buildHistoryStats, getNextHistoryStatsDateRange, HistoryStatsDateRange, buildSpecificGameStats } from '../../utils/historyStats';
import { buildHistoryPlayerEntries, buildSpecificPlayerStats } from '../../utils/historyPlayerEntries';
import HistoryPhotoGridShareModal from './HistoryPhotoGridShareModal';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';
import { ScoringRule, SavedListItem } from '../../types';
import { HistorySummary } from '../../utils/extractDataSummaries';
import UpwardSelectMenu, { UpwardSelectMenuAnchor } from '../shared/UpwardSelectMenu';
import { DATA_LIMITS } from '../../dataLimits';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import type { HistoryStatsDetailView, HistoryStatsOverviewTab } from './historyStatsViewTypes';
import { buildHistoryStatsGameView } from './parts/buildHistoryStatsGameView';
import { buildHistoryStatsPlayerView } from './parts/buildHistoryStatsPlayerView';
import { buildHistoryStatsOverviewView } from './parts/buildHistoryStatsOverviewView';

interface HistoryStatsPanelProps {
  entries: HistoryGameEntry[];
  records?: HistorySummary[];
  savedPlayers?: Pick<SavedListItem, 'id' | 'name'>[];
  onSearchClick: () => void;
  isSearchKeyboardOpen?: boolean;
  onSelect?: (record: HistorySummary) => void;
}

const BOTTOM_ROW_HEIGHT_CLASS = 'h-[60px]';
const ACTION_ROW_WIDTH_CLASS = 'w-[118px] sm:w-[140px]';
const STATS_FILTER_ALL = '__all__';
const SCORING_RULE_ORDER: ScoringRule[] = ['HIGHEST_WINS', 'LOWEST_WINS', 'COOP', 'COMPETITIVE_NO_SCORE', 'COOP_NO_SCORE'];
const DATE_RANGE_LABEL_KEYS: Record<HistoryStatsDateRange, 'stats_range_all' | 'stats_range_month' | 'stats_range_quarter' | 'stats_range_year'> = {
  all: 'stats_range_all',
  month: 'stats_range_month',
  quarter: 'stats_range_quarter',
  year: 'stats_range_year'
};

const formatDate = (timestamp: number | undefined, emptyLabel: string) => {
  if (!timestamp) return emptyLabel;
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const HistoryStatsPanel: React.FC<HistoryStatsPanelProps> = ({
  entries,
  records,
  savedPlayers,
  onSearchClick,
  isSearchKeyboardOpen = false,
  onSelect
}) => {
  const { t, language } = useHistoryStatsTranslation();
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [showPhotoGrid, setShowPhotoGrid] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateRange, setDateRange] = useState<HistoryStatsDateRange>('all');
  const [scoringRuleFilter, setScoringRuleFilter] = useState<ScoringRule | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<({ type: 'rule' | 'location' } & UpwardSelectMenuAnchor) | null>(null);
  const menuListRef = useRef<HTMLDivElement>(null);
  const [overviewTab, setOverviewTab] = useState<HistoryStatsOverviewTab>('games');
  const [detailView, setDetailView] = useState<HistoryStatsDetailView | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const overviewScrollPosRef = useRef<Record<HistoryStatsOverviewTab, { top: number; left: number }>>({
    games: { top: 0, left: 0 },
    players: { top: 0, left: 0 }
  });

  const returnToOverview = React.useCallback(() => setDetailView(null), []);
  const { zIndex } = useModalBackHandler(!!detailView, returnToOverview, 'history-stats-detail');

  const saveOverviewScrollPosition = () => {
    if (scrollContainerRef.current) {
      overviewScrollPosRef.current[overviewTab] = {
        top: scrollContainerRef.current.scrollTop,
        left: scrollContainerRef.current.scrollLeft
      };
    }
  };

  const handleGameSelect = (gameKey: string) => {
    if (!detailView) saveOverviewScrollPosition();
    setDetailView({ type: 'game', key: gameKey, tab: 'players' });
  };

  const handlePlayerSelect = (playerKey: string) => {
    if (!detailView) saveOverviewScrollPosition();
    setDetailView({ type: 'player', key: playerKey, tab: 'games' });
  };

  const handleOverviewTabChange = (nextTab: HistoryStatsOverviewTab) => {
    if (nextTab === overviewTab) return;
    saveOverviewScrollPosition();
    setOverviewTab(nextTab);
  };

  React.useEffect(() => {
    if (!detailView && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          const position = overviewScrollPosRef.current[overviewTab];
          scrollContainerRef.current.scrollTop = position.top;
          scrollContainerRef.current.scrollLeft = position.left;
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [detailView, overviewTab]);

  // 1. 單局層面篩選：時間
  const dateFilteredRecords = useMemo(() => {
    if (!records) return [];
    if (dateRange === 'all') return records;
    const days = { month: 30, quarter: 90, year: 365 }[dateRange] || 0;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return records.filter(r => r.endTime >= cutoff);
  }, [records, dateRange]);

  // 2. 為了維持 locationOptions / scoringRuleOptions 的計算相容性
  // 我們先將 dateFilteredRecords 臨時聚合為 dateFilteredEntries，用來提取原有的過濾選項
  const dateFilteredEntries = useMemo(() => {
    if (!records) return entries; // fallback
    return buildHistoryGameEntries(dateFilteredRecords, { savedPlayers });
  }, [records, dateFilteredRecords, savedPlayers, entries]);

  const scoringRuleOptions = useMemo(
    () => SCORING_RULE_ORDER.filter(rule => dateFilteredEntries.some(entry => entry.scoringRules.includes(rule))),
    [dateFilteredEntries]
  );

  const locationOptions = useMemo(
    () => Array.from(new Set(dateFilteredRecords.map(r => r.location?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b)),
    [dateFilteredRecords]
  );

  const activeScoringRuleFilter = scoringRuleFilter && scoringRuleOptions.includes(scoringRuleFilter) ? scoringRuleFilter : null;
  const activeLocationFilter = locationFilter && locationOptions.includes(locationFilter) ? locationFilter : null;

  // 3. 單局層面篩選：套用所有條件（地點、規則、人數）
  const filteredRecords = useMemo(() => {
    return dateFilteredRecords.filter(r => {
      if (activeLocationFilter && r.location?.trim() !== activeLocationFilter) return false;
      if (activeScoringRuleFilter && r.scoringRule !== activeScoringRuleFilter) return false;
      if (playerCount && r.players.length !== playerCount) return false;
      return true;
    });
  }, [dateFilteredRecords, activeLocationFilter, activeScoringRuleFilter, playerCount]);

  // 4. 重建最終過濾後的聚合 entries
  const filteredEntries = useMemo(() => {
    if (!records) return entries; // fallback
    return buildHistoryGameEntries(filteredRecords, { savedPlayers });
  }, [records, filteredRecords, savedPlayers, entries]);

  const stats = useMemo(() => buildHistoryStats(filteredEntries), [filteredEntries]);
  const playerEntries = useMemo(
    () => buildHistoryPlayerEntries(filteredRecords, { savedPlayers }),
    [filteredRecords, savedPlayers]
  );
  const resolveHistoryPlayer = useMemo(
    () => createHistoryPlayerResolver({ savedPlayers }),
    [savedPlayers]
  );

  const specificStats = useMemo(() => {
    if (detailView?.type !== 'game' || !records) return null;
    
    // 1. Try to compute stats using filtered records
    const stats = buildSpecificGameStats(detailView.key, filteredRecords, { savedPlayers });
    if (stats) return stats;

    // 2. Fallback: If no records match under current filters, use unfiltered records to extract base game info
    const baseStats = buildSpecificGameStats(detailView.key, records, { savedPlayers });
    if (!baseStats) return null;

    // Return an empty stats structure to keep the panel open and display 0 plays
    return {
      gameName: baseStats.gameName,
      playCount: 0,
      latestPlayedAt: 0,
      coopPlayCount: 0,
      competitivePlayCount: 0,
      hasNoScorePlays: false,
      noScorePlayCount: 0,
      players: [],
      records: []
    };
  }, [detailView, records, filteredRecords, savedPlayers]);

  React.useEffect(() => {
    if (detailView?.type === 'game' && records && !buildSpecificGameStats(detailView.key, records, { savedPlayers })) {
      setDetailView(null);
    }
  }, [detailView, records, savedPlayers]);

  const specificPlayerStats = useMemo(() => {
    if (detailView?.type !== 'player' || !records) return null;

    const stats = buildSpecificPlayerStats(detailView.key, filteredRecords, { savedPlayers });
    if (stats) return stats;

    const baseStats = buildSpecificPlayerStats(detailView.key, records, { savedPlayers });
    if (!baseStats) return null;

    return {
      ...baseStats,
      playCount: 0,
      gameCount: 0,
      latestPlayedAt: 0,
      games: [],
      recentGames: [],
      records: [],
      recordIds: []
    };
  }, [detailView, records, filteredRecords, savedPlayers]);

  const playsText = useMemo(() => {
    if (!specificStats) return '';
    if (specificStats.noScorePlayCount > 0) {
      if (specificStats.coopPlayCount > 0 && specificStats.competitivePlayCount > 0) {
        return t('stats_plays_mixed_no_score')
          .replace('{scored}', (specificStats.playCount - specificStats.noScorePlayCount).toString())
          .replace('{noScore}', specificStats.noScorePlayCount.toString());
      } else if (specificStats.coopPlayCount > 0) {
        return t('stats_plays_coop_no_score')
          .replace('{scored}', (specificStats.playCount - specificStats.noScorePlayCount).toString())
          .replace('{noScore}', specificStats.noScorePlayCount.toString());
      } else {
        return t('stats_plays_comp_no_score')
          .replace('{scored}', (specificStats.playCount - specificStats.noScorePlayCount).toString())
          .replace('{noScore}', specificStats.noScorePlayCount.toString());
      }
    } else {
      if (specificStats.coopPlayCount > 0 && specificStats.competitivePlayCount > 0) {
        return t('stats_plays_mixed')
          .replace('{count}', specificStats.playCount.toString())
          .replace('{comp}', specificStats.competitivePlayCount.toString())
          .replace('{coop}', specificStats.coopPlayCount.toString());
      } else if (specificStats.coopPlayCount > 0) {
        return t('stats_plays_coop_only').replace('{count}', specificStats.playCount.toString());
      } else {
        return t('stats_plays_comp_only').replace('{count}', specificStats.playCount.toString());
      }
    }
  }, [specificStats, t]);

  const displayedGames = useMemo(() => {
    return stats.games.slice(0, DATA_LIMITS.QUERY.HISTORY_STATS_GAMES);
  }, [stats.games]);
  const displayedPlayers = useMemo(() => {
    return playerEntries.slice(0, DATA_LIMITS.QUERY.HISTORY_STATS_PLAYERS);
  }, [playerEntries]);
  const hiddenGameCount = Math.max(0, stats.games.length - displayedGames.length);
  const hiddenPlayerCount = Math.max(0, playerEntries.length - displayedPlayers.length);
  const isPanelExpanded = isExpanded && !isSearchKeyboardOpen;
  const panelLayoutClass = isSearchKeyboardOpen
    ? 'bottom-0 left-0 right-0 h-[220px]'
    : (isExpanded ? 'inset-0 top-[calc(56px+var(--app-safe-area-top))]' : 'bottom-0 left-0 right-0 h-[45dvh]');
  const dateRangeLabel = t(DATE_RANGE_LABEL_KEYS[dateRange]);
  const ruleLabel = activeScoringRuleFilter
    ? t(`rule_${activeScoringRuleFilter}` as any)
    : t('stats_rules_short');
  const locationLabel = activeLocationFilter || t('stats_locations_short');
  const allLabel = t('stats_filter_unlimited');
  const scoringRuleMenuOptions = useMemo(() => [
    { value: STATS_FILTER_ALL, label: allLabel },
    ...scoringRuleOptions.map(rule => ({
      value: rule,
      label: t(`rule_${rule}` as any)
    }))
  ], [allLabel, scoringRuleOptions, t]);
  const locationMenuOptions = useMemo(() => [
    { value: STATS_FILTER_ALL, label: allLabel },
    ...locationOptions.map(location => ({ value: location, label: location }))
  ], [allLabel, locationOptions]);
  const photoGridEntries = useMemo(() => {
    if (detailView?.type === 'game') {
      return filteredEntries.filter(entry => entry.gameKey === detailView.key);
    }
    if (detailView?.type === 'player') {
      const playerRecords = filteredRecords.filter(record => (
        record.players.some(player => resolveHistoryPlayer(player)?.key === detailView.key)
      ));
      return buildHistoryGameEntries(playerRecords, { savedPlayers });
    }
    return filteredEntries;
  }, [detailView, filteredEntries, filteredRecords, resolveHistoryPlayer, savedPlayers]);
  const photoGridCompanionCount = useMemo(() => {
    if (detailView?.type !== 'player' || !specificPlayerStats) return undefined;
    return new Set(
      specificPlayerStats.games.flatMap(game => game.companions.map(companion => companion.key))
    ).size;
  }, [detailView, specificPlayerStats]);
  const photoGridScopeLabel = detailView?.type === 'game'
    ? specificStats?.gameName
    : detailView?.type === 'player'
      ? specificPlayerStats?.name
      : null;
  const photoGridContextLabel = [
    photoGridScopeLabel,
    dateRangeLabel,
    activeScoringRuleFilter ? ruleLabel : null,
    activeLocationFilter,
    playerCount ? `${playerCount} ${t('stats_players_label')}` : null
  ].filter(Boolean).join(' · ');

  const openMenu = (type: 'rule' | 'location', event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, type === 'location' ? 180 : 150);
    const viewportPadding = 8;
    setActiveMenu({
      type,
      bottom: window.innerHeight - rect.top,
      left: Math.min(Math.max(rect.left, viewportPadding), window.innerWidth - menuWidth - viewportPadding),
      width: menuWidth
    });
  };

  return (
    <>
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-50 w-11 h-11 flex items-center justify-center rounded-xl border shadow-ui-floating pointer-events-auto transition-all active:scale-95 ${
          isPanelExpanded
            ? 'bg-app-bg-deep text-brand-primary border-brand-primary'
            : 'bg-app-bg-deep/95 text-txt-muted border-surface-border hover:border-txt-muted'
        }`}
        style={detailView && zIndex ? { zIndex: zIndex + 1 } : undefined}
        title={isPanelExpanded ? t('stats_collapse') : t('stats_expand')}
      >
        {isPanelExpanded ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
      </button>

      <div
        className={`absolute z-40 flex flex-col pointer-events-none transition-all duration-300 ease-in-out ${panelLayoutClass}`}
        style={{
          bottom: 'var(--bottom-ui-safe-gap)',
          ...(detailView && zIndex ? { zIndex } : {}),
        }}
      >
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col bg-app-bg border-t border-surface-border shadow-ui-floating pointer-events-auto relative transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 p-1 text-center pointer-events-none z-10 opacity-30">
            <ChevronUp size={12} className="text-txt-muted mx-auto" />
          </div>

          {!detailView && (
            <div className="flex-none h-8 pl-3 border-b border-surface-border bg-app-bg flex items-center gap-3 overflow-hidden text-[11px] font-bold text-txt-muted whitespace-nowrap">
              <span><span className="text-txt-primary font-mono">{stats.playCount}</span> {t('stats_count_label')}</span>
              <span>{t('stats_latest_label')} <span className="text-txt-primary">{formatDate(stats.latestPlayedAt, t('stats_empty_date'))}</span></span>
              <button
                onClick={() => handleOverviewTabChange(overviewTab === 'games' ? 'players' : 'games')}
                className="ml-auto h-full px-3 border-l border-surface-border flex items-center gap-1.5 text-brand-primary bg-app-bg-deep hover:bg-surface-hover transition-colors shrink-0"
                title={overviewTab === 'games' ? t('stats_show_players') : t('stats_show_games')}
              >
                {overviewTab === 'games' ? <Users size={13} /> : <Gamepad2 size={13} />}
                <span>
                  {overviewTab === 'games'
                    ? t('stats_total_players').replace('{count}', playerEntries.length.toString())
                    : t('stats_total_games').replace('{count}', stats.gameCount.toString())}
                </span>
              </button>
            </div>
          )}

          <div className="flex flex-col flex-1 min-h-0 overflow-auto no-scrollbar pb-2" ref={scrollContainerRef}>
            {stats.games.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-txt-muted opacity-70 gap-2">
                <BarChart3 size={32} />
                <span className="text-sm font-bold">{t('stats_empty_records')}</span>
              </div>
            ) : detailView?.type === 'game' && specificStats ? (
              buildHistoryStatsGameView({ specificStats, detailView, setDetailView, returnToOverview, handlePlayerSelect, playsText, language, onSelect, t })
            ) : detailView?.type === 'player' && specificPlayerStats ? (
              buildHistoryStatsPlayerView({ specificPlayerStats, detailView, setDetailView, returnToOverview, handleGameSelect, resolveHistoryPlayer, language, onSelect, t })
            ) : (
              buildHistoryStatsOverviewView({ overviewTab, displayedGames, displayedPlayers, hiddenGameCount, hiddenPlayerCount, handleGameSelect, handlePlayerSelect, t })
            )}
          </div>

          <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-surface-border z-10 bg-app-bg-deep`}>
            <div className="min-w-0 flex-1 flex items-center gap-2 px-3 pr-[126px] sm:pr-[148px] pointer-events-auto">
              {/* 未來如需啟用計分規則篩選，請將下方註解解除：
              <button
                onClick={(event) => openMenu('rule', event)}
                className={`h-10 shrink-0 bg-app-bg border rounded-lg px-2.5 flex items-center gap-1 hover:border-txt-secondary transition-colors ${
                  activeScoringRuleFilter ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : 'border-surface-border text-txt-primary'
                }`}
                title={activeScoringRuleFilter ? ruleLabel : t('stats_all_rules')}
              >
                <span className="text-sm font-bold whitespace-nowrap max-w-[96px] truncate">{ruleLabel}</span>
                <ChevronUp size={14} className="text-txt-muted shrink-0" />
              </button>
              */}

              <button
                onClick={(event) => openMenu('location', event)}
                className={`h-10 bg-app-bg border rounded-lg px-2.5 flex items-center gap-1 hover:border-txt-secondary transition-colors ${
                  activeLocationFilter ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : 'border-surface-border text-txt-primary'
                }`}
                title={activeLocationFilter || t('stats_all_locations')}
              >
                <MapPin size={13} className="text-txt-muted shrink-0" />
                <span className="text-sm font-bold whitespace-nowrap max-w-[96px] truncate">{locationLabel}</span>
                <ChevronUp size={14} className="text-txt-muted shrink-0" />
              </button>

              {/* 未來如需啟用意圖人數篩選，請將下方註解解除：
              <div className={`h-10 w-[104px] shrink-0 flex items-center justify-between bg-app-bg rounded-xl p-1 border relative overflow-hidden transition-all duration-300 ${
                playerCount ? 'border-brand-primary bg-brand-primary/10' : 'border-surface-border'
              }`}>
                <button
                  onClick={() => setPlayerCount(prev => prev === null || prev <= 1 ? null : prev - 1)}
                  className="w-8 h-8 flex items-center justify-center bg-surface-bg text-txt-muted rounded-lg active:scale-95 transition-transform hover:bg-surface-bg-alt relative z-10 shrink-0"
                >
                  <Minus size={16} />
                </button>

                <div className="flex-1 relative h-8 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <Users size={22} className="transition-colors text-txt-muted opacity-30" />
                  </div>
                  <span className={`text-base font-black font-mono relative z-10 drop-shadow-md transition-colors ${playerCount ? 'text-brand-primary' : 'text-txt-muted'}`}>
                    {playerCount || '-'}
                  </span>
                </div>

                <button
                  onClick={() => setPlayerCount(prev => Math.min(20, (prev || 0) + 1))}
                  className="w-8 h-8 flex items-center justify-center bg-brand-primary/10 text-brand-primary rounded-lg active:scale-95 transition-transform border border-brand-primary/20 hover:bg-brand-primary/20 relative z-10 shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
              */}

              <button
                onClick={() => setDateRange(prev => getNextHistoryStatsDateRange(prev))}
                className="h-10 bg-app-bg border border-surface-border rounded-lg px-2.5 flex items-center gap-1.5 text-txt-primary hover:border-txt-secondary transition-colors"
                title={t('stats_date_filter_title')}
              >
                <CalendarDays size={14} className="text-txt-muted shrink-0" />
                <span className="text-sm font-bold whitespace-nowrap">{dateRangeLabel}</span>
              </button>
            </div>

            <div className={`absolute bottom-0 right-0 ${ACTION_ROW_WIDTH_CLASS} ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-l border-surface-border z-20 bg-app-bg-deep pointer-events-auto`}>
            <button
              onClick={onSearchClick}
              className="w-[50px] h-full flex items-center justify-center bg-app-bg hover:bg-surface-bg text-brand-primary transition-colors active:brightness-90 border-r border-surface-border"
              title={t('stats_search_history')}
            >
              <Search size={22} strokeWidth={2.5} />
            </button>

            <button
              onClick={() => setShowPhotoGrid(true)}
              className="flex-1 min-w-0 h-full flex flex-col items-center justify-center gap-0.5 transition-all active:brightness-90 bg-brand-primary hover:filter hover:brightness-110 text-white"
              title={t('stats_photo_grid_title')}
            >
              <Images size={23} />
              <span className="text-[10px] font-bold leading-none">{t('stats_photo_recap_action')}</span>
            </button>
            </div>
          </div>
        </div>
      </div>

      <HistoryPhotoGridShareModal
        isOpen={showPhotoGrid}
        entries={photoGridEntries}
        contextLabel={photoGridContextLabel}
        selectionMode={detailView?.type === 'game' ? 'records' : 'games'}
        playerCountOverride={photoGridCompanionCount}
        playerLabelOverride={detailView?.type === 'player' ? t('stats_companions_label') : undefined}
        onClose={() => setShowPhotoGrid(false)}
      />

      {activeMenu?.type === 'rule' && (
        <UpwardSelectMenu
          anchor={activeMenu}
          options={scoringRuleMenuOptions}
          selectedValue={activeScoringRuleFilter || STATS_FILTER_ALL}
          onSelect={(value) => {
            setScoringRuleFilter(value === STATS_FILTER_ALL ? null : value as ScoringRule);
            setActiveMenu(null);
          }}
          onClose={() => setActiveMenu(null)}
          listRef={menuListRef}
          zIndex={detailView && zIndex ? zIndex + 5 : undefined}
        />
      )}

      {activeMenu?.type === 'location' && (
        <UpwardSelectMenu
          anchor={activeMenu}
          options={locationMenuOptions}
          selectedValue={activeLocationFilter || STATS_FILTER_ALL}
          onSelect={(value) => {
            setLocationFilter(value === STATS_FILTER_ALL ? null : value);
            setActiveMenu(null);
          }}
          onClose={() => setActiveMenu(null)}
          listRef={menuListRef}
          zIndex={detailView && zIndex ? zIndex + 5 : undefined}
        />
      )}
    </>
  );
};

export default HistoryStatsPanel;
