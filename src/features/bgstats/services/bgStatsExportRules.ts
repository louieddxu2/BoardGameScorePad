import type { HistoryRecord, ScoringRule } from '../../../types';
import { getRecordScoringRule } from '../../../utils/historyUtils';

/** Rules under which a play records no points; BG Stats leaves those scores blank. */
export const isNoPointsRule = (rule: ScoringRule): boolean =>
    rule === 'COMPETITIVE_NO_SCORE' || rule === 'COOP_NO_SCORE';

export const isRecordWinner = (record: HistoryRecord, player: HistoryRecord['players'][number]): boolean =>
    record.winnerIds.includes(player.id) || (!!player.linkedPlayerId && record.winnerIds.includes(player.linkedPlayerId));

/**
 * Ranks as BG Stats assigns them: winners first, then by score in the game's direction
 * (no-points plays compare winners only), with tied players sharing a rank and the next
 * rank skipped (1, 1, 3).
 */
export const computeBgStatsRanks = (record: HistoryRecord): number[] => {
    const rule = getRecordScoringRule(record);
    const sign = rule === 'LOWEST_WINS' ? -1 : 1;
    const keys = record.players.map(player => [
        isRecordWinner(record, player) ? 1 : 0,
        isNoPointsRule(rule) ? 0 : sign * player.totalScore,
    ]);
    const beats = (a: number[], b: number[]) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
    return keys.map(key => 1 + keys.filter(other => beats(other, key)).length);
};

/**
 * BG Stats marks winners as manual when they were chosen by hand rather than read from the
 * scores. Only the outcome is known here, so any outcome the scores cannot decide counts as
 * manual: a tie broken by a tie-breaker, a player forced to lose, a winner when every score
 * is 0, nobody winning despite recorded scores, or any winner of a cooperative or no-points
 * play. Automatic: winners exactly the best scores, or no winner and no scores.
 */
export const isManualWinner = (record: HistoryRecord): boolean => {
    const winners = record.players.map(player => isRecordWinner(record, player));
    const rule = getRecordScoringRule(record);
    const totals = record.players.map(player => player.totalScore);
    const hasScores = !isNoPointsRule(rule) && totals.some(total => total !== 0);
    if (!winners.some(Boolean)) return hasScores;
    if (!hasScores || rule === 'COOP') return true;
    const best = rule === 'LOWEST_WINS' ? Math.min(...totals) : Math.max(...totals);
    return totals.some((total, i) => (total === best) !== winners[i]);
};

/**
 * `${record.id}|${linkedPlayerId}` for each linked player's earliest play of each game,
 * which BG Stats marks as `newPlayer`. Unlinked players have no identity to follow.
 */
export const findFirstPlays = (records: HistoryRecord[], gameKeyOf: (record: HistoryRecord) => string): Set<string> => {
    const seen = new Set<string>();
    const firstPlays = new Set<string>();
    for (const record of [...records].sort((a, b) => a.startTime - b.startTime)) {
        const gameKey = gameKeyOf(record);
        for (const player of record.players) {
            if (!player.linkedPlayerId) continue;
            const key = `${player.linkedPlayerId}|${gameKey}`;
            if (seen.has(key)) continue;
            seen.add(key);
            firstPlays.add(`${record.id}|${player.linkedPlayerId}`);
        }
    }
    return firstPlays;
};
