
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { RecommendationContext, SuggestedPlayer, PlayerRecommendationWeights, DEFAULT_PLAYER_WEIGHTS } from './types';
import { contextResolver, Voter } from './ContextResolver';
import { votingEngine } from './VotingEngine';
import { RELATION_PREDICTION_CONFIG } from '../../services/relationship/RelationMapper';
import { Candidate } from '../../components/tools/player-selector/types';

export interface GetRecommendedCandidatesParams {
    allSavedPlayers: SavedListItem[];
    contextVoters: Voter[];
    lockedPlayerIds: string[];
    lockedNames: string[];
    sessionPlayers: Array<{ id: string; name: string }>;
}

/**
 * 記憶體同步算分推薦玩家
 * 根據當前已鎖定玩家與背景 voters，在記憶體內直接進行一次性投票算分並排序。
 * 消除 iterations 迴圈與非同步 I/O，大幅提升視覺選擇器在操作時的反應速度。
 */
export function getRecommendedCandidatesPure({
    allSavedPlayers,
    contextVoters,
    lockedPlayerIds,
    lockedNames,
    sessionPlayers
}: GetRecommendedCandidatesParams): Candidate[] {
    // 1. 準備投票者 (Voters)
    const voters = [...contextVoters];

    // 已鎖定的玩家也作為 Voter 參與投票
    const allSavedPlayersMap = new Map(allSavedPlayers.map(p => [p.id, p]));
    lockedPlayerIds.forEach(id => {
        const p = allSavedPlayersMap.get(id);
        if (p) {
            voters.push({ item: p, factor: 'relatedPlayer' });
        }
    });

    // 2. 呼叫 votingEngine.calculateScores (同步算分)
    // 為了取得所有可能候選人的分數，不對 candidateLimit 做限制 (傳入 allSavedPlayers.length 確保每位同玩玩家都能計分)
    const scoresMap = votingEngine.calculateScores(
        voters,
        DEFAULT_PLAYER_WEIGHTS as unknown as Record<string, number>,
        'players',
        lockedPlayerIds,
        allSavedPlayers.length
    );

    // 3. 對所有真實存檔玩家進行算分與排序 (排除已鎖定的)
    const candidatesList = allSavedPlayers
        .filter(p => !lockedPlayerIds.includes(p.id))
        .map(p => {
            const score = scoresMap.get(p.id) || 0;
            return {
                id: p.id,
                name: p.name,
                linkedPlayerId: p.id,
                score,
                usageCount: p.usageCount || 0,
                lastUsed: p.lastUsed || 0
            };
        });

    // 排序優先級：
    // A. 算分 (score) 降序
    // B. usageCount 降序
    // C. lastUsed 降序
    candidatesList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        return b.lastUsed - a.lastUsed;
    });

    // 4. 將排序後的候選人轉成 Candidate[]
    let list: Candidate[] = candidatesList.map(c => ({
        id: c.id,
        name: c.name,
        linkedPlayerId: c.linkedPlayerId
    }));

    // 5. 推薦不足 4 人，用現有 session 中的玩家名稱補足
    if (list.length < 4) {
        const existingNames = new Set(list.map(item => item.name));
        const lockedNamesSet = new Set(lockedNames);
        const fallbackPlayers = sessionPlayers
            .filter(p => !existingNames.has(p.name) && !lockedNamesSet.has(p.name))
            .map(p => ({
                id: p.id,
                name: p.name,
                linkedPlayerId: p.id
            }));
        list = [...list, ...fallbackPlayers];
    }

    return list;
}

export class PlayerRecommendationEngine {

    public async generateSuggestions(
        context: RecommendationContext, 
        weights: PlayerRecommendationWeights = DEFAULT_PLAYER_WEIGHTS,
        limit: number = 4
    ): Promise<SuggestedPlayer[]> {
        
        // 1. Initial State: Start with already selected players for chained prediction
        const selectedPlayerIds: string[] = [...(context.knownPlayerIds || [])];
        
        // 2. Resolve Base Context Voters (Game, Location, Time...) - Do this ONCE via ContextResolver
        const baseVoters = await contextResolver.resolveBaseContext(context);
        
        // [Refactor] 使用統一配置 the candidate limit (5)
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
                weights as unknown as Record<string, number>, 
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

        // Map back to result format, preserving the ORDER of selection (excluding knownPlayerIds)
        const result: SuggestedPlayer[] = [];
        const knownSet = new Set(context.knownPlayerIds || []);
        selectedPlayerIds.forEach(id => {
            if (knownSet.has(id)) return; // 排除已鎖定的玩家
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
