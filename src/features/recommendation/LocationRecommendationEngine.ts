
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { RecommendationContext, LocationRecommendationWeights, DEFAULT_LOCATION_WEIGHTS } from './types';
import { contextResolver } from './ContextResolver';
import { votingEngine } from './VotingEngine';
import { RELATION_PREDICTION_CONFIG } from '../../services/relationship/RelationMapper';

/**
 * 地點推薦引擎 (Location Recommendation Engine)
 * 
 * 根據情境預測最可能的地點。
 * 考慮因素：遊戲、人數、時間、以及（已知的）玩家。
 */
export class LocationRecommendationEngine {

    public async generateSuggestions(
        context: RecommendationContext, 
        weights: LocationRecommendationWeights = DEFAULT_LOCATION_WEIGHTS
    ): Promise<string[]> {
        
        // 1. Resolve Base Context Voters (Game, Time, Count...)
        const voters = await contextResolver.resolveBaseContext(context);

        // 2. Add Known Players as Voters (if any)
        if (context.knownPlayerIds && context.knownPlayerIds.length > 0) {
            const playerVoters = await contextResolver.resolvePlayerVoters(context.knownPlayerIds);
            voters.push(...playerVoters);
        }

        // 3. 執行投票 (針對 'locations' 關聯)
        // 使用統一配置的 limit
        const limit = RELATION_PREDICTION_CONFIG.locations.limit;

        const scoresMap = votingEngine.calculateScores(
            voters, 
            weights as any, // 轉型適配 (VotingEngine 介面通用)
            'locations',
            [], // ignoreIds
            limit
        );

        // 4. 排序結果
        const sortedIds = Array.from(scoresMap.entries())
            .sort((a, b) => b[1] - a[1]) // 分數高到低
            .map(entry => entry[0]);

        // 5. 轉換為 SavedListItem 物件 (若需要名稱)，或直接回傳 ID
        // 這邊依照 CountEngine 模式，我們確認這些 ID 是否存在於 DB 中，並回傳實體
        // 但為了介面統一，這裡先回傳 ID 列表，由 Service 轉為物件或 UI 處理

        // 實際上 UI 需要的是地點名稱字串 (如果是新地點) 或 ID
        // 我們這裡做一次 DB 查詢把 ID 轉回 Name，方便 UI 顯示
        const resultNames: string[] = [];
        const locations = await db.savedLocations.where('id').anyOf(sortedIds).toArray();
        const locMap = new Map<string, string>(locations.map(l => [l.id, l.name] as [string, string]));

        sortedIds.forEach(id => {
            const name = locMap.get(id);
            if (name) resultNames.push(name);
        });

        // 只回傳前 N 個建議
        return resultNames.slice(0, limit);
    }
}

export const locationRecommendationEngine = new LocationRecommendationEngine();
