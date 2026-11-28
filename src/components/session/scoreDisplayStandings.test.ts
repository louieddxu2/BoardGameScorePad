import { describe, expect, it } from 'vitest';
import type { Player } from '../../types';
import { getScoreDisplayStandings } from './scoreDisplayStandings';

const player = (id: string, totalScore: number, flags: Partial<Player> = {}): Player =>
  ({ id, name: id, color: '', scores: {}, totalScore, ...flags });

describe('score display standings', () => {
  it('uses consecutive places after unresolved ties and preserves player order within a tie', () => {
    const players = [player('A', 12), player('B', 15), player('C', 12), player('D', 8), player('E', 15)];
    const standings = getScoreDisplayStandings(players);
    expect(standings.map(({ player, rank }) => [player.id, rank])).toEqual([
      ['B', 1], ['E', 1], ['A', 2], ['C', 2], ['D', 3],
    ]);
    expect(players.map(player => player.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('honors lowest score, manual tie breaking and forced losses', () => {
    const players = [
      player('A', 1), player('B', 1, { tieBreaker: true }), player('C', -5, { isForceLost: true }),
      player('D', 4), player('E', 4, { tieBreaker: true }),
    ];
    const standings = getScoreDisplayStandings(players, 'LOWEST_WINS');
    expect(standings.map(({ player, rank, forcedLoss }) => [player.id, rank, forcedLoss])).toEqual([
      ['B', 1, false], ['A', 2, false], ['E', 3, false], ['D', 4, false], ['C', null, true],
    ]);
  });

  it.each(['COOP', 'COOP_NO_SCORE', 'COMPETITIVE_NO_SCORE'] as const)('keeps seating order without ranks for %s', rule => {
    const players = [player('A', 1), player('B', 5)];
    expect(getScoreDisplayStandings(players, rule).map(({ player, rank }) => [player.id, rank])).toEqual([
      ['A', null], ['B', null],
    ]);
  });
});
