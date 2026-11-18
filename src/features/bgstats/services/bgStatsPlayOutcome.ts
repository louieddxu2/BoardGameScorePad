import type { Player, ScoringRule } from '../../../types';
import { calculateWinners } from '../../../utils/templateUtils';
import type { BgStatsGame } from '../types';

/**
 * BG Stats `noPoints` only means the game records no points; its plays still have winners.
 * ScorePad's no win/loss modes travel as ignored plays, which BG Stats leaves out of its stats.
 */
export const scoringRuleFromBgStats = (game: BgStatsGame, ignored: boolean): ScoringRule => {
    if (game.cooperative) return ignored ? 'COOP_NO_SCORE' : 'COOP';
    if (ignored) return 'COMPETITIVE_NO_SCORE';
    return game.highestWins ? 'HIGHEST_WINS' : 'LOWEST_WINS';
};

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));

/**
 * Marks tie-breakers and forced losses so that recalculating the winners (as saving a
 * history record does) reproduces the winners chosen in BG Stats. Outcomes those markers
 * cannot express, such as winners with different scores, are returned unchanged.
 */
export const withImportedOutcome = (players: Player[], winnerIds: string[], rule: ScoringRule): Player[] => {
    if (rule === 'COMPETITIVE_NO_SCORE' || rule === 'COOP_NO_SCORE') return players;
    if (sameIds(calculateWinners(players, rule), winnerIds)) return players;

    const isWinner = (player: Player) => winnerIds.includes(player.id);
    let marked: Player[];
    if (!winnerIds.length) {
        marked = players.map(player => ({ ...player, isForceLost: true }));
    } else if (rule === 'COOP') {
        return players;
    } else {
        const winnerTotals = new Set(players.filter(isWinner).map(player => player.totalScore));
        if (winnerTotals.size !== 1) return players;
        const [target] = winnerTotals;
        const beatsWinners = (total: number) => rule === 'LOWEST_WINS' ? total < target : total > target;
        const hasTiedLoser = players.some(player => !isWinner(player) && player.totalScore === target);
        marked = players.map(player => {
            if (isWinner(player)) return hasTiedLoser ? { ...player, tieBreaker: true } : player;
            return beatsWinners(player.totalScore) ? { ...player, isForceLost: true } : player;
        });
    }
    return sameIds(calculateWinners(marked, rule), winnerIds) ? marked : players;
};
