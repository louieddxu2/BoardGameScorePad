import { RecommendationContext, PlayerRecommendationWeights, DEFAULT_PLAYER_WEIGHTS } from './types';
import { contextResolver, Voter } from './ContextResolver';
import { weightAdjustmentEngine, PLAYER_WEIGHTS_ID } from './WeightAdjustmentEngine';

export interface LoadedPlayerRecommendationContext {
    voters: Voter[];
    weights: PlayerRecommendationWeights;
}

/** Load the complete context and dynamic weights used when entering a game. */
export async function loadPlayerRecommendationContext(
    context: RecommendationContext
): Promise<LoadedPlayerRecommendationContext> {
    const [voters, weights] = await Promise.all([
        contextResolver.resolvePlayerContext(context),
        weightAdjustmentEngine.getWeights(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS)
    ]);

    return { voters, weights };
}
