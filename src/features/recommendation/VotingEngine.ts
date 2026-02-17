

import { SavedListItem } from '../../types';
import { RecommendationFactor } from './types';

export interface Voter {
    item: SavedListItem;
    factor: RecommendationFactor;
}

export class VotingEngine {
    
    // 定義計分時的基準最高分 (第1名得 5 分)
    // 這與候選人數量脫鉤，確保即使只取 Top 2，第1名依然能拿到 5 分的權重
    private static readonly MAX_SCORE_BASE = 5;
    
    // 預設的候選人數量 (如果呼叫端沒指定)
    private static readonly DEFAULT_LIMIT = 5;

    /**
     * 計算分數
     * 
     * @param voters 投票者列表 (實體 + 權重因子類型)
     * @param weights 權重設定表
     * @param relationKey 要讀取哪一種關聯 (例如 'players' 或 'playerCounts')
     * @param ignoreIds (可選) 要忽略的候選人 ID 列表 (例如已經被選中的玩家)
     * @param candidateLimit (可選) 取前幾名候選人參與投票
     * @returns Map<CandidateID, Score>
     */
    public calculateScores(
        voters: Voter[],
        weights: Record<string, number>,
        relationKey: string,
        ignoreIds: string[] = [],
        candidateLimit: number = VotingEngine.DEFAULT_LIMIT
    ): Map<string, number> {
        
        const scores = new Map<string, number>();
        const ignoreSet = new Set(ignoreIds);

        for (const { item: voter, factor } of voters) {
            // 檢查該實體是否有我們需要的關聯資料
            if (!voter || !voter.meta || !voter.meta.relations || !voter.meta.relations[relationKey]) continue;

            const rawCandidates = voter.meta.relations[relationKey];
            if (!Array.isArray(rawCandidates)) continue;

            // 正規化候選人列表：支援物件 {id, count} 或舊版字串
            const candidates: string[] = rawCandidates.map((c: any) => {
                if (typeof c === 'object' && c !== null && c.id) return c.id;
                if (typeof c === 'string') return c;
                return null;
            }).filter((id): id is string => !!id);

            // A. Entity Confidence (該實體在這個關聯上的可信度)
            const confidence = voter.meta.confidence?.[relationKey] ?? 1.0;
            
            // B. Factor Weight (該類型因子的全域權重)
            const factorWeight = weights[factor] ?? 1.0;

            // Voting Logic: 動態遞補 (Dynamic Filling)
            // 遍歷清單，跳過已選的 ID，直到投滿 candidateLimit 票為止
            let validVotes = 0;
            
            for (const candidateId of candidates) {
                // 若已投滿票數，停止
                if (validVotes >= candidateLimit) break;
                
                // 若在忽略名單中，跳過 (自動遞補下一位)
                if (ignoreSet.has(candidateId)) continue;

                // Score Formula: (排名越高分越多) * 信心值 * 權重
                // 使用 validVotes (有效順位) 來計算分數，確保遞補上來的第一位能拿到最高分
                // index 0 -> 5分, index 1 -> 4分 ...
                const baseScore = Math.max(1, VotingEngine.MAX_SCORE_BASE - validVotes);
                
                const finalScore = baseScore * confidence * factorWeight;

                const currentScore = scores.get(candidateId) || 0;
                scores.set(candidateId, currentScore + finalScore);
                
                validVotes++;
            }
        }

        return scores;
    }
}

export const votingEngine = new VotingEngine();
