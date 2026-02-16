
import { GameSession, Player } from '../../types';
import { recommendationService } from './RecommendationService';

/**
 * 根據 Session 的情境，取得推薦玩家並應用到玩家列表中。
 * 此函式不會修改原始 Session 物件，而是回傳新的玩家陣列。
 */
export const applyRecommendationsToPlayers = async (
    session: GameSession
): Promise<Player[]> => {
    try {
        const playerCount = session.players.length;
        
        // 呼叫推薦服務
        const suggestions = await recommendationService.getPlayerSuggestions({
            gameName: session.name,
            bggId: session.bggId,
            locationName: session.location,
            playerCount: playerCount,
            scoringRule: session.scoringRule,
            timestamp: session.startTime
        }, playerCount);

        // 若無建議，回傳原名單
        if (!suggestions || suggestions.length === 0) {
            return session.players;
        }

        // 將建議合併至玩家列表
        return session.players.map((p, index) => {
            const suggestion = suggestions[index];
            if (suggestion) {
                return {
                    ...p,
                    name: suggestion.name,
                    linkedPlayerId: suggestion.id,
                    // 若有建議顏色則使用，否則保留系統分配的預設色
                    color: suggestion.suggestedColor || p.color
                };
            }
            return p;
        });

    } catch (e) {
        console.warn("[SessionPlayerInitializer] Recommendation failed, using default players.", e);
        // 發生錯誤時保持原樣，確保遊戲能繼續開始
        return session.players;
    }
};
