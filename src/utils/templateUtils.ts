
import { GameTemplate, Player, ScoringRule } from '../types';
import { generateId } from './idGenerator';
import { migrateTemplate } from './dataMigration';

/**
 * 判定是否為「免洗」計分板 (Disposable Template)
 * 
 * 這類模板通常是透過「快速開始」自動產生，或使用者手動建立但未做任何設定的簡易計分板。
 * 為了保持遊戲庫整潔，這類模板在遊戲結束後會被自動清理。
 * 
 * 條件 (必須全部滿足):
 * 1. 無結構 (columns 為空，即簡易模式)
 * 2. 無圖片 (無 imageId, cloudImageId 且無 hasImage 標記)
 * 3. 無自訂顏色 (supportedColors 為空)
 * 4. 未釘選 (isPinned 為 false)
 */
export const isDisposableTemplate = (template: GameTemplate): boolean => {
  // 1. 無結構
  if (template.columns && template.columns.length > 0) {
    return false;
  }

  // 2. 無圖片
  if (template.imageId || template.cloudImageId || template.hasImage) {
    return false;
  }

  // 3. 無自訂顏色
  if (template.supportedColors && template.supportedColors.length > 0) {
    return false;
  }

  // 4. 未釘選
  if (template.isPinned) {
    return false;
  }

  return true;
};

/**
 * 計算遊戲贏家
 * @param players 玩家列表 (需包含 totalScore, isForceLost, tieBreaker 等狀態)
 * @param rule 勝負規則 (預設 HIGHEST_WINS)
 * @returns 贏家的 Player ID 陣列
 */
export const calculateWinners = (players: Player[], rule: ScoringRule = 'HIGHEST_WINS'): string[] => {
    let winnerIds: string[] = [];

    if (rule === 'COOP' || rule === 'COOP_NO_SCORE') {
        // 合作模式：只要沒人強制落敗，全員皆贏
        const anyForcedLost = players.some(p => p.isForceLost);
        if (!anyForcedLost) {
            winnerIds = players.map(p => p.id);
        }
        // 若有人強制落敗，則 winnerIds 為空 (全員輸)
    } else {
        // 競爭模式
        const validPlayers = players.filter(p => !p.isForceLost);
        
        if (validPlayers.length > 0) {
            let targetScore: number;
            
            if (rule === 'LOWEST_WINS') {
                targetScore = Math.min(...validPlayers.map(p => p.totalScore));
            } else {
                // HIGHEST_WINS, COMPETITIVE_NO_SCORE (treat as highest for ranking)
                targetScore = Math.max(...validPlayers.map(p => p.totalScore));
            }

            const candidates = validPlayers.filter(p => p.totalScore === targetScore);
            
            // Tie Breaker 邏輯
            const hasTieBreaker = candidates.some(p => p.tieBreaker);
            if (hasTieBreaker) {
                winnerIds = candidates.filter(p => p.tieBreaker).map(p => p.id);
            } else {
                winnerIds = candidates.map(p => p.id);
            }
        }
    }
    
    return winnerIds;
};

/**
 * 準備儲存模板 (處理內建模板分叉邏輯)
 * 
 * 邏輯：
 * 1. 執行資料遷移 (migrateTemplate) 確保結構最新。
 * 2. 檢查 ID 是否為內建 (透過 callback)。
 * 3. 若為內建，則自動產生新 ID 並設定 sourceTemplateId (分叉)。
 * 4. 若為一般模板，則直接回傳。
 * 
 * @param template 欲儲存的模板物件
 * @param checkIsBuiltin 非同步函式，檢查該 ID 是否為內建
 * @returns 準備好寫入 DB 的 GameTemplate (ID 可能已變更)
 */
export const prepareTemplateForSave = async (
    template: GameTemplate, 
    checkIsBuiltin: (id: string) => Promise<boolean>
): Promise<GameTemplate> => {
    // 確保結構正規化
    const migratedTemplate = migrateTemplate(template);
    
    // 檢查是否需要分叉 (Fork)
    const isBuiltin = await checkIsBuiltin(migratedTemplate.id);
    
    if (isBuiltin) {
        // 是內建模板 -> 建立副本
        const oldId = migratedTemplate.id;
        const newId = generateId();
        return {
            ...migratedTemplate,
            id: newId,
            sourceTemplateId: oldId
        };
    }
    
    // 一般模板 -> 直接回傳
    return migratedTemplate;
};
