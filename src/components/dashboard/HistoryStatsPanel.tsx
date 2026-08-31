import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Gamepad2, Hash, Images, MapPin, Minus, Search, Users, Plus, CornerUpLeft, Crown, Calculator, Trophy } from 'lucide-react';
import { HistoryGameEntry, buildHistoryGameEntries, createHistoryPlayerResolver } from '../../utils/historyGameEntries';
import { buildHistoryStats, filterHistoryEntriesByDateRange, filterHistoryEntriesByStatsFilters, getNextHistoryStatsDateRange, HistoryStatsDateRange, HistoryStatsGame, buildSpecificGameStats } from '../../utils/historyStats';
import { buildHistoryPlayerEntries, buildSpecificPlayerStats } from '../../utils/historyPlayerEntries';
import HistoryPhotoGridShareModal from './HistoryPhotoGridShareModal';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';
import { ScoringRule, SavedListItem } from '../../types';
import { HistorySummary } from '../../utils/extractDataSummaries';
import UpwardSelectMenu, { UpwardSelectMenuAnchor } from '../shared/UpwardSelectMenu';
import { DATA_LIMITS } from '../../dataLimits';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { ContrastText } from '../shared/ContrastText';

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
const MAX_VISIBLE_STATS_PLAYERS = 10;
const MAX_VISIBLE_RECENT_GAMES = 10;
const MAX_VISIBLE_GAME_COMPANIONS = 10;
const STATS_FILTER_ALL = '__all__';
const SCORING_RULE_ORDER: ScoringRule[] = ['HIGHEST_WINS', 'LOWEST_WINS', 'COOP', 'COMPETITIVE_NO_SCORE', 'COOP_NO_SCORE'];
const DATE_RANGE_LABEL_KEYS: Record<HistoryStatsDateRange, 'stats_range_all' | 'stats_range_month' | 'stats_range_quarter' | 'stats_range_year'> = {
  all: 'stats_range_all',
  month: 'stats_range_month',
  quarter: 'stats_range_quarter',
  year: 'stats_range_year'
};

