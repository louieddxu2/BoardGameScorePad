
import { db } from '../../db';
import { COLORS } from '../../colors';
import { PlayerRecommendationWeights, CountRecommendationWeights, LocationRecommendationWeights, ColorRecommendationWeights } from '../../features/recommendation/types';
import { weightAdjustmentEngine } from '../../features/recommendation/WeightAdjustmentEngine';
import { ConfidenceCalculator } from '../../features/recommendation/ConfidenceCalculator';
import { DATA_LIMITS } from '../../dataLimits';
import { RelationMapper, RELATION_PREDICTION_CONFIG } from './RelationMapper';
import { RelationRanking } from './RelationRanking';
import { ResolvedEntity, RelationItem } from './types';
import { HistoryRecord } from '../../types';

export class RelationTrainer {
    
    /**
     * 訓練一般實體關聯 (Players, Locations, etc.)
     * 回傳 boolean: 全域權重是否發生變化 (需要存檔)
     */
    public async trainRelations(
        source: ResolvedEntity,
        targetCandidates: ResolvedEntity[],
        globalPlayerWeights: PlayerRecommendationWeights,
        globalCountWeights: CountRecommendationWeights,
        globalLocationWeights?: LocationRecommendationWeights // Optional for backward compatibility but recommended
    ): Promise<{ playerWeightsChanged: boolean, countWeightsChanged: boolean, locationWeightsChanged: boolean }> {
        let playerWeightsChanged = false;
        let countWeightsChanged = false;
        let locationWeightsChanged = false;

        // 1. 將目標對象依類型分組
        const targetsByType = new Map<string, string[]>();
        for (const target of targetCandidates) {
            const key = RelationMapper.getRelationKey(target.type);
            if (!targetsByType.has(key)) targetsByType.set(key, []);
            targetsByType.get(key)!.push(target.item.id);
        }

        this.ensureMeta(source);

        for (const [relKey, activeIds] of targetsByType.entries()) {
            const limit = (relKey === 'weekdays' || relKey === 'timeSlots' || relKey === 'playerCounts' || relKey === 'gameModes') 
                ? DATA_LIMITS.RELATION.TIME_LIST_SIZE 
                : DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE;

            // [READ] 讀取「舊」狀態快照
            const currentList = source.item.meta!.relations![relKey] as RelationItem[] | undefined;
            const currentConfidence = source.item.meta!.confidence![relKey] || 1.0;

            // [CALC] 根據 Config 取得正確的預測窗口大小
            // 如果是 Fixed 策略，Pool Size 不重要，但為了介面統一我們還是傳入
            const totalPoolSize = await this.getTotalPoolSize(relKey);
            const predictionWindow = RelationMapper.getPredictionWindow(relKey, totalPoolSize);

            // [LEARN 1] 調整全域權重 (Evaluate Prediction)
            
            // --- Player Prediction Learning ---
            if (relKey === 'players') {
                const factor = RelationMapper.getRecommendationFactor(source.type);
                if (factor) {
                    this.updateGlobalWeight(
                        currentList, 
                        activeIds, 
                        globalPlayerWeights as any, 
                        factor, 
                        predictionWindow, 
                        () => { playerWeightsChanged = true; }
                    );
                }
            }

            // --- Count Prediction Learning ---
            if (relKey === 'playerCounts') {
                const factor = RelationMapper.getCountRecommendationFactor(source.type);
                if (factor) {
                    this.updateGlobalWeight(
                        currentList, 
                        activeIds, 
                        globalCountWeights as any, 
                        factor, 
                        predictionWindow, 
                        () => { countWeightsChanged = true; }
                    );
                }
            }

            // --- Location Prediction Learning ---
            if (relKey === 'locations' && globalLocationWeights) {
                const factor = RelationMapper.getLocationRecommendationFactor(source.type);
                if (factor) {
                    this.updateGlobalWeight(
                        currentList,
                        activeIds,
                        globalLocationWeights as any,
                        factor,
                        predictionWindow,
                        () => { locationWeightsChanged = true; }
                    );
                }
            }

            // [LEARN 2] 計算新的信心值
            let newConfidence: number;
            if (source.item.id === 'current_session') {
                newConfidence = 5.0; // 短期記憶固定高信心
            } else {
                newConfidence = ConfidenceCalculator.calculate(
                    currentList,
                    activeIds,
                    currentConfidence,
                    predictionWindow // 傳入統一計算後的窗口
                );
            }

            // [UPDATE] 更新排名與狀態 (Mutation)
            const newList = RelationRanking.update(currentList, activeIds, limit);
            
            // 寫入變更
            source.item.meta!.relations![relKey] = newList;
            source.item.meta!.confidence![relKey] = newConfidence;
        }

        return { playerWeightsChanged, countWeightsChanged, locationWeightsChanged };
    }

