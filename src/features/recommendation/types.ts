
import { ScoringRule } from '../../types';

export interface RecommendationContext {
    gameName?: string;
    bggId?: string;
    locationName?: string;
    playerCount?: number;
    scoringRule?: ScoringRule;
    timestamp?: number;
    // [New] Optional: specific players known in advance (e.g. manually locked)
    knownPlayerIds?: string[];
}

export interface SuggestedPlayer {
    id: string;
    name: string;
    score: number;
    suggestedColor?: string;
}

// [Machine Learning Core]
// 定義影響「玩家推薦」的各種因素
// [Added] 'relatedPlayer' for Player-to-Player voting
// [Added] 'sessionContext' for Short-term memory (Last played context)
export type PlayerRecommendationFactor = 'game' | 'location' | 'weekday' | 'timeSlot' | 'playerCount' | 'gameMode' | 'relatedPlayer' | 'sessionContext';

// 定義「玩家推薦」專用的權重表結構
export interface PlayerRecommendationWeights {
    game: number;
    location: number;
    weekday: number;
    timeSlot: number;
    playerCount: number;
    gameMode: number;
    relatedPlayer: number;
    sessionContext: number;
}

// 預設權重 (目前全部為 1.0，即平權投票)
export const DEFAULT_PLAYER_WEIGHTS: PlayerRecommendationWeights = {
    game: 1.0,
    location: 1.0,
    weekday: 1.0,
    timeSlot: 1.0,
    playerCount: 1.0,
    gameMode: 1.0,
    relatedPlayer: 1.0,
    sessionContext: 1.0
};

// --- Player Count Recommendation Types ---

// 影響「人數推薦」的因素
// [Added] sessionContext (Short-term memory)
export type CountRecommendationFactor = 'game' | 'location' | 'weekday' | 'timeSlot' | 'sessionContext';

// 定義「人數推薦」專用的權重表結構
export interface CountRecommendationWeights {
    game: number;
    location: number;
    weekday: number;
    timeSlot: number;
    sessionContext: number;
}

export const DEFAULT_COUNT_WEIGHTS: CountRecommendationWeights = {
    game: 1.0,     // 遊戲本身通常最重要 (例如某些遊戲只能 4 人)
    location: 1.0, // 地點限制
    weekday: 1.0,  // 平日/假日團人數習慣
    timeSlot: 1.0, // 時段習慣
    sessionContext: 1.0 // 短期記憶 (連開)
};

// --- Location Recommendation Types ---

// 影響「地點推薦」的因素
export type LocationRecommendationFactor = 'game' | 'playerCount' | 'weekday' | 'timeSlot' | 'sessionContext' | 'relatedPlayer';

// 定義「地點推薦」專用的權重表結構
export interface LocationRecommendationWeights {
    game: number;
    playerCount: number;
    weekday: number;
    timeSlot: number;
    sessionContext: number;
    relatedPlayer: number; // 如果已知有某玩家，可能會影響地點 (e.g. 去小明家)
}

export const DEFAULT_LOCATION_WEIGHTS: LocationRecommendationWeights = {
    game: 1.0,         // 遊戲種類 (大桌遊去店裡)
    playerCount: 1.0,  // 人數 (多人去大場地)
    weekday: 1.0,      // 時間 (平日在家/假日出門)
    timeSlot: 1.0,
    sessionContext: 1.0,
    relatedPlayer: 1.0 // 玩家 (特定團特定地點)
};

// --- Color Recommendation Types ---

// 影響「顏色推薦」的因素
// templateSetting: 遊戲模板設定 (虛擬投票者)
// game: 遊戲歷史 (這款遊戲常被選的顏色)
// player: 玩家偏好 (這個人喜歡的顏色)
export type ColorRecommendationFactor = 'templateSetting' | 'game' | 'player';

export interface ColorRecommendationWeights {
    templateSetting: number;
    game: number;
    player: number;
}

export const DEFAULT_COLOR_WEIGHTS: ColorRecommendationWeights = {
    templateSetting: 1.0, // [Reset] 權重設為 1.0，高信心值 (5.0) 由 voter.meta.confidence 處理
    game: 1.0,            
    player: 1.0           
};

// [New] Union type for all possible factors across different engines
export type RecommendationFactor = PlayerRecommendationFactor | CountRecommendationFactor | LocationRecommendationFactor | ColorRecommendationFactor;
