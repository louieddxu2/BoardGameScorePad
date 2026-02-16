
import { RecommendationContext, SuggestedPlayer, DEFAULT_PLAYER_WEIGHTS, DEFAULT_COUNT_WEIGHTS, DEFAULT_LOCATION_WEIGHTS } from './types';
import { playerRecommendationEngine } from './PlayerRecommendationEngine';
import { countRecommendationEngine } from './CountRecommendationEngine';
import { locationRecommendationEngine } from './LocationRecommendationEngine';
import { weightAdjustmentEngine, PLAYER_WEIGHTS_ID, COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID } from './WeightAdjustmentEngine';

class RecommendationService {

    /**
     * 取得推薦玩家列表
     */
    public async getPlayerSuggestions(context: RecommendationContext, limit: number = 4): Promise<SuggestedPlayer[]> {
        // Load Dynamic Weights
        const weights = await weightAdjustmentEngine.getWeights(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS);

        // Delegate to Player Engine
        const suggestions = await playerRecommendationEngine.generateSuggestions(context, weights, limit);

        return suggestions;
    }

    /**
     * 取得推薦人數列表
     */
    public async getSuggestedPlayerCounts(context: RecommendationContext): Promise<number[]> {
        // Load Dynamic Weights
        const weights = await weightAdjustmentEngine.getWeights(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS);

        // Delegate to Count Engine
        const suggestions = await countRecommendationEngine.generateSuggestions(context, weights);

        return suggestions;
    }

    /**
     * 取得推薦地點列表 (名稱陣列)
     */
    public async getSuggestedLocations(context: RecommendationContext): Promise<string[]> {
        // Load Dynamic Weights
        const weights = await weightAdjustmentEngine.getWeights(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS);

        // Delegate to Location Engine
        const suggestions = await locationRecommendationEngine.generateSuggestions(context, weights);

        return suggestions;
    }

    /**
     * [Future] 取得推薦遊戲列表
     * 目前尚未實作，僅回傳空陣列或預設值。
     */
    public async getSuggestedGames(context: RecommendationContext): Promise<string[]> {
        // TODO: Implement GameRecommendationEngine
        // Logic: 根據 Location, Time, Count, Players 推薦適合的遊戲
        return [];
    }
}

export const recommendationService = new RecommendationService();
// Re-export types for consumers
export type { RecommendationContext, SuggestedPlayer } from './types';
