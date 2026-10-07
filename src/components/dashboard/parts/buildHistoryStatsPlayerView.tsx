import type { Dispatch, SetStateAction } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users, Gamepad2, Hash } from 'lucide-react';
import type { buildSpecificPlayerStats } from '../../../utils/historyPlayerEntries';
import type { createHistoryPlayerResolver } from '../../../utils/historyGameEntries';
import type { HistorySummary } from '../../../utils/extractDataSummaries';
const MAX_VISIBLE_GAME_COMPANIONS = 10;
import type { HistoryStatsDetailView, HistoryStatsTranslate } from '../historyStatsViewTypes';

interface HistoryStatsPlayerViewOptions {
  specificPlayerStats: NonNullable<ReturnType<typeof buildSpecificPlayerStats>>;
  detailView: Extract<HistoryStatsDetailView, { type: 'player' }>;
  setDetailView: Dispatch<SetStateAction<HistoryStatsDetailView | null>>;
  returnToOverview: () => void;
  handleGameSelect: (key: string) => void;
  resolveHistoryPlayer: ReturnType<typeof createHistoryPlayerResolver>;
  language: string;
  onSelect?: (record: HistorySummary) => void;
  t: HistoryStatsTranslate;
}

/** Build the existing view without adding a component or history boundary. */
export function buildHistoryStatsPlayerView({
  specificPlayerStats, detailView, setDetailView, returnToOverview, handleGameSelect, resolveHistoryPlayer,
  language, onSelect, t
}: HistoryStatsPlayerViewOptions) {
  return (
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
  );
}
