
import { GameSession, Player, GameTemplate } from '../../types';
import { recommendationService } from './RecommendationService';
import { COLORS } from '../../colors';

/**
 * 根據 Session 的情境，取得推薦玩家並應用到玩家列表中。
 * 此函式不會修改原始 Session 物件，而是回傳新的玩家陣列。
 * 
 * [v26 Update] 
 * 重構顏色分配邏輯：
 * 1. 優先使用 ColorRecommendationEngine (考量模板設定、遊戲歷史、玩家偏好)。
 * 2. 採用兩階段分配：
 *    Phase 1: 依序為每位玩家請求推薦，若有可用推薦色則立即分配。
 *    Phase 2: 針對 Phase 1 未獲得顏色的玩家，從剩餘色票中依序遞補。
 */
export const applyRecommendationsToPlayers = async (
    session: GameSession,
    template: GameTemplate
): Promise<Player[]> => {
    try {
        const playerCount = session.players.length;

        // 1. 判斷是否為 Texture Mode (有背景圖或視覺設定)
        // 在這種模式下，我們不希望顏色遮擋背景，且通常也不需要顏色區分(位置已區分)
        const isTextureMode = !!template.globalVisuals || !!template.hasImage || !!template.imageId || !!template.cloudImageId;

        // 2. 呼叫推薦服務取得玩家名稱 (Names)
        const nameSuggestions = await recommendationService.getPlayerSuggestions({
            gameName: session.name,
            bggId: session.bggId,
            locationName: session.location,
            playerCount: playerCount,
            scoringRule: session.scoringRule,
            timestamp: session.startTime
        }, playerCount);

        // 3. 應用名稱 (建立中間態玩家列表)
        const playersWithNames = session.players.map((p, index) => {
            const suggestion = nameSuggestions ? nameSuggestions[index] : undefined;
            const newP = { ...p };
            const isBogusSuggestion = suggestion && /^(玩家|Player)\s?\d+$/.test(suggestion.name);
            if (suggestion && !isBogusSuggestion) {
                newP.name = suggestion.name;
                newP.linkedPlayerId = suggestion.id;
            }
            return newP;
        });

        // 4. 顏色分配 (Color Assignment)

        if (isTextureMode) {
            // Texture Mode: 強制透明
            return playersWithNames.map(p => ({
                ...p,
                color: 'transparent',
                isColorManuallySet: false
            }));
        }

        // Standard Mode: 智慧分配
        const finalPlayers: Player[] = [...playersWithNames]; // Clone array for mutation
        const usedColors = new Set<string>();
        const assignedIndices = new Set<number>();

        // 準備備用色票 (Fallback Palette)
        // 順序：模板設定色 > 系統預設色 (排除已在模板中的)
        const templateColors = template.supportedColors || [];
        const systemColors = COLORS.filter(c => !templateColors.includes(c));
        const fullPalette = [...templateColors, ...systemColors];

        // 推薦情境 Context (共用)
        const context = {
            gameName: session.name,
            bggId: session.bggId,
            locationName: session.location,
            playerCount: playerCount,
            scoringRule: session.scoringRule,
            timestamp: session.startTime
        };

        // --- Phase 1: Recommendation Assignment ---
        // 嘗試滿足玩家偏好與模板設定
        for (let i = 0; i < finalPlayers.length; i++) {
            const p = finalPlayers[i];
            const targetId = p.linkedPlayerId || p.id;

            // 呼叫引擎取得該玩家的推薦顏色列表
            // 關鍵：傳入 current usedColors 以讓引擎知道哪些顏色已被佔用 (雖然引擎內也會過濾，但雙重保險)
            const suggestedColors = await recommendationService.getSuggestedColors(
                context,
                template,
                targetId,
                Array.from(usedColors)
            );

            // 挑選策略：從引擎建議中，選取第一個尚未被使用的顏色
            let chosenColor: string | undefined = undefined;
            for (const color of suggestedColors) {
                if (!usedColors.has(color)) {
                    chosenColor = color;
                    break;
                }
            }

            // 若有找到推薦色，則分配並標記為已處理
            if (chosenColor) {
                finalPlayers[i] = { ...p, color: chosenColor };
                usedColors.add(chosenColor);
                assignedIndices.add(i);
            }
            // 若無推薦色或推薦色都已衝突，則留到 Phase 2 處理
        }

        // --- Phase 2: Fallback Assignment ---
        // 為剩下的玩家分配剩餘顏色
        for (let i = 0; i < finalPlayers.length; i++) {
            if (assignedIndices.has(i)) continue;

            const p = finalPlayers[i];
            let chosenColor: string | undefined = undefined;

            // 從完整色票中依序尋找未使用的顏色
            for (const color of fullPalette) {
                if (!usedColors.has(color)) {
                    chosenColor = color;
                    break;
                }
            }

            // 最後防線：若色票耗盡，重複使用第一個顏色或給予黑色 (極端狀況)
            if (!chosenColor) {
                chosenColor = fullPalette[0] || '#000000';
                // 這裡不加入 usedColors 以避免阻擋後續的 fallback
            } else {
                usedColors.add(chosenColor);
            }

            finalPlayers[i] = { ...p, color: chosenColor };
        }

        return finalPlayers;

    } catch (e) {
        console.warn("[SessionPlayerInitializer] Recommendation failed, using default players.", e);
        // 發生錯誤時保持原樣，確保遊戲能繼續開始
        return session.players;
    }
};
