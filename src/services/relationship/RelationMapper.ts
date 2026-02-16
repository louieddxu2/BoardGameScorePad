
import { PlayerRecommendationFactor, CountRecommendationFactor, LocationRecommendationFactor } from '../../features/recommendation/types';
import { EntityType } from './types';

// [New] Prediction Strategy Configuration
// 定義每種關聯類型的預測策略
// Fixed: 固定窗口大小 (忽略母群體大小)
// Dynamic: 動態窗口 (母群體 * ratio，但不超過 limit)
export interface PredictionStrategy {
    strategy: 'fixed' | 'dynamic';
    limit: number; // Max Cap for dynamic, or Exact Value for fixed
    ratio?: number; // Only for dynamic
}

// [Centralized Config]
// 統一管理「信心值計算」與「推薦投票」的窗口大小
export const RELATION_PREDICTION_CONFIG: Record<string, PredictionStrategy> = {
    // [User Requirement] 人數預測：固定取前 2 名
    playerCounts: { strategy: 'fixed', limit: 2 },
    
    // 玩家/地點/遊戲：動態調整，最多取前 5 名 (適合長尾分佈)
    players: { strategy: 'dynamic', limit: 5, ratio: 0.25 },
    locations: { strategy: 'dynamic', limit: 5, ratio: 0.25 },
    games: { strategy: 'dynamic', limit: 5, ratio: 0.25 },
    
    // 時間/模式：母群體小，固定取前 2 名即可覆蓋主要習慣
    weekdays: { strategy: 'fixed', limit: 2 },
    timeSlots: { strategy: 'fixed', limit: 2 },
    gameModes: { strategy: 'fixed', limit: 2 },
    
    // 顏色
    colors: { strategy: 'fixed', limit: 4 },
    
    // 預設 fallback
    others: { strategy: 'dynamic', limit: 5, ratio: 0.25 }
};

export class RelationMapper {
    /**
     * 根據配置與母群體大小，計算最終的預測窗口大小 (N)
     */
    public static getPredictionWindow(relationKey: string, totalPoolSize: number): number {
        const config = RELATION_PREDICTION_CONFIG[relationKey] || RELATION_PREDICTION_CONFIG.others;
        
        if (config.strategy === 'fixed') {
            return config.limit;
        }
        
        // Dynamic Strategy
        const calculated = Math.ceil(totalPoolSize * (config.ratio || 0.25));
        // 確保至少為 1，且不超過設定的上限 (limit)
        return Math.max(1, Math.min(config.limit, calculated));
    }

    /**
     * 將實體類型映射到資料庫 meta.relations 中的 key
     * 例如: 'player' -> 'players', 'game' -> 'games'
     */
    public static getRelationKey(type: EntityType): string {
        switch (type) {
            case 'player': return 'players';
            case 'game': return 'games';
            case 'location': return 'locations';
            case 'weekday': return 'weekdays';
            case 'timeslot': return 'timeSlots';
            case 'playerCount': return 'playerCounts';
            case 'gameMode': return 'gameModes';
            case 'color': return 'colors';
        }
        return 'others';
    }

    /**
     * 將實體類型映射到權重調整引擎的 Factor (玩家預測用)
     * 用於判斷該實體是否具備「推薦玩家」的能力
     */
    public static getRecommendationFactor(type: EntityType): PlayerRecommendationFactor | undefined {
        switch (type) {
            case 'game': return 'game';
            case 'location': return 'location';
            case 'weekday': return 'weekday';
            case 'timeslot': return 'timeSlot';
            case 'playerCount': return 'playerCount';
            case 'gameMode': return 'gameMode';
            case 'player': return 'relatedPlayer';
            case 'sessionContext': return 'sessionContext';
        }
        return undefined;
    }

    /**
     * 將實體類型映射到權重調整引擎的 Factor (人數預測用)
     * 用於判斷該實體是否具備「推薦人數」的能力
     */
    public static getCountRecommendationFactor(type: EntityType): CountRecommendationFactor | undefined {
        switch (type) {
            case 'game': return 'game';
            case 'location': return 'location';
            case 'weekday': return 'weekday';
            case 'timeslot': return 'timeSlot';
            case 'sessionContext': return 'sessionContext';
            // Players do not vote for count to avoid complexity
        }
        return undefined;
    }

    /**
     * 將實體類型映射到權重調整引擎的 Factor (地點預測用)
     * 用於判斷該實體是否具備「推薦地點」的能力
     */
    public static getLocationRecommendationFactor(type: EntityType): LocationRecommendationFactor | undefined {
        switch (type) {
            case 'game': return 'game';
            case 'playerCount': return 'playerCount';
            case 'weekday': return 'weekday';
            case 'timeslot': return 'timeSlot';
            case 'sessionContext': return 'sessionContext';
            case 'player': return 'relatedPlayer'; // Known players strongly influence location
        }
        return undefined;
    }
}
