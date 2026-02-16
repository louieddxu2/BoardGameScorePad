
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { RecommendationContext, SuggestedPlayer, PlayerRecommendationWeights, DEFAULT_PLAYER_WEIGHTS } from './types';
import { contextResolver } from './ContextResolver';
import { votingEngine } from './VotingEngine';
import { RELATION_PREDICTION_CONFIG } from '../../services/relationship/RelationMapper';

/**
 * 玩家推薦引擎 (Player Recommendation Engine)
 * 專責處理「推薦玩家」的邏輯。
 * 
 * 使用 ContextResolver 取得環境資訊。
 * 使用 VotingEngine 進行加權投票。
 * 實作連鎖預測 (Chained Prediction) 邏輯。
 */
export class PlayerRecommendationEngine {

    public async generateSuggestions(
        context: RecommendationContext, 
        weights: PlayerRecommendationWeights = DEFAULT_PLAYER_WEIGHTS,
        limit: number = 4
    ): Promise<SuggestedPlayer[]> {
        
        // 1. Initial State: Empty suggestions
        const selectedPlayerIds: string[] = [];
        
        // 2. Resolve Base Context Voters (Game, Location, Time...) - Do this ONCE via ContextResolver
        const baseVoters = await contextResolver.resolveBaseContext(context);
        
        // [Refactor] 使用統一配置的 candidate limit (5)
        // 不論母群體多大，我們每次只取前 5 名最常一起玩的玩家來投票
        const candidateLimit = RELATION_PREDICTION_CONFIG.players.limit;

        // 3. Iterative Selection Loop (Chained Prediction)
        for (let i = 0; i < limit; i++) {
            
            // 3a. 準備本輪的投票者
            let currentVoters = [...baseVoters];

            // 加入「同儕投票者」(Peer Voters)：已選出的玩家也會影響下一位玩家的選擇
            if (selectedPlayerIds.length > 0) {
                 const peerVoters = await contextResolver.resolvePlayerVoters(selectedPlayerIds);
                 currentVoters = [...currentVoters, ...peerVoters];
            }

            // 3b. 執行投票 (針對 'players' 關聯)
            // 將 selectedPlayerIds 作為忽略清單，避免重複推薦
            const scoresMap = votingEngine.calculateScores(
                currentVoters, 
                weights, 
                'players', 
                selectedPlayerIds,
                candidateLimit
            );

            // 3c. Pick Winner
            let bestCandidateId: string | null = null;
            let maxScore = -1;

            for (const [id, score] of scoresMap.entries()) {
                if (score > maxScore) {
                    maxScore = score;
                    bestCandidateId = id;
                }
            }

            // 3d. Append to list
            if (bestCandidateId) {
                selectedPlayerIds.push(bestCandidateId);
            } else {
                // No more candidates found
                break;
            }
        }

        // 4. Resolve Details & Return
        if (selectedPlayerIds.length === 0) return [];

        const playersMap = new Map<string, SavedListItem>();
        const players = await db.savedPlayers.where('id').anyOf(selectedPlayerIds).toArray();
        players.forEach(p => playersMap.set(p.id, p));

        // Map back to result format, preserving the ORDER of selection
        const result: SuggestedPlayer[] = [];
        selectedPlayerIds.forEach(id => {
            const playerInfo = playersMap.get(id);
            if (playerInfo) {
                result.push({
                    id: playerInfo.id,
                    name: playerInfo.name,
                    score: 0, // Score is transient in loop
                    suggestedColor: this.predictColor(playerInfo)
                });
            }
        });

        return result;
    }

    private predictColor(player: SavedListItem): string | undefined {
        const rawColors = player.meta?.relations?.colors;
        if (Array.isArray(rawColors) && rawColors.length > 0) {
            const first = rawColors[0];
            if (typeof first === 'object' && first.id) return first.id;
            if (typeof first === 'string') return first;
        }
        return undefined;
    }
}

export const playerRecommendationEngine = new PlayerRecommendationEngine();
