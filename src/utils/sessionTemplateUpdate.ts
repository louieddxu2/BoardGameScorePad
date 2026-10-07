import type { GameSession, GameTemplate } from '../types';
import { calculatePlayerTotal } from './scoring';
import { calculateWinners } from './templateUtils';

/** Migrate input values and recalculate using the existing session's scoring context. */
export function applyTemplateToSession(
    session: GameSession,
    oldTemplate: GameTemplate | null,
    finalTemplate: GameTemplate
): GameSession {
    // [Migration Logic] Detect Column Attribute Changes (e.g. isMultiSelect Toggle)
    const migrations: Record<string, { toMulti: boolean }> = {};
    if (oldTemplate) {
        finalTemplate.columns.forEach(newCol => {
            const oldCol = oldTemplate.columns.find(c => c.id === newCol.id);
            if (oldCol && !!newCol.isMultiSelect !== !!oldCol.isMultiSelect) {
                migrations[newCol.id] = { toMulti: !!newCol.isMultiSelect };
            }
        });
    }

    const updatedPlayers = session.players.map(player => {
        const processedScores = { ...player.scores };
        let hasChanges = false;

        Object.entries(migrations).forEach(([colId, config]) => {
            const score = processedScores[colId];
            if (!score) return;

            const newScore = { ...score };
            if (config.toMulti) {
                const currentMulti = newScore.multiOptionIds || [];
                if (currentMulti.length === 0 && newScore.optionId) {
                    newScore.multiOptionIds = [newScore.optionId];
                    hasChanges = true;
                }
            } else {
                const currentMulti = newScore.multiOptionIds || [];
                if (!newScore.optionId && currentMulti.length > 0) {
                    newScore.optionId = currentMulti[0];
                    hasChanges = true;
                }
            }
            if (hasChanges) processedScores[colId] = newScore;
        });

        const playerWithMigratedScores = hasChanges ? { ...player, scores: processedScores } : player;

        return {
            ...playerWithMigratedScores,
            totalScore: calculatePlayerTotal(playerWithMigratedScores, finalTemplate, session.players)
        };
    });

    const winnerIds = calculateWinners(updatedPlayers, session.scoringRule);

    return {
        ...session,
        templateId: finalTemplate.id,
        name: finalTemplate.name,
        bggId: finalTemplate.bggId,
        players: updatedPlayers,
        winnerIds: winnerIds,
        lastUpdatedAt: Date.now()
    };
}
