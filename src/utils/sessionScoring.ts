import type { GameSession, GameTemplate } from '../types';
import { calculatePlayerTotal } from './scoring';
import { calculateWinners } from './templateUtils';

/** Pure derivation: receiving or restoring a board must not invent an edit timestamp. */
export const calculateScoreSession = (
  session: GameSession,
  template: GameTemplate,
  previouslyCalculated?: GameSession,
): GameSession => {
  // Callers may reuse results only while the scoring template is unchanged.
  // Host totals/winners are deliberately excluded from this comparison.
  const sameInputs = previouslyCalculated &&
    session.scoringRule === previouslyCalculated.scoringRule &&
    session.players.length === previouslyCalculated.players.length &&
    session.players.every((player, index) => {
      const previous = previouslyCalculated.players[index];
      return player.id === previous.id &&
        (player.bonusScore ?? 0) === (previous.bonusScore ?? 0) &&
        Boolean(player.tieBreaker) === Boolean(previous.tieBreaker) &&
        Boolean(player.isForceLost) === Boolean(previous.isForceLost) &&
        (player.scores === previous.scores || JSON.stringify(player.scores) === JSON.stringify(previous.scores));
    });
  if (sameInputs) {
    return {
      ...session,
      players: session.players.map((player, index) => ({ ...player, totalScore: previouslyCalculated.players[index].totalScore })),
      winnerIds: previouslyCalculated.winnerIds,
    };
  }
  const playersWithTotals = session.players.map((player) => ({
    ...player,
    totalScore: calculatePlayerTotal(player, template, session.players),
  }));

  return {
    ...session,
    players: playersWithTotals,
    winnerIds: calculateWinners(playersWithTotals, session.scoringRule),
  };
};

export const recalculateScoreSession = (session: GameSession, template: GameTemplate): GameSession => ({
  ...calculateScoreSession(session, template), lastUpdatedAt: Date.now(),
});
