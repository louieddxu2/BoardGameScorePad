import React, { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, Grid3X3, Hash, MapPin, Minus, Search, Users, Plus } from 'lucide-react';
import { HistoryGameEntry } from '../../utils/historyGameEntries';
import { buildHistoryStats, filterHistoryEntriesByDateRange, getNextHistoryStatsDateRange, HistoryStatsDateRange } from '../../utils/historyStats';
import HistoryPhotoGridShareModal from './HistoryPhotoGridShareModal';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';

interface HistoryStatsPanelProps {
  entries: HistoryGameEntry[];
  onSearchClick: () => void;
  isSearchKeyboardOpen?: boolean;
}

const BOTTOM_ROW_HEIGHT_CLASS = 'h-[60px]';
const ACTION_ROW_WIDTH_CLASS = 'w-[118px] sm:w-[140px]';
const MAX_VISIBLE_STATS_PLAYERS = 10;
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

const HistoryStatsPanel: React.FC<HistoryStatsPanelProps> = ({ entries, onSearchClick, isSearchKeyboardOpen = false }) => {
  const { t } = useHistoryStatsTranslation();
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [showPhotoGrid, setShowPhotoGrid] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateRange, setDateRange] = useState<HistoryStatsDateRange>('all');
  const filteredEntries = useMemo(() => filterHistoryEntriesByDateRange(entries, dateRange), [entries, dateRange]);
  const stats = useMemo(() => buildHistoryStats(filteredEntries), [filteredEntries]);
  const isPanelExpanded = isExpanded && !isSearchKeyboardOpen;
  const panelLayoutClass = isSearchKeyboardOpen
    ? 'bottom-0 left-0 right-0 h-[220px]'
    : (isExpanded ? 'inset-0 top-[56px]' : 'bottom-0 left-0 right-0 h-[45dvh]');
  const dateRangeLabel = t(DATE_RANGE_LABEL_KEYS[dateRange]);

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

          <div className="flex-none h-8 px-3 border-b border-surface-border bg-app-bg flex items-center gap-3 overflow-x-auto no-scrollbar text-[11px] font-bold text-txt-muted whitespace-nowrap">
            <span><span className="text-txt-primary font-mono">{stats.playCount}</span> {t('stats_count_label')}</span>
            <span><span className="text-txt-primary font-mono">{stats.gameCount}</span> {t('stats_games_label')}</span>
            <span><span className="text-txt-primary font-mono">{stats.playerCount}</span> {t('stats_players_label')}</span>
            <span>{t('stats_latest_label')} <span className="text-txt-primary">{formatDate(stats.latestPlayedAt, t('stats_empty_date'))}</span></span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto no-scrollbar pb-2">
            {stats.games.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-txt-muted opacity-70 gap-2">
                <BarChart3 size={32} />
                <span className="text-sm font-bold">{t('stats_empty_records')}</span>
              </div>
            ) : (
              <div className="flex flex-col justify-start min-w-[420px]">
                {stats.games.map(game => (
                  <div
                    key={game.key}
                    className="min-h-[46px] w-max min-w-full grid items-center gap-2 pr-3 py-1.5 border-b border-surface-border/70 bg-app-bg hover:bg-surface-hover transition-colors"
                    style={{ gridTemplateColumns: 'minmax(0, min(150px, 25vw)) 48px max-content' }}
                  >
                    <h3 className="sticky left-0 z-10 bg-app-bg px-3 text-sm font-black text-txt-primary overflow-x-auto no-scrollbar whitespace-nowrap">{game.name}</h3>
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
                ))}
                <div className="h-2 shrink-0"></div>
              </div>
            )}
          </div>

          <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-surface-border z-10 bg-app-bg-deep`}>
            <div className={`min-w-0 flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 px-2 pr-[126px] sm:pr-[148px] pointer-events-auto`}>
              <button className="h-10 shrink-0 bg-app-bg border border-surface-border rounded-lg px-2.5 flex items-center gap-1 text-txt-primary hover:border-txt-secondary transition-colors">
                <span className="text-sm font-bold whitespace-nowrap">{t('stats_rules_short')}</span>
                <ChevronUp size={14} className="text-txt-muted shrink-0" />
              </button>

              <button className="h-10 shrink-0 bg-app-bg border border-surface-border rounded-lg px-2.5 flex items-center gap-1 text-txt-primary hover:border-txt-secondary transition-colors">
                <MapPin size={13} className="text-txt-muted shrink-0" />
                <span className="text-sm font-bold whitespace-nowrap">{t('stats_locations_short')}</span>
                <ChevronUp size={14} className="text-txt-muted shrink-0" />
              </button>

              <div className="h-10 w-[104px] shrink-0 flex items-center justify-between bg-app-bg rounded-xl p-1 border border-surface-border relative overflow-hidden transition-all duration-300">
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

              <button
                onClick={() => setDateRange(prev => getNextHistoryStatsDateRange(prev))}
                className="h-10 shrink-0 bg-app-bg border border-surface-border rounded-lg px-2.5 flex items-center gap-1.5 text-txt-primary hover:border-txt-secondary transition-colors"
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
              className="w-[90px] h-full flex flex-col items-center justify-center transition-all active:brightness-90 bg-brand-primary hover:filter hover:brightness-110 text-white"
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
        onClose={() => setShowPhotoGrid(false)}
      />
    </>
  );
};

export default HistoryStatsPanel;