    // Helper to reduce code duplication in weight updates
    private updateGlobalWeight(
        currentList: RelationItem[] | undefined,
        activeIds: string[],
        weightsObj: Record<string, number>,
        factorKey: string,
        windowSize: number,
        onChange: () => void
    ) {
        const historyLength = currentList ? currentList.length : 0;
        
        const penaltyFactor = historyLength <= windowSize
            ? (windowSize > 0 ? historyLength / windowSize : 0)
            : 1.0;

        const predictionPool = new Set(
            (currentList || []).slice(0, windowSize).map(r => r.id)
        );

        for (const id of activeIds) {
            const isHit = predictionPool.has(id);
            const oldWeight = weightsObj[factorKey];
            const newWeight = weightAdjustmentEngine.calculateNewWeight(oldWeight, isHit, penaltyFactor);
            
            if (oldWeight !== newWeight) {
                weightsObj[factorKey] = newWeight;
                onChange();
            }
        }
    }

    /**
     * 訓練顏色偏好統計
     * [Updated] Now supports Global Weight Training
     */
    public async trainColors(
        source: ResolvedEntity, 
        players: HistoryRecord['players'],
        globalColorWeights: ColorRecommendationWeights
    ): Promise<{ itemChanged: boolean, weightChanged: boolean }> {
        let colorsToAdd: string[] = [];
        let weightChanged = false;

        // 過濾有效玩家
        const validPlayers = players.filter(p => {
            const isSystemId = p.id.startsWith('sys_player_') || p.id.startsWith('slot_') || p.id.startsWith('player_');
            const isDefaultName = /^玩家\s?\d+$/.test(p.name);
            return !isSystemId || !isDefaultName;
        });

        // [Filter] Only include colors explicitly set by user (Noise Filter)
        const manualColorPlayers = validPlayers.filter(p => p.isColorManuallySet);

        if (source.type === 'game') {
            colorsToAdd = manualColorPlayers.map(p => p.color).filter(c => c && c !== 'transparent');
        } else if (source.type === 'player') {
            const matchingSlots = manualColorPlayers.filter(p => {
                const isPlaceholder = p.id.startsWith('slot_') || p.id.startsWith('sys_') || p.id.startsWith('player_');
                const targetId = p.linkedPlayerId || (!isPlaceholder ? p.id : undefined);
                return (targetId && source.item.id === targetId) || source.item.name === p.name;
            });
            colorsToAdd = matchingSlots.map(p => p.color).filter(c => c && c !== 'transparent');
        }

        if (colorsToAdd.length > 0) {
            this.ensureMeta(source);
            const relKey = 'colors';
            
            // [READ]
            const currentList = source.item.meta!.relations![relKey] as RelationItem[] | undefined;
            const currentConfidence = source.item.meta!.confidence![relKey] || 1.0;
            
            // Get Config Window
            const totalPoolSize = COLORS.length;
            const predictionWindow = RelationMapper.getPredictionWindow(relKey, totalPoolSize);

            // [LEARN 1] Update Global Weights
            const factor = RelationMapper.getColorRecommendationFactor(source.type);
            if (factor) {
                this.updateGlobalWeight(
                    currentList,
                    colorsToAdd,
                    globalColorWeights as any,
                    factor,
                    predictionWindow,
                    () => { weightChanged = true; }
                );
            }

            // [LEARN 2] Calculate Confidence
            const newConfidence = ConfidenceCalculator.calculate(
                currentList,
                colorsToAdd, 
                currentConfidence,
                predictionWindow
            );

            // [UPDATE] Update List
            source.item.meta!.relations![relKey] = RelationRanking.update(
                currentList,
                colorsToAdd, 
                DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE
            );
            
            source.item.meta!.confidence![relKey] = newConfidence;
            return { itemChanged: true, weightChanged };
        }
        return { itemChanged: false, weightChanged: false };
    }

    private ensureMeta(source: ResolvedEntity) {
        if (!source.item.meta) source.item.meta = {};
        if (!source.item.meta.relations || Array.isArray(source.item.meta.relations)) {
            source.item.meta.relations = {};
        }
        if (!source.item.meta.confidence) {
            source.item.meta.confidence = {};
        }
    }

    private async getTotalPoolSize(relKey: string): Promise<number> {
        switch (relKey) {
            case 'players': return await db.savedPlayers.count();
            case 'games': return await db.savedGames.count();
            case 'locations': return await db.savedLocations.count();
            case 'weekdays': return 7;
            case 'timeSlots': return 8;
            case 'playerCounts': return 24; 
            case 'gameModes': return 5;
            case 'colors': return COLORS.length;
            default: return 100; 
        }
    }
}

export const relationTrainer = new RelationTrainer();
