import type { GameSession, GameTemplate } from '../types';
import { recalculateScoreSession } from './sessionScoring';

/** Prepare a reusable raw-input migration; totals and winners remain untouched. */
export function createTemplateSelectionMigration(
    oldTemplate: GameTemplate | null,
    finalTemplate: GameTemplate
): (session: GameSession) => GameSession {
    const migrations: Array<{ colId: string; toMulti: boolean }> = [];
    if (oldTemplate) {
        const oldColumns = new Map(oldTemplate.columns.map(col => [col.id, col]));
        finalTemplate.columns.forEach(newCol => {
            const oldCol = oldColumns.get(newCol.id);
            if (oldCol && !!newCol.isMultiSelect !== !!oldCol.isMultiSelect) {
                migrations.push({ colId: newCol.id, toMulti: !!newCol.isMultiSelect });
            }
        });
    }

    return session => {
        if (migrations.length === 0) return session;
        let hasChanges = false;
        const players = session.players.map(player => {
            let scores = player.scores;
            for (const { colId, toMulti } of migrations) {
                const score = scores[colId];
                if (!score) continue;

                const multiIds = score.multiOptionIds || [];
                const migrated = toMulti && multiIds.length === 0 && score.optionId
                    ? { ...score, multiOptionIds: [score.optionId] }
                    : !toMulti && !score.optionId && multiIds.length > 0
                        ? { ...score, optionId: multiIds[0] }
                        : score;
                if (migrated === score) continue;

                if (scores === player.scores) scores = { ...scores };
                scores[colId] = migrated;
            }
            if (scores === player.scores) return player;
            hasChanges = true;
            return { ...player, scores };
        });
        return hasChanges ? { ...session, players } : session;
    };
}

/** Finish every input migration before deriving cross-player totals and winners. */
export function applyTemplateToSession(
    session: GameSession,
    oldTemplate: GameTemplate | null,
    finalTemplate: GameTemplate
): GameSession {
    const migrated = createTemplateSelectionMigration(oldTemplate, finalTemplate)(session);

    // All players must use the same fully migrated scoring context.
    return recalculateScoreSession({
        ...migrated,
        templateId: finalTemplate.id,
        name: finalTemplate.name,
        bggId: finalTemplate.bggId
    }, finalTemplate);
}
