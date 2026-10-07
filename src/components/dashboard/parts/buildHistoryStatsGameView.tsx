import React, { type Dispatch, type SetStateAction } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users, Crown, Hash, Calculator, Trophy } from 'lucide-react';
import type { buildSpecificGameStats } from '../../../utils/historyStats';
import type { HistorySummary } from '../../../utils/extractDataSummaries';
import { ContrastText } from '../../shared/ContrastText';
import type { HistoryStatsDetailView, HistoryStatsTranslate } from '../historyStatsViewTypes';

interface HistoryStatsGameViewOptions {
  specificStats: NonNullable<ReturnType<typeof buildSpecificGameStats>>;
  detailView: Extract<HistoryStatsDetailView, { type: 'game' }>;
  setDetailView: Dispatch<SetStateAction<HistoryStatsDetailView | null>>;
  returnToOverview: () => void;
  handlePlayerSelect: (key: string) => void;
  playsText: string;
  language: string;
  onSelect?: (record: HistorySummary) => void;
  t: HistoryStatsTranslate;
}

/** Build the existing view without adding a component or history boundary. */
export function buildHistoryStatsGameView({
  specificStats, detailView, setDetailView, returnToOverview, handlePlayerSelect, playsText, language, onSelect, t
}: HistoryStatsGameViewOptions) {
  return (
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
  );
}
