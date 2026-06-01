import React, { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ChevronDown, ChevronUp, Grid3X3, Hash, MapPin, Minus, Search, Users, Plus } from 'lucide-react';
import { HistorySummary } from '../../utils/extractDataSummaries';
import { buildHistoryStats } from '../../utils/historyStats';
import HistoryPhotoGridShareModal from './HistoryPhotoGridShareModal';
import { useHistoryStatsTranslation } from '../../i18n/history_stats';

interface HistoryStatsPanelProps {
  records: HistorySummary[];
  onSearchClick: () => void;
  isSearchActive: boolean;
}

const BOTTOM_ROW_HEIGHT_CLASS = 'h-[60px]';
const RIGHT_PANEL_WIDTH = 'w-[118px] sm:w-[140px]';

const formatDate = (timestamp: number | undefined, emptyLabel: string) => {
  if (!timestamp) return emptyLabel;
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const HistoryStatsPanel: React.FC<HistoryStatsPanelProps> = ({ records, onSearchClick, isSearchActive }) => {
  const { t } = useHistoryStatsTranslation();
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [showPhotoGrid, setShowPhotoGrid] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const stats = useMemo(() => buildHistoryStats(records), [records]);
  const panelLayoutClass = isSearchActive
    ? 'bottom-0 left-0 right-0 h-[220px]'
    : (isExpanded ? 'inset-0 top-[56px]' : 'bottom-0 left-0 right-0 h-[45dvh]');

  return (
    <>
      <div
        className={`fixed z-40 flex flex-row items-end pointer-events-none transition-all duration-300 ease-in-out ${panelLayoutClass}`}
      >
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
              <div className="flex flex-col justify-start min-w-[520px]">
                {stats.games.map(game => (
                  <div key={game.key} className="min-h-[46px] grid grid-cols-[168px_72px_minmax(260px,1fr)] items-center gap-2 pr-3 py-1.5 border-b border-surface-border/70 bg-app-bg hover:bg-surface-hover transition-colors">
                    <h3 className="sticky left-0 z-10 bg-app-bg px-3 text-sm font-black text-txt-primary truncate">{game.name}</h3>
                    <div className="flex items-center justify-end gap-1 text-brand-primary font-mono font-black shrink-0">
                        <Hash size={13} />
                        <span>{game.playCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-txt-muted overflow-hidden min-w-0">
                      <Users size={12} className="shrink-0" />
                      <span className="truncate">
                        {game.players.length > 0
                          ? game.players.slice(0, 6).map(player => player.name).join('、')
                          : t('stats_no_players')}
                        {game.players.length > 6 ? ` +${game.players.length - 6}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="h-2 shrink-0"></div>
              </div>
            )}
          </div>
        </div>

        <div className={`${RIGHT_PANEL_WIDTH} flex flex-col bg-app-bg-deep shrink-0 relative z-50 pointer-events-auto rounded-t-2xl shadow-ui-floating border-t border-l border-surface-border ml-[-1px] transition-all duration-300 ${isExpanded && !isSearchActive ? 'h-full' : ''}`}>
          <div className={`flex flex-col p-2 gap-1.5 pb-2 min-h-[160px] ${isExpanded && !isSearchActive ? 'flex-1' : ''}`}>
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className={`flex items-center justify-center gap-2 w-full transition-all active:scale-95 shrink-0 mb-1 rounded-lg border shadow-ui-floating z-10 h-9 ${
                isExpanded && !isSearchActive
                  ? 'bg-app-bg-deep text-brand-primary border-brand-primary'
                  : 'bg-app-bg-deep text-txt-muted border-surface-border hover:border-txt-muted'
              }`}
            >
              {isExpanded && !isSearchActive ? <ChevronDown size={18} /> : <ChevronUp size={20} />}
              {(!isExpanded || isSearchActive) && <span className="text-[11px] font-black uppercase tracking-widest truncate">{t('stats_expand')}</span>}
            </button>

            <div className="relative w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center gap-2">
              <CalendarDays size={14} className="text-txt-muted shrink-0" />
              <span className="text-sm font-bold text-txt-primary truncate">{t('stats_all_time')}</span>
            </div>

            <button className="w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center justify-between text-txt-primary hover:border-txt-secondary transition-colors">
              <span className="text-sm font-bold truncate">{t('stats_all_rules')}</span>
              <ChevronUp size={14} className="text-txt-muted shrink-0" />
            </button>

            <button className="w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center justify-between text-txt-primary hover:border-txt-secondary transition-colors">
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin size={13} className="text-txt-muted shrink-0" />
                <span className="text-sm truncate">{t('stats_all_locations')}</span>
              </span>
              <ChevronUp size={14} className="text-txt-muted shrink-0" />
            </button>

            <div className="shrink-0 flex flex-col justify-center items-center py-1">
              <div className="flex items-center justify-between w-full bg-app-bg rounded-xl p-1.5 border border-surface-border relative overflow-hidden transition-all duration-300">
                <button
                  onClick={() => setPlayerCount(prev => prev === null || prev <= 1 ? null : prev - 1)}
                  className="w-9 h-9 flex items-center justify-center bg-surface-bg text-txt-muted rounded-lg active:scale-95 transition-transform hover:bg-surface-bg-alt relative z-10 shrink-0"
                >
                  <Minus size={16} />
                </button>

                <div className="flex-1 relative h-9 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <Users size={24} className="transition-colors text-txt-muted opacity-30" />
                  </div>
                  <span className={`text-lg font-black font-mono relative z-10 drop-shadow-md transition-colors ${playerCount ? 'text-brand-primary' : 'text-txt-muted'}`}>
                    {playerCount || '-'}
                  </span>
                </div>

                <button
                  onClick={() => setPlayerCount(prev => Math.min(20, (prev || 0) + 1))}
                  className="w-9 h-9 flex items-center justify-center bg-brand-primary/10 text-brand-primary rounded-lg active:scale-95 transition-transform border border-brand-primary/20 hover:bg-brand-primary/20 relative z-10 shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-surface-border z-10 bg-app-bg-deep`}>
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

      <HistoryPhotoGridShareModal
        isOpen={showPhotoGrid}
        records={records}
        onClose={() => setShowPhotoGrid(false)}
      />
    </>
  );
};

export default HistoryStatsPanel;
