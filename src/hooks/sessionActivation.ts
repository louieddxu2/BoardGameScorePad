import type { GameSession, GameTemplate } from '../types';
import { imageService } from '../services/imageService';
import { migrateTemplate, migrateScores } from '../utils/dataMigration';
import { calculateWinners, createVirtualTemplate } from '../utils/templateUtils';

/** Prepare a resumed session without publishing partial or obsolete UI state. */
export const loadSessionActivation = async (
    input: GameSession,
    getTemplate: (id: string) => Promise<GameTemplate | null>,
    isCurrent: () => boolean,
): Promise<{ session: GameSession; template: GameTemplate; imageUrl: string | null } | null> => {
    const session = { ...input };
    let template = await getTemplate(session.templateId);
    if (!isCurrent()) return null;

    if (!template) {
        console.warn(`Template ${session.templateId} missing for session ${session.id}. Creating virtual fallback.`);
        template = createVirtualTemplate(
            session.templateId,
            session.name || 'Unknown Game',
            session.bggId,
            session.startTime,
            session.players.length,
            session.scoringRule,
        );
    }
    const migratedTemplate = migrateTemplate(template);
    // Keep legacy score formats and missing identity fields compatible on resume.
    session.players = session.players.map(player => ({
        ...player, scores: migrateScores(player.scores, migratedTemplate),
    }));
    if (!session.winnerIds) session.winnerIds = calculateWinners(session.players, session.scoringRule);
    if (!session.name) session.name = migratedTemplate.name;
    if (session.bggId === undefined) session.bggId = migratedTemplate.bggId;
    if (!session.lastUpdatedAt) session.lastUpdatedAt = Date.now();

    let imageUrl: string | null = null;
    if (migratedTemplate.imageId) {
        const localImage = await imageService.getImage(migratedTemplate.imageId);
        // Do not allocate a blob URL for a session that has already been left.
        if (!isCurrent()) return null;
        if (localImage) imageUrl = URL.createObjectURL(localImage.blob);
    }
    return { session, template: migratedTemplate, imageUrl };
};
