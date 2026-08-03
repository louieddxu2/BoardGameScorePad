import { GameSession, SavedListItem } from '../../types';
import { Candidate } from '../../components/tools/player-selector/types';
import { searchService } from '../../services/searchService';
import { Voter } from './ContextResolver';
import { getRecommendedCandidatesPure } from './PlayerRecommendationEngine';

interface PlayerEditorRecommendationParams {
    session: GameSession;
    playerId: string;
    allSavedPlayers: SavedListItem[];
    contextVoters: Voter[];
}

/**
 * Calculate recommendations for one seat. The current seat is never a voter;
 * only seats to its left provide locked relationship voters. Seats to the
 * right remain available as fallback candidates for order adjustments.
 */
export function getPlayerEditorRecommendations({
    session,
    playerId,
    allSavedPlayers,
    contextVoters
}: PlayerEditorRecommendationParams): Candidate[] {
    const currentIndex = session.players.findIndex(player => player.id === playerId);
    const playersBeforeCurrent = currentIndex < 0 ? [] : session.players.slice(0, currentIndex);

    const recommendations = getRecommendedCandidatesPure({
        allSavedPlayers,
        contextVoters,
        lockedPlayerIds: playersBeforeCurrent
            .map(player => player.linkedPlayerId)
            .filter((id): id is string => !!id),
        lockedNames: playersBeforeCurrent.map(player => player.name),
        sessionPlayers: session.players
            .filter(player => player.id !== playerId)
            .map(player => ({ id: player.id, name: player.name }))
    });

    // The shared engine intentionally removes locked IDs for the starting
    // player selector. Name editing has a different contract: later seats
    // must remain selectable even when they share a linked identity, so append
    // any later names that the engine filtered out.
    const laterPlayers = currentIndex < 0 ? [] : session.players.slice(currentIndex + 1);
    const laterPlayerByName = new Map(laterPlayers.map(player => [player.name.toLowerCase(), player]));
    const normalizedRecommendations = recommendations.map(candidate => {
        const laterPlayer = laterPlayerByName.get(candidate.name.toLowerCase());
        return laterPlayer && candidate.id === laterPlayer.id && laterPlayer.linkedPlayerId
            ? { ...candidate, linkedPlayerId: laterPlayer.linkedPlayerId }
            : candidate;
    });
    const recommendedNames = new Set(normalizedRecommendations.map(candidate => candidate.name.toLowerCase()));
    const laterCandidates = laterPlayers
        .filter(player => player.name && !recommendedNames.has(player.name.toLowerCase()))
        .map(player => {
            const savedMatch = allSavedPlayers.find(saved => saved.name.toLowerCase() === player.name.toLowerCase());
            return savedMatch
                ? { id: savedMatch.id, name: savedMatch.name, linkedPlayerId: savedMatch.id }
                : { id: player.id, name: player.name, linkedPlayerId: player.linkedPlayerId || player.id };
        });

    return [...normalizedRecommendations, ...laterCandidates];
}

/** Search the complete saved-player library with the same candidate shape. */
export function searchPlayerEditorCandidates(
    allSavedPlayers: SavedListItem[],
    query: string
): Candidate[] {
    return searchService.search(allSavedPlayers, query, ['name']).map(player => ({
        id: player.id,
        name: player.name,
        linkedPlayerId: player.id
    }));
}
