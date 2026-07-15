import { GameSession, ScoreValue } from '../../types';
import { MultiplayerHostRoomRuntime, MultiplayerPlayerRoomRuntime } from './multiplayerRoomRuntime';

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Converts participant UI updates into compact operations instead of whole-session writes. */
export const routeMultiplayerSessionUpdate = async (options: {
  previous: GameSession;
  next: GameSession;
  runtime: MultiplayerHostRoomRuntime | MultiplayerPlayerRoomRuntime;
  claimedPlayerIds?: string[];
}): Promise<GameSession | null> => {
  if (options.runtime.role === 'host') {
    const snapshot = await options.runtime.controller.applyLocalSession(options.next);
    return snapshot?.session ?? null;
  }

  const claimed = new Set(options.claimedPlayerIds ?? []);
  for (const nextPlayer of options.next.players) {
    if (!claimed.has(nextPlayer.id)) continue;
    const previousPlayer = options.previous.players.find((player) => player.id === nextPlayer.id);
    if (!previousPlayer) continue;
    const scoreKeys = new Set([...Object.keys(previousPlayer.scores), ...Object.keys(nextPlayer.scores)]);
    for (const colId of scoreKeys) {
      if (sameJson(previousPlayer.scores[colId], nextPlayer.scores[colId])) continue;
      await options.runtime.controller.queueScoreValuePatch({
        actor: { role: 'player', playerId: nextPlayer.id }, targetPlayerId: nextPlayer.id,
        colId, scoreValue: (nextPlayer.scores[colId] ?? null) as ScoreValue | null,
      });
    }
    if ((previousPlayer.bonusScore ?? 0) !== (nextPlayer.bonusScore ?? 0)) {
      const baseTotal = previousPlayer.totalScore - (previousPlayer.bonusScore ?? 0);
      await options.runtime.controller.queueTotalAdjustment({
        playerId: nextPlayer.id,
        targetTotal: baseTotal + (nextPlayer.bonusScore ?? 0),
      });
    }
  }
  return null;
};
