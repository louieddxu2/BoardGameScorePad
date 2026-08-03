import { GameSession, SavedListItem } from '../../types';
import { Candidate } from '../../components/tools/player-selector/types';
import { searchService } from '../../services/searchService';
import { Voter } from './ContextResolver';
import { playerRecommendationEngine } from './PlayerRecommendationEngine';
import { PlayerRecommendationWeights } from './types';

interface PlayerEditorRecommendationParams {
    session: GameSession;
    playerId: string;
    allSavedPlayers: SavedListItem[];
    contextVoters: Voter[];
    weights?: PlayerRecommendationWeights;
}

/** Calculate one recommendation list for one seat. */
export function getPlayerEditorRecommendations({
    session,
    playerId,
    allSavedPlayers,
    contextVoters,
    weights
}: PlayerEditorRecommendationParams): Candidate[] {
    const currentIndex = session.players.findIndex(player => player.id === playerId);
    const playersBeforeCurrent = currentIndex < 0 ? [] : session.players.slice(0, currentIndex);

    return playerRecommendationEngine.generateSuggestions({
        allSavedPlayers,
        contextVoters,
        lockedPlayerIds: playersBeforeCurrent
            .map(player => player.linkedPlayerId)
            .filter((id): id is string => !!id),
        lockedNames: playersBeforeCurrent.map(player => player.name),
        sessionPlayers: [],
        weights
    });
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
