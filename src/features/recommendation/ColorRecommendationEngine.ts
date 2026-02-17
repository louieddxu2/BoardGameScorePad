
import { db } from '../../db';
import { GameTemplate, SavedListItem } from '../../types';
import { RecommendationContext, ColorRecommendationWeights, DEFAULT_COLOR_WEIGHTS } from './types';
import { contextResolver, Voter } from './ContextResolver';
import { votingEngine } from './VotingEngine';

/**
 * 顏色推薦引擎 (Color Recommendation Engine)
 * 
 * 根據「遊戲設定」、「遊戲歷史」、「玩家偏好」三方權重，預測適合該玩家的顏色。
 * 
 * 邏輯：
 * 1. Template Settings (虛擬投票者): 權重最高，代表規則限制。
 * 2. Game History: 這款遊戲大家常用什麼顏色。
 * 3. Player History: 該玩家在所有遊戲中常用的顏色。
 */
export class ColorRecommendationEngine {

    public async generateSuggestions(
        context: RecommendationContext, 
        template: GameTemplate,
        targetPlayerId: string,
        weights: ColorRecommendationWeights = DEFAULT_COLOR_WEIGHTS,
        ignoreColors: string[] = [] // 已被其他玩家佔用的顏色
    ): Promise<string[]> {
        
        const voters: Voter[] = [];

        // 1. Template Settings (Virtual Voter)
        // 將模板設定轉為一個虛擬的投票者
        // [Correction] 採用「排序即權重」邏輯。
        // VotingEngine 會依序遍歷列表：Index 0 得 5 分，Index 1 得 4 分...
        // 因此我們只需按照使用者設定的順序建立陣列，count 值本身不參與權重計算 (設為 0)。
        if (template.supportedColors && template.supportedColors.length > 0) {
            
            const relations = template.supportedColors.map(c => ({ 
                id: c, 
                count: 0 // 對於虛擬投票者，count 無意義，順序決定一切
            }));
            
            const templateVoter: Voter = {
                item: {
                    id: 'template_settings_virtual',
                    name: 'Template Settings',
                    lastUsed: 0,
                    usageCount: 0,
                    meta: {
                        relations: { colors: relations },
                        // 固定給予最高信心值 5.0，確保此順序權重最大
                        confidence: { colors: 5.0 }
                    }
                },
                factor: 'templateSetting'
            };
            voters.push(templateVoter);
        }

        // 2. Game Voter (Context)
        // 找出目前的遊戲實體
        const gameVoters = await contextResolver.resolveBaseContext(context);
        const gameVoter = gameVoters.find(v => v.factor === 'game');
        if (gameVoter) {
            // 重設 factor 標籤為 color 專用
            gameVoter.factor = 'game'; 
            voters.push(gameVoter);
        }

        // 3. Player Voter (Target)
        // 找出目標玩家實體
        const playerVoterItem = await db.savedPlayers.get(targetPlayerId);
        if (playerVoterItem) {
            voters.push({
                item: playerVoterItem,
                factor: 'player'
            });
        }

        // 4. 執行投票
        // 針對 'colors' 關聯
        // [Important] 顏色候選池很小 (約 20 色)，但為了確保「冷門色」在「熱門色」被選走後能遞補上來，
        // 我們將 candidateLimit 設為 20 (全開)，讓 VotingEngine 的動態遞補邏輯生效。
        const scoresMap = votingEngine.calculateScores(
            voters, 
            weights as any, 
            'colors', 
            ignoreColors,
            20 // Max candidate limit for colors
        );

        // 5. 排序結果
        const sortedColors = Array.from(scoresMap.entries())
            .sort((a, b) => b[1] - a[1]) // 分數高到低
            .map(entry => entry[0]);
            
        // 過濾掉透明色 (transparent 通常不作為推薦色)
        return sortedColors.filter(c => c !== 'transparent');
    }
}

export const colorRecommendationEngine = new ColorRecommendationEngine();
