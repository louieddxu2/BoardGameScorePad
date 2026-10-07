import { Users, Gamepad2, Hash } from 'lucide-react';
import type { HistoryStatsGame } from '../../../utils/historyStats';
import type { buildHistoryPlayerEntries } from '../../../utils/historyPlayerEntries';
const MAX_VISIBLE_STATS_PLAYERS = 10;
const MAX_VISIBLE_RECENT_GAMES = 10;
import type { HistoryStatsOverviewTab, HistoryStatsTranslate } from '../historyStatsViewTypes';

interface HistoryStatsOverviewViewOptions {
  overviewTab: HistoryStatsOverviewTab;
  displayedGames: HistoryStatsGame[];
  displayedPlayers: ReturnType<typeof buildHistoryPlayerEntries>;
  hiddenGameCount: number;
  hiddenPlayerCount: number;
  handleGameSelect: (key: string) => void;
  handlePlayerSelect: (key: string) => void;
  t: HistoryStatsTranslate;
}

/** Build the existing view without adding a component or history boundary. */
export function buildHistoryStatsOverviewView({
  overviewTab, displayedGames, displayedPlayers, hiddenGameCount, hiddenPlayerCount, handleGameSelect,
  handlePlayerSelect, t
}: HistoryStatsOverviewViewOptions) {
  return (
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
  );
}
