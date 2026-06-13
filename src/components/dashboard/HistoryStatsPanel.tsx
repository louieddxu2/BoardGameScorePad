import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, ChevronLeft, Grid3X3, Hash, MapPin, Minus, Search, Users, Plus, CornerUpLeft, Award } from 'lucide-react';
import { HistoryGameEntry, buildHistoryGameEntries } from '../../utils/historyGameEntries';
import { buildHistoryStats, filterHistoryEntriesByDateRange, filterHistoryEntriesByStatsFilters, getNextHistoryStatsDateRange, HistoryStatsDateRange, HistoryStatsGame, buildSpecificGameStats } from '../../utils/historyStats';
import HistoryPhotoGridShareModal from './HistoryPhotoGridShareModal';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';
import { ScoringRule, SavedListItem } from '../../types';
import { HistorySummary } from '../../utils/extractDataSummaries';
import UpwardSelectMenu, { UpwardSelectMenuAnchor } from '../shared/UpwardSelectMenu';
import { DATA_LIMITS } from '../../dataLimits';

interface HistoryStatsPanelProps {
  entries: HistoryGameEntry[];
  records?: HistorySummary[];
  savedPlayers?: Pick<SavedListItem, 'id' | 'name'>[];
  onSearchClick: () => void;
  isSearchKeyboardOpen?: boolean;
}