type HistoryStatsOverviewTab = 'games' | 'players';
type HistoryStatsDetailView =
  | { type: 'game'; key: string; tab: 'players' | 'records' }
  | { type: 'player'; key: string; tab: 'games' | 'records' };

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
      <div
        className={`fixed z-40 flex flex-col pointer-events-none transition-all duration-300 ease-in-out ${panelLayoutClass}`}
        style={{
          bottom: 'var(--bottom-ui-safe-gap)',
          ...(detailView && zIndex ? { zIndex } : {}),
        }}
      >
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className={`fixed right-2 top-1/2 -translate-y-1/2 z-50 w-11 h-11 flex items-center justify-center rounded-xl border shadow-ui-floating pointer-events-auto transition-all active:scale-95 ${
            isPanelExpanded
              ? 'bg-app-bg-deep text-brand-primary border-brand-primary'
              : 'bg-app-bg-deep/95 text-txt-muted border-surface-border hover:border-txt-muted'
          }`}
          title={isPanelExpanded ? t('stats_collapse') : t('stats_expand')}
        >
          {isPanelExpanded ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
        </button>

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
              <div className="flex flex-col w-full flex-1 min-h-0">
                {/* 遊戲名稱與返回列：使用 Flex 兩端對齊排版，避免強行分欄限制空間 */}
                <div 
                  onClick={returnToOverview}
                  className="flex items-center justify-between gap-3 pr-3 py-1.5 min-h-[46px] border-b border-surface-border/70 bg-app-bg hover:bg-surface-hover transition-colors cursor-pointer w-full shrink-0"
                >
                  {/* 左側：返回箭頭 + 遊戲名稱 + 右側最近遊玩與最佳分數 (水平 baseline 對齊) */}
                  <div className="flex items-baseline gap-2 min-w-0 pl-3 flex-1">
                    <ChevronLeft size={18} className="text-brand-primary shrink-0 -ml-1 self-center" />
                    <span className="text-base font-black text-txt-primary truncate shrink-0">{specificStats.gameName}</span>
                    <span className="text-xs text-txt-muted font-normal whitespace-nowrap overflow-x-auto no-scrollbar block ml-2">
                      {specificStats.latestPlayedAt && (
                        <span>
                          {t('stats_latest_play_short').replace('{date}', new Date(specificStats.latestPlayedAt).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }))}
                        </span>
                      )}
                      {specificStats.bestScore !== undefined && specificStats.bestScore !== 0 && specificStats.bestScorePlayerName && (
                        <span className="text-status-warning font-semibold">
                          {specificStats.latestPlayedAt && <span className="mx-1">·</span>}
                          {t('stats_best_score_short')
                            .replace('{score}', specificStats.bestScore.toString())
                            .replace('{suffix}', t('stats_score_suffix'))
                            .replace('{player}', specificStats.bestScorePlayerName)}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 右側：切換按鈕（點擊切換 玩家統計 / 歷局明細） */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailView(prev => prev?.type === 'game'
                        ? { ...prev, tab: prev.tab === 'players' ? 'records' : 'players' }
                        : prev);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all active:scale-95 pointer-events-auto shadow-sm shrink-0 ${
                      detailView.tab === 'records'
                        ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
                        : 'bg-app-bg-deep border-surface-border text-txt-secondary hover:text-txt-primary hover:border-txt-muted'
                    }`}
                  >
                    {detailView.tab === 'players' ? (
                      <>
                        <CalendarDays size={12} className="text-brand-primary shrink-0" />
                        <span>{playsText}</span>
                      </>
                    ) : (
                      <>
                        <Users size={12} className="text-brand-primary shrink-0" />
                        <span>{t('stats_total_players').replace('{count}', specificStats.players.length.toString())}</span>
                      </>
                    )}
                  </button>
                </div>

                {detailView.tab === 'records' ? (
                  specificStats.records && specificStats.records.length > 0 ? (
                    <div className="flex-1 min-h-0 flex flex-col bg-app-bg-deep w-full">
                      {/* 凍結表頭列 */}
                      <div 
                        className="spreadsheet-header-row"
                        style={{ gridTemplateColumns: '52px 85px 1fr 24px' }}
                      >
                        <h3 className="spreadsheet-cell-sticky-header spreadsheet-header-cell overflow-x-auto no-scrollbar">
                          <CalendarDays size={11} />
                          <span>{t('stats_header_date')}</span>
                        </h3>
                        <span className="spreadsheet-header-cell">
                          <MapPin size={11} />
                          <span>{t('stats_header_location')}</span>
                        </span>
                        <span className="spreadsheet-header-cell">
                          <Users size={11} />
                          <span>{t('stats_header_player')}</span>
                        </span>
                        <span></span>
                      </div>

                      {/* 明細列表滾動區 */}
                      <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar">
                        <div className="flex flex-col min-w-full w-max">
                          {specificStats.records.map((record) => {
                            const date = new Date(record.endTime);
                            const dateStr = date.toLocaleDateString(language, { month: '2-digit', day: '2-digit' });
                            
                            return (
                              <div
                                key={record.id}
                                onClick={() => onSelect?.(record)}
                                className="spreadsheet-row cursor-pointer hover:bg-surface-hover"
                                style={{
                                  gridTemplateColumns: '52px 85px 1fr 24px'
                                }}
                              >
                                {/* 1. 日期 (Sticky Left) */}
                                <span className="spreadsheet-cell-sticky flex items-center px-3 text-xs font-mono text-txt-secondary bg-inherit">
                                  {dateStr}
                                </span>

                                {/* 2. 地點 */}
                                <span className="text-xs text-txt-muted truncate pr-2 flex items-center">
                                  {record.location || '-'}
                                </span>

                                {/* 3. 全體玩家與得分（贏家高亮並標記 👑，保留玩家原本色彩） */}
                                <div className="text-xs truncate pr-2 flex items-center gap-1 overflow-hidden">
                                  {record.players.map((p, idx) => {
                                    const isWinner = (p.linkedPlayerId && record.winnerIds.includes(p.linkedPlayerId)) || record.winnerIds.includes(p.id);
                                    const isTransparent = !p.color || p.color === 'transparent';
                                    return (
                                      <React.Fragment key={p.id}>
                                        {idx > 0 && <span className="text-txt-muted/30 mx-0.5">、</span>}
                                        <span className={isWinner ? "font-bold flex items-center gap-0.5 inline-flex" : "inline-flex items-center"}>
                                          {isWinner && <Crown size={10} className="shrink-0 text-status-warning" fill="currentColor" />}
                                          <ContrastText
                                            className="truncate"
                                            color={isTransparent ? 'rgb(var(--c-txt-secondary))' : p.color}
                                          >
                                            {p.name}
                                          </ContrastText>
                                          <span className={isWinner ? "text-status-warning font-mono ml-0.5" : "text-txt-muted font-mono ml-0.5"}>({p.totalScore})</span>
                                        </span>
                                      </React.Fragment>
                                    );
                                  })}
                                </div>

                                {/* 4. 進入箭頭 */}
                                <div className="text-txt-muted flex items-center justify-center">
                                  <ChevronRight size={14} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-txt-muted opacity-70 gap-2 pb-8 bg-app-bg-deep">
                      <CalendarDays size={32} />
                      <span className="text-sm font-bold">{t('stats_empty_records')}</span>
                    </div>
                  )
                ) : (
                  <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar bg-app-bg-deep w-full pb-8">
                    {specificStats.players.length > 0 ? (
                      <div className="flex flex-col min-w-full w-max">
                        <div 
                          className="spreadsheet-header-row"
                          style={{ gridTemplateColumns: 'minmax(0, min(110px, 22vw)) 52px 64px 54px 54px' }}
                        >
                          <h3 className="spreadsheet-cell-sticky-header spreadsheet-header-cell overflow-x-auto no-scrollbar">
                            <Users size={11} />
                            <span>{t('stats_header_player')}</span>
                          </h3>
                          <span className="spreadsheet-header-cell">
                            <Hash size={11} />
                            <span>{t('stats_header_plays')}</span>
                          </span>
                          <span className="spreadsheet-header-cell">
                            <Crown size={11} />
                            <span>{t('stats_header_win_rate')}</span>
                          </span>
                          <span className="spreadsheet-header-cell">
                            <Calculator size={11} />
                            <span>{t('stats_header_avg')}</span>
                          </span>
                          <span className="spreadsheet-header-cell">
                            <Trophy size={11} />
                            <span>{t('stats_header_best')}</span>
                          </span>
                        </div>

                        {specificStats.players.map((player) => (
                          <div
                            key={player.key}
                            onClick={() => handlePlayerSelect(player.key)}
                            className="spreadsheet-row cursor-pointer hover:bg-surface-hover"
                            style={{ gridTemplateColumns: 'minmax(0, min(110px, 22vw)) 52px 64px 54px 54px' }}
                          >
                            <h3 className="spreadsheet-cell-sticky flex flex-col items-start justify-center px-3 text-sm font-black text-txt-primary overflow-x-auto no-scrollbar whitespace-nowrap">
                              {player.name}
                            </h3>
                            <div className="flex items-center justify-start gap-0.5 text-txt-secondary font-mono font-black shrink-0 text-[11px]">
                              {player.noScorePlayCount > 0 ? (
                                <>
                                  <span>{player.playCount - player.noScorePlayCount}</span>
                                  <span className="text-brand-primary font-bold">+{player.noScorePlayCount}</span>
                                  <span className="text-[10px] font-normal text-txt-muted ml-0.5">{t('stats_plays_suffix')}</span>
                                </>
                              ) : (
                                <>
                                  <span>{player.playCount}</span>
                                  <span className="text-[10px] font-normal text-txt-muted ml-0.5">{t('stats_plays_suffix')}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center justify-start pl-4 min-w-max">
                              {player.hasScoringPlay ? (
                                <span className="text-xs font-black text-brand-primary font-mono text-left">
                                  {player.winRate}%
                                </span>
                              ) : (
                                <span className="text-xs font-black text-txt-muted font-mono text-left">
                                  -
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-start pl-4 min-w-max">
                              {player.avgScore !== undefined ? (
                                <span className="text-xs font-black text-txt-primary font-mono text-left">
                                  {player.avgScore}
                                </span>
                              ) : (
                                <span className="text-xs font-black text-txt-muted font-mono text-left">
                                  -
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-start pl-4 min-w-max">
                              {player.personalBestScore !== undefined ? (
                                <span className="text-xs font-black text-status-warning font-mono text-left">
                                  {player.personalBestScore}
                                </span>
                              ) : (
                                <span className="text-xs font-black text-txt-muted font-mono text-left">
                                  -
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {specificStats.hasNoScorePlays && (
                          <div className="text-[10px] text-txt-muted italic py-1.5 pr-3 text-right">
                            {t('stats_win_rate_excludes_no_score')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[11px] font-bold text-txt-muted opacity-70 px-4 text-center">
                        {t('stats_no_scoring_records')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : detailView?.type === 'player' && specificPlayerStats ? (
              <div className="flex flex-col w-full flex-1 min-h-0">
                <div
                  onClick={returnToOverview}
                  className="flex items-center justify-between gap-3 pr-3 py-1.5 min-h-[46px] border-b border-surface-border/70 bg-app-bg hover:bg-surface-hover transition-colors cursor-pointer w-full shrink-0"
                >
                  <div className="flex items-baseline gap-2 min-w-0 pl-3 flex-1">
                    <ChevronLeft size={18} className="text-brand-primary shrink-0 -ml-1 self-center" />
                    <span className="text-base font-black text-txt-primary truncate shrink-0">{specificPlayerStats.name}</span>
                    <span className="text-xs text-txt-muted whitespace-nowrap overflow-hidden text-ellipsis">
                      {specificPlayerStats.latestPlayedAt
                        ? t('stats_latest_play_short').replace(
                          '{date}',
                          new Date(specificPlayerStats.latestPlayedAt).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })
                        )
                        : t('stats_empty_date')}
                    </span>
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setDetailView(prev => prev?.type === 'player'
                        ? { ...prev, tab: prev.tab === 'games' ? 'records' : 'games' }
                        : prev);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all active:scale-95 pointer-events-auto shadow-sm shrink-0 ${
                      detailView.tab === 'records'
                        ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
                        : 'bg-app-bg-deep border-surface-border text-txt-secondary hover:text-txt-primary hover:border-txt-muted'
                    }`}
                  >
                    {detailView.tab === 'games' ? (
                      <>
                        <CalendarDays size={12} className="text-brand-primary shrink-0" />
                        <span>{t('stats_total_plays').replace('{count}', specificPlayerStats.playCount.toString())}</span>
                      </>
                    ) : (
                      <>
                        <Gamepad2 size={12} className="text-brand-primary shrink-0" />
                        <span>{t('stats_total_games').replace('{count}', specificPlayerStats.gameCount.toString())}</span>
                      </>
                    )}
                  </button>
                </div>

                {detailView.tab === 'records' ? (
                  specificPlayerStats.records.length > 0 ? (
                    <div className="flex-1 min-h-0 flex flex-col bg-app-bg-deep w-full">
                      <div
                        className="spreadsheet-header-row"
                        style={{ gridTemplateColumns: '52px minmax(110px, 25vw) 85px minmax(150px, 1fr) 24px' }}
                      >
                        <h3 className="spreadsheet-cell-sticky-header spreadsheet-header-cell">
                          <CalendarDays size={11} />
                          <span>{t('stats_header_date')}</span>
                        </h3>
                        <span className="spreadsheet-header-cell">
                          <Gamepad2 size={11} />
                          <span>{t('stats_header_game')}</span>
                        </span>
                        <span className="spreadsheet-header-cell">
                          <MapPin size={11} />
                          <span>{t('stats_header_location')}</span>
                        </span>
                        <span className="spreadsheet-header-cell">
                          <Users size={11} />
                          <span>{t('stats_header_companions')}</span>
                        </span>
                        <span />
                      </div>

                      <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar">
                        <div className="flex flex-col min-w-full w-max">
                          {specificPlayerStats.records.map(record => (
                            <div
                              key={record.id}
                              onClick={() => onSelect?.(record)}
                              className="spreadsheet-row cursor-pointer hover:bg-surface-hover"
                              style={{ gridTemplateColumns: '52px minmax(110px, 25vw) 85px minmax(150px, 1fr) 24px' }}
                            >
                              <span className="spreadsheet-cell-sticky flex items-center px-3 text-xs font-mono text-txt-secondary bg-inherit">
                                {new Date(record.endTime).toLocaleDateString(language, { month: '2-digit', day: '2-digit' })}
                              </span>
                              <span className="text-xs font-bold text-txt-primary truncate pr-2 flex items-center">
                                {record.gameName}
                              </span>
                              <span className="text-xs text-txt-muted truncate pr-2 flex items-center">
                                {record.location || '-'}
                              </span>
                              <span className="text-xs text-txt-secondary truncate pr-2 flex items-center">
                                {record.players
                                  .filter(player => {
                                    return resolveHistoryPlayer(player)?.key !== specificPlayerStats.key;
                                  })
                                  .map(player => player.name)
                                  .join('、') || '-'}
                              </span>
                              <div className="text-txt-muted flex items-center justify-center">
                                <ChevronRight size={14} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-txt-muted opacity-70 gap-2 bg-app-bg-deep">
                      <CalendarDays size={32} />
                      <span className="text-sm font-bold">{t('stats_empty_records')}</span>
                    </div>
                  )
                ) : (
                  <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar bg-app-bg-deep w-full">
                    <div className="flex flex-col min-w-full w-max">
                      <div
                        className="spreadsheet-header-row"
                        style={{ gridTemplateColumns: 'minmax(0, min(150px, 25vw)) 58px max-content' }}
                      >
                        <h3 className="spreadsheet-cell-sticky-header spreadsheet-header-cell">
                          <Gamepad2 size={11} />
                          <span>{t('stats_header_game')}</span>
                        </h3>
                        <span className="spreadsheet-header-cell">
                          <Hash size={11} />
                          <span>{t('stats_header_win_play_score')}</span>
                        </span>
                        <span className="spreadsheet-header-cell">
                          <Users size={11} />
                          <span>{t('stats_header_companions')}</span>
                        </span>
                      </div>

                      {specificPlayerStats.games.map(game => (
                        <div
                          key={game.key}
                          onClick={() => handleGameSelect(game.key)}
                          className="spreadsheet-row cursor-pointer hover:bg-surface-hover"
                          style={{ gridTemplateColumns: 'minmax(0, min(150px, 25vw)) 58px max-content' }}
                        >
                          <h3 className="spreadsheet-cell-sticky px-3 text-sm font-black text-txt-primary overflow-x-auto no-scrollbar whitespace-nowrap flex items-center">
                            {game.name}
                          </h3>
                          <span className="text-xs font-black font-mono flex items-center gap-0.5">
                            <span className="text-status-warning">{game.winCount}</span>
                            <span className="text-txt-muted">/</span>
                            <span className="text-brand-primary">{game.playCount}</span>
                          </span>
                          <span className="text-[11px] font-semibold text-txt-secondary flex items-center whitespace-nowrap">
                            {game.companions.length > 0
                              ? game.companions
                                .slice(0, MAX_VISIBLE_GAME_COMPANIONS)
                                .map(companion => companion.name)
                                .join('、')
                              : t('stats_no_companions')}
                            {game.companions.length > MAX_VISIBLE_GAME_COMPANIONS
                              ? ` +${game.companions.length - MAX_VISIBLE_GAME_COMPANIONS}`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-start min-w-[420px]">
                {overviewTab === 'games' ? (
                  <>
                    <div
                      className="spreadsheet-header-row"
                      style={{ gridTemplateColumns: 'minmax(0, min(150px, 25vw)) 48px max-content' }}
                    >
                      <h3 className="spreadsheet-cell-sticky-header spreadsheet-header-cell">
                        <Gamepad2 size={11} />
                        <span>{t('stats_header_game')}</span>
                      </h3>
                      <span className="spreadsheet-header-cell">
                        <Hash size={11} />
                        <span>{t('stats_header_plays')}</span>
                      </span>
                      <span className="spreadsheet-header-cell">
                        <Users size={11} />
                        <span>{t('stats_header_players_played')}</span>
                      </span>
                    </div>
                    {displayedGames.map(game => (
                      <div key={game.key} className="flex flex-col min-w-full w-max">
                      <div
                        onClick={() => handleGameSelect(game.key)}
                        className="spreadsheet-row cursor-pointer hover:bg-surface-hover"
                        style={{
                          gridTemplateColumns: 'minmax(0, min(150px, 25vw)) 48px max-content'
                        }}
                      >
                        <h3 className="spreadsheet-cell-sticky flex flex-col items-start justify-center px-3 text-sm font-black text-txt-primary overflow-x-auto no-scrollbar whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <span>{game.name}</span>
                          </span>
                        </h3>

                        <div className="flex items-center justify-start text-brand-primary font-mono font-black shrink-0">
                          <span>{game.playCount}</span>
                        </div>

                        <div className="flex items-center text-[11px] text-txt-secondary min-w-max whitespace-nowrap">
                          <span className="font-semibold whitespace-nowrap">
                            {game.players.length > 0
                              ? game.players.slice(0, MAX_VISIBLE_STATS_PLAYERS).map(player => player.name).join('、')
                              : t('stats_no_players')}
                            {game.players.length > MAX_VISIBLE_STATS_PLAYERS ? ` +${game.players.length - MAX_VISIBLE_STATS_PLAYERS}` : ''}
                          </span>
                        </div>
                      </div>
                      </div>
                    ))}

                    {hiddenGameCount > 0 && (
                      <div className="min-h-[40px] w-full flex items-center px-3 border-b border-surface-border/70 text-[11px] font-bold text-txt-muted bg-app-bg">
                        {t('stats_more_games_hidden').replace('{count}', hiddenGameCount.toString())}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className="spreadsheet-header-row"
                      style={{ gridTemplateColumns: 'minmax(0, min(130px, 25vw)) 48px max-content' }}
                    >
                      <h3 className="spreadsheet-cell-sticky-header spreadsheet-header-cell">
                        <Users size={11} />
                        <span>{t('stats_header_player')}</span>
                      </h3>
                      <span className="spreadsheet-header-cell">
                        <Hash size={11} />
                        <span>{t('stats_header_plays')}</span>
                      </span>
                      <span className="spreadsheet-header-cell">
                        <Gamepad2 size={11} />
                        <span>{t('stats_header_recent_games')}</span>
                      </span>
                    </div>
                    {displayedPlayers.map(player => (
                      <div
                        key={player.key}
                        onClick={() => handlePlayerSelect(player.key)}
                        className="spreadsheet-row cursor-pointer hover:bg-surface-hover"
                        style={{ gridTemplateColumns: 'minmax(0, min(130px, 25vw)) 48px max-content' }}
                      >
                        <h3 className="spreadsheet-cell-sticky px-3 text-sm font-black text-txt-primary overflow-x-auto no-scrollbar whitespace-nowrap flex items-center">
                          {player.name}
                        </h3>
                        <span className="text-xs font-black font-mono text-brand-primary flex items-center">{player.playCount}</span>
                        <span className="text-[11px] font-semibold text-txt-secondary flex items-center whitespace-nowrap">
                          {player.recentGames
                            .slice(0, MAX_VISIBLE_RECENT_GAMES)
                            .map(game => game.name)
                            .join('、')}
                          {player.recentGames.length > MAX_VISIBLE_RECENT_GAMES
                            ? ` +${player.recentGames.length - MAX_VISIBLE_RECENT_GAMES}`
                            : ''}
                        </span>
                      </div>
                    ))}
                    {hiddenPlayerCount > 0 && (
                      <div className="min-h-[40px] w-full flex items-center px-3 border-b border-surface-border/70 text-[11px] font-bold text-txt-muted bg-app-bg">
                        {t('stats_more_players_hidden').replace('{count}', hiddenPlayerCount.toString())}
                      </div>
                    )}
                  </>
                )}

                <div className="h-2 shrink-0"></div>
              </div>
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
