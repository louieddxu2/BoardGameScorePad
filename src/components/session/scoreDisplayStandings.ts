import type { Player, ScoringRule } from '../../types';

export function getScoreDisplayStandings(players: Player[], scoringRule: ScoringRule = 'HIGHEST_WINS') {
  if (scoringRule !== 'HIGHEST_WINS' && scoringRule !== 'LOWEST_WINS') {
    return players.map(player => ({ player, rank: null, forcedLoss: false }));
  }

  const scoreDirection = scoringRule === 'LOWEST_WINS' ? 1 : -1;
  const compare = (a: Player, b: Player) =>
    Number(!!a.isForceLost) - Number(!!b.isForceLost)
    || scoreDirection * (a.totalScore - b.totalScore)
    || Number(!!b.tieBreaker) - Number(!!a.tieBreaker);

  const sorted = [...players].sort(compare);
  let rank = 0;
  return sorted.map((player, index) => {
    if (player.isForceLost) return { player, rank: null, forcedLoss: true };
    if (index === 0 || compare(player, sorted[index - 1]) !== 0) rank++;
    return { player, rank, forcedLoss: false };
  });
}
