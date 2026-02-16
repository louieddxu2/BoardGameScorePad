
interface RelationItem {
    id: string;
    count: number;
}

/**
 * 信心值計算機
 * 用於動態調整關聯強度的可信度。
 * 
 * 原理：
 * 在將新資料寫入資料庫「之前」，先評估系統根據舊資料所做的預測是否準確。
 * - 預測準確 (Hit)：代表此關聯具有高度重複性 -> 增加信心。
 * - 預測失準 (Miss)：代表此關聯變動大或模式已改變 -> 降低信心。
 */
export class ConfidenceCalculator {
    
    private static readonly MIN_CONFIDENCE = 0.2;
    private static readonly MAX_CONFIDENCE = 5.0;
    
    // 基礎步長設定
    private static readonly BASE_STEP_NORMAL = 0.1;
    private static readonly BASE_STEP_OMNI = 0.5;
    
    // 懲罰設定 (加重扣分，讓錯誤更敏感)
    private static readonly PENALTY_STEP = 0.2;

    // 阻尼啟動門檻 (Damping Thresholds)
    // 只有當分數與次數同時超過此值時，才開始減少加分幅度 (解決飽和問題)
    private static readonly DAMPING_START_SCORE = 3.0;
    private static readonly DAMPING_START_HISTORY = 10;

    /**
     * 計算新的信心值
     * 
     * @param currentRelationList 目前資料庫中已存在的關聯列表 (已排序)
     * @param incomingIds 本次遊戲產生的新 ID 陣列 (例如本次遊玩的玩家 ID)
     * @param currentConfidence 當前的信心值 (預設 1.0)
     * @param predictionWindowSize 預測窗口大小 (Top N)。由外部 Config 決定。
     * @returns 調整後的新信心值
     */
    public static calculate(
        currentRelationList: RelationItem[] | undefined,
        incomingIds: string[],
        currentConfidence: number = 1.0,
        predictionWindowSize: number
    ): number {
        // 1. 冷啟動保護：如果沒有舊資料，代表無法進行預測，保持原信心值
        if (!currentRelationList || currentRelationList.length === 0) {
            return currentConfidence;
        }

        const historyLength = currentRelationList.length;

        // 2. 建立預測集合 (Top N)
        // 使用外部傳入的 window size (例如：人數=3, 玩家=5)
        const topN = currentRelationList.slice(0, predictionWindowSize);
        const predictionSet = new Set(topN.map(item => item.id));

        // 3. 決定基礎步長 (Small Pool Boost)
        // 若 L <= N：全知視角 (0.5)，否則標準預測 (0.1)
        const baseStep = historyLength <= predictionWindowSize 
            ? this.BASE_STEP_OMNI 
            : this.BASE_STEP_NORMAL;

        // Penalty Damping Factor (覆蓋率係數)
        // 如果歷史資料量還不足以填滿預測窗口，我們對「預測失敗」給予較小的懲罰
        const penaltyFactor = historyLength <= predictionWindowSize 
            ? (predictionWindowSize > 0 ? historyLength / predictionWindowSize : 0)
            : 1.0;

        // 4. 計算阻尼係數 (Growth Damping Factor)
        let growthDampingFactor = 1.0;
        
        if (currentConfidence >= this.DAMPING_START_SCORE && historyLength >= this.DAMPING_START_HISTORY) {
            growthDampingFactor = 1.0 - (currentConfidence / this.MAX_CONFIDENCE);
        }

        let delta = 0;

        // 5. 評估本次輸入
        for (const id of incomingIds) {
            if (predictionSet.has(id)) {
                // Hit: 基礎步長 * 成長阻尼
                delta += baseStep * growthDampingFactor;
            } else {
                // Miss: 懲罰步長 * 懲罰阻尼 (覆蓋率)
                delta -= this.PENALTY_STEP * penaltyFactor;
            }
        }

        // 6. 計算並限制範圍
        const newScore = currentConfidence + delta;
        const roundedScore = Math.round(newScore * 100) / 100;

        return Math.max(this.MIN_CONFIDENCE, Math.min(this.MAX_CONFIDENCE, roundedScore));
    }
}
