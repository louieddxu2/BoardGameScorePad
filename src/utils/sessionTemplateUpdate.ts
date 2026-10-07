import type { GameSession, GameTemplate } from '../types';
import { recalculateScoreSession } from './sessionScoring';

/** Finish every input migration before deriving cross-player totals and winners. */
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

    const migrationEntries = Object.entries(migrations);
    const migratedPlayers = migrationEntries.length === 0 ? session.players : session.players.map(player => {
        const processedScores = { ...player.scores };
        let hasChanges = false;

        migrationEntries.forEach(([colId, config]) => {
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

        return hasChanges ? { ...player, scores: processedScores } : player;
    });

    // All players must use the same fully migrated scoring context.
    return recalculateScoreSession({
        ...session,
        templateId: finalTemplate.id,
        name: finalTemplate.name,
        bggId: finalTemplate.bggId,
        players: migratedPlayers
    }, finalTemplate);
}