const BOTTOM_ROW_HEIGHT_CLASS = 'h-[60px]';
const ACTION_ROW_WIDTH_CLASS = 'w-[118px] sm:w-[140px]';
const MAX_VISIBLE_STATS_PLAYERS = 10;
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
  isSearchKeyboardOpen = false
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
  const [selectedGameKey, setSelectedGameKey] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const listScrollPosRef = useRef({ top: 0, left: 0 });

  const handleGameSelect = (gameKey: string) => {
    if (scrollContainerRef.current) {
      listScrollPosRef.current = {
        top: scrollContainerRef.current.scrollTop,
        left: scrollContainerRef.current.scrollLeft
      };
    }
    setSelectedGameKey(gameKey);
  };

  React.useEffect(() => {
    if (!selectedGameKey && scrollContainerRef.current) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = listScrollPosRef.current.top;
          scrollContainerRef.current.scrollLeft = listScrollPosRef.current.left;
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedGameKey]);

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

  const specificStats = useMemo(() => {
    if (!selectedGameKey || !records) return null;
    return buildSpecificGameStats(selectedGameKey, records, { savedPlayers });
  }, [selectedGameKey, records, savedPlayers]);

  const displayedGames = useMemo(() => {
    return stats.games.slice(0, DATA_LIMITS.QUERY.HISTORY_STATS_GAMES);
  }, [stats.games]);
  const hiddenGameCount = Math.max(0, stats.games.length - displayedGames.length);
  const isPanelExpanded = isExpanded && !isSearchKeyboardOpen;
  const panelLayoutClass = isSearchKeyboardOpen
    ? 'bottom-0 left-0 right-0 h-[220px]'
    : (isExpanded ? 'inset-0 top-[56px]' : 'bottom-0 left-0 right-0 h-[45dvh]');
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
  const photoGridContextLabel = [
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

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-app-bg border-t border-surface-border shadow-ui-floating pointer-events-auto relative transition-all duration-300 h-full">
          <div className="absolute top-0 left-0 right-0 p-1 text-center pointer-events-none z-10 opacity-30">
            <ChevronUp size={12} className="text-txt-muted mx-auto" />
          </div>

          {!selectedGameKey && (
            <div className="flex-none h-8 px-3 border-b border-surface-border bg-app-bg flex items-center gap-3 overflow-x-auto no-scrollbar text-[11px] font-bold text-txt-muted whitespace-nowrap">
              <span><span className="text-txt-primary font-mono">{stats.playCount}</span> {t('stats_count_label')}</span>
              <span><span className="text-txt-primary font-mono">{stats.gameCount}</span> {t('stats_games_label')}</span>
              <span><span className="text-txt-primary font-mono">{stats.playerCount}</span> {t('stats_players_label')}</span>
              <span>{t('stats_latest_label')} <span className="text-txt-primary">{formatDate(stats.latestPlayedAt, t('stats_empty_date'))}</span></span>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto no-scrollbar pb-2" ref={scrollContainerRef}>
            {stats.games.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-txt-muted opacity-70 gap-2">
                <BarChart3 size={32} />
                <span className="text-sm font-bold">{t('stats_empty_records')}</span>
              </div>
            ) : selectedGameKey && specificStats ? (
              <div className="flex flex-col w-full h-full min-h-0">
                {/* 遊戲名稱與返回列：使用 3 欄 Grid 排版，補齊並靠右對齊原本的所有統計資訊 */}
                <div 
                  onClick={() => setSelectedGameKey(null)}
                  className="grid items-center gap-2 pr-3 py-1.5 min-h-[46px] border-b border-surface-border/70 bg-app-bg hover:bg-surface-hover transition-colors cursor-pointer w-full shrink-0"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr) max-content max-content' }}
                >
                  {/* 第一欄：返回箭頭 + 遊戲名稱 + 最近遊玩與最佳分數 */}
                  <div className="flex items-center gap-1.5 min-w-0 pl-3">
                    <ChevronLeft size={18} className="text-brand-primary shrink-0 -ml-1" />
                    <div className="flex flex-col items-start min-w-0 justify-center">
                      <span className="text-sm font-black text-txt-primary truncate w-full">{specificStats.gameName}</span>
                      <span className="text-[9px] text-txt-muted font-normal mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar max-w-[140px] sm:max-w-xs block">
                        {specificStats.latestPlayedAt && (
                          <span>
                            {t('stats_latest_play_short').replace('{date}', new Date(specificStats.latestPlayedAt).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }))}
                          </span>
                        )}
                        {specificStats.bestScore !== undefined && specificStats.bestScore !== 0 && specificStats.bestScorePlayerName && (
                          <span className="text-brand-secondary font-semibold">
                            {specificStats.latestPlayedAt && <span className="mx-1">·</span>}
                            {t('stats_best_score_short')
                              .replace('{score}', specificStats.bestScore.toString())
                              .replace('{suffix}', t('stats_score_suffix'))
                              .replace('{player}', specificStats.bestScorePlayerName)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 第二欄：局數統計資訊（scored + unscored / coop / 競爭局數） */}
                  <div className="flex items-center justify-end text-txt-secondary font-bold text-[11px] shrink-0 px-2.5 whitespace-nowrap">
                    {specificStats.noScorePlayCount > 0 ? (
                      specificStats.coopPlayCount > 0 && specificStats.competitivePlayCount > 0
                        ? t('stats_plays_mixed_no_score')
                            .replace('{scored}', (specificStats.playCount - specificStats.noScorePlayCount).toString())
                            .replace('{noScore}', specificStats.noScorePlayCount.toString())
                        : specificStats.coopPlayCount > 0
                          ? t('stats_plays_coop_no_score')
                              .replace('{scored}', (specificStats.playCount - specificStats.noScorePlayCount).toString())
                              .replace('{noScore}', specificStats.noScorePlayCount.toString())
                          : t('stats_plays_comp_no_score')
                              .replace('{scored}', (specificStats.playCount - specificStats.noScorePlayCount).toString())
                              .replace('{noScore}', specificStats.noScorePlayCount.toString())
                    ) : (
                      specificStats.coopPlayCount > 0 && specificStats.competitivePlayCount > 0
                        ? t('stats_plays_mixed')
                            .replace('{count}', specificStats.playCount.toString())
                            .replace('{comp}', specificStats.competitivePlayCount.toString())
                            .replace('{coop}', specificStats.coopPlayCount.toString())
                        : specificStats.coopPlayCount > 0
                          ? t('stats_plays_coop_only').replace('{count}', specificStats.playCount.toString())
                          : t('stats_plays_comp_only').replace('{count}', specificStats.playCount.toString())
                    )}
                  </div>

                  {/* 第三欄：勝率/成功率排行標題 */}
                  <div className="flex items-center gap-1 text-[11px] font-black text-brand-primary min-w-max whitespace-nowrap pr-3 justify-end">
                    <Award size={12} className="shrink-0 text-brand-primary" />
                    <span>
                      {specificStats.coopPlayCount > 0 && specificStats.competitivePlayCount > 0
                        ? t('stats_overall_win_rate_rank')
                        : specificStats.coopPlayCount > 0
                          ? t('stats_success_rate_rank')
                          : t('stats_win_rate_rank')}
                    </span>
                  </div>
                </div>

                {/* 玩家勝率列表：高度直接推滿 (flex-1) */}
                <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar bg-app-bg-deep w-full pb-8">
                  {specificStats.players.length > 0 ? (
                    <div className="pl-3 w-max min-w-full">
                      {specificStats.players.map((player) => {
                        return (
                          <div
                            key={player.key}
                            className="spreadsheet-row border-b-0 hover:bg-transparent"
                            style={{ gridTemplateColumns: 'minmax(0, min(110px, 22vw)) 52px 1fr' }}
                          >
                            <span className="spreadsheet-cell-sticky text-sm font-black text-txt-primary truncate">
                              {player.name}
                            </span>
                            <div className="flex items-center justify-start gap-0.5 text-txt-secondary font-mono font-black shrink-0 text-[11px]">
                              {player.noScorePlayCount > 0 ? (
                                <>
                                  <span>{player.playCount - player.noScorePlayCount}</span>
                                  <span className="text-brand-secondary font-bold">+{player.noScorePlayCount}</span>
                                  <span className="text-[10px] font-normal text-txt-muted ml-0.5">{t('stats_plays_suffix')}</span>
                                </>
                              ) : (
                                <>
                                  <span>{player.playCount}</span>
                                  <span className="text-[10px] font-normal text-txt-muted ml-0.5">{t('stats_plays_suffix')}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pr-3 min-w-max">
                              {player.hasScoringPlay ? (
                                <>
                                  <div className="w-[80px] sm:w-[100px] h-1.5 bg-surface-bg rounded-full overflow-hidden shrink-0">
                                    <div 
                                      className="bg-brand-primary h-full rounded-full" 
                                      style={{ width: `${player.winRate}%` }} 
                                    />
                                  </div>
                                  <span className="text-xs font-black text-brand-primary font-mono w-[36px] text-right">
                                    {player.winRate}%
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-black text-txt-muted font-mono w-[124px] sm:w-[144px] text-right pr-3">
                                  -
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
              </div>
            ) : (
              // 渲染原有的多遊戲統計列表
              <div className="flex flex-col justify-start min-w-[420px]">
                {displayedGames.map(game => {
                  return (
                    <div key={game.key} className="flex flex-col min-w-full w-max">
                      <div
                        onClick={() => handleGameSelect(game.key)}
                        className="spreadsheet-row cursor-pointer"
                        style={{
                          gridTemplateColumns: 'minmax(0, min(150px, 25vw)) 48px max-content'
                        }}
                      >
                        <h3 className="spreadsheet-cell-sticky flex flex-col items-start justify-center px-3 text-sm font-black text-txt-primary overflow-x-auto no-scrollbar whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <span>{game.name}</span>
                          </span>
                        </h3>

                        <div className="flex items-center justify-start gap-1 text-brand-primary font-mono font-black shrink-0">
                          <Hash size={13} />
                          <span>{game.playCount}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-txt-secondary min-w-max whitespace-nowrap">
                          <Users size={12} className="shrink-0 text-brand-secondary" />
                          <span className="font-semibold whitespace-nowrap">
                            {game.players.length > 0
                              ? game.players.slice(0, MAX_VISIBLE_STATS_PLAYERS).map(player => player.name).join('、')
                              : t('stats_no_players')}
                            {game.players.length > MAX_VISIBLE_STATS_PLAYERS ? ` +${game.players.length - MAX_VISIBLE_STATS_PLAYERS}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {hiddenGameCount > 0 && (
                  <div className="min-h-[40px] w-full flex items-center px-3 border-b border-surface-border/70 text-[11px] font-bold text-txt-muted bg-app-bg">
                    {t('stats_more_games_hidden').replace('{count}', hiddenGameCount.toString())}
                  </div>
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
            {/* 未來如需啟用搜尋聯動，請將下方放大鏡按鈕註解解除：
            <button
              onClick={onSearchClick}
              className="w-[50px] h-full flex items-center justify-center bg-app-bg hover:bg-surface-bg text-brand-primary transition-colors active:brightness-90 border-r border-surface-border"
              title={t('stats_search_history')}
            >
              <Search size={22} strokeWidth={2.5} />
            </button>
            */}

            <button
              onClick={() => setShowPhotoGrid(true)}
              className="w-full h-full flex flex-col items-center justify-center transition-all active:brightness-90 bg-brand-primary hover:filter hover:brightness-110 text-white"
              title={t('stats_photo_grid_title')}
            >
              <Grid3X3 size={26} />
            </button>
            </div>
          </div>
        </div>
      </div>

      <HistoryPhotoGridShareModal
        isOpen={showPhotoGrid}
        entries={filteredEntries}
        contextLabel={photoGridContextLabel}
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
        />
      )}
    </>
  );
};

export default HistoryStatsPanel;
