
import { RecommendationContext, CountRecommendationWeights, DEFAULT_COUNT_WEIGHTS } from './types';
import { contextResolver } from './ContextResolver';
import { votingEngine } from './VotingEngine';
import { RELATION_PREDICTION_CONFIG } from '../../services/relationship/RelationMapper';

/**
 * 人數推薦引擎 (Count Recommendation Engine)
 * 
 * 根據情境預測最可能的玩家人數。
 * 使用 VotingEngine 針對 'playerCounts' 關係進行投票。
 */
export class CountRecommendationEngine {

    public async generateSuggestions(
        context: RecommendationContext, 
        weights: CountRecommendationWeights = DEFAULT_COUNT_WEIGHTS
    ): Promise<number[]> {
        
        // 1. Resolve Base Context Voters (Game, Location, Time...)
        const voters = await contextResolver.resolveBaseContext(context);

        // 2. 執行投票 (針對 'playerCounts' 關聯)
        // [Refactor] 使用統一配置的 limit (3)
        const limit = RELATION_PREDICTION_CONFIG.playerCounts.limit;

        const scoresMap = votingEngine.calculateScores(
            voters, 
            weights as any, // 轉型適配 (VotingEngine 介面通用)
            'playerCounts',
            [], // ignoreIds
            limit
        );

        // 3. 排序結果
        const sortedIds = Array.from(scoresMap.entries())
            .sort((a, b) => b[1] - a[1]) // 分數高到低
            .map(entry => entry[0]);

        // 4. 解析 ID (count_X -> X)
        // 過濾並轉換為數字
        const counts = sortedIds
            .map(id => {
                if (id.startsWith('count_')) {
                    const num = parseInt(id.replace('count_', ''), 10);
                    return isNaN(num) ? null : num;
                }
                return null;
            })
            .filter((c): c is number => c !== null);

        // 只回傳前 N 個建議
        return counts.slice(0, limit);
    }
}

export const countRecommendationEngine = new CountRecommendationEngine();
