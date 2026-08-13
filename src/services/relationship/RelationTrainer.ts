
import { db } from '../../db';
import { COLORS } from '../../colors';
import { PlayerRecommendationWeights, CountRecommendationWeights, LocationRecommendationWeights, ColorRecommendationWeights } from '../../features/recommendation/types';
import { weightAdjustmentEngine } from '../../features/recommendation/WeightAdjustmentEngine';
import { ConfidenceCalculator } from '../../features/recommendation/ConfidenceCalculator';
import { DATA_LIMITS } from '../../dataLimits';
import { RelationMapper } from './RelationMapper';
import { RelationRanking } from './RelationRanking';
import { ResolvedEntity, RelationItem } from './types';
import { HistoryRecord } from '../../types';
import { RankVotingPolicy } from './RankVotingPolicy';

export class RelationTrainer {

    /**
     * 訓練一般實體關聯 (Players, Locations, etc.)
     * 回傳 boolean: 全域權重是否發生變化 (需要存檔)
     * 
     * @param overridePoolSizes (Optional) 批次處理時傳入的快取總數，避免頻繁查詢 DB
     */
    public async trainRelations(
        source: ResolvedEntity,
        targetCandidates: ResolvedEntity[],
        globalPlayerWeights: PlayerRecommendationWeights,
        globalCountWeights: CountRecommendationWeights,
        globalLocationWeights?: LocationRecommendationWeights,
        overridePoolSizes?: Record<string, number>
    ): Promise<{ playerWeightsChanged: boolean, countWeightsChanged: boolean, locationWeightsChanged: boolean }> {
        let playerWeightsChanged = false;
        let countWeightsChanged = false;
        let locationWeightsChanged = false;

        // 1. 將目標對象依類型分組
        const targetsByType = new Map<string, string[]>();
        const sourceKey = RelationMapper.getRelationKey(source.type);
        for (const target of targetCandidates) {
            if (target.canBeRelationTarget === false) continue;
            if (target.relationSourceScope && !target.relationSourceScope.includes(sourceKey)) continue;
            const key = RelationMapper.getRelationKey(target.type);
            if (source.relationTargetScope && !source.relationTargetScope.includes(key)) continue;
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
            const currentRankWeights = source.item.meta!.rankWeights![relKey];

            // [CALC] 根據 Config 取得正確的預測窗口大小
            // 優化：如果提供了 overridePoolSizes，直接使用，否則查詢 DB
            let totalPoolSize = 100;
            if (overridePoolSizes && overridePoolSizes[relKey] !== undefined) {
                totalPoolSize = overridePoolSizes[relKey];
            } else {
                totalPoolSize = await this.getTotalPoolSize(relKey);
            }

            // N is shared by training and voting. Dynamic relations therefore use
            // the same pool-based window (for example, 25% capped at five).
            const votingLimit = RelationMapper.getVotingLimit(relKey, totalPoolSize);
            const predictionWindow = votingLimit;
            const rankedPredictionList = RankVotingPolicy.rankCandidates(currentList, currentRankWeights, votingLimit);

            // [LEARN 1] 調整全域權重 (Evaluate Prediction)

            // --- Player Prediction Learning ---
            if (relKey === 'players') {
                const factor = RelationMapper.getRecommendationFactor(source.type);
                if (factor) {
                    this.updateGlobalWeight(
                        rankedPredictionList,
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
                        rankedPredictionList,
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
                        rankedPredictionList,
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
                    rankedPredictionList,
                    activeIds,
                    currentConfidence,
                    predictionWindow
                );
            }

            // [UPDATE] 更新排名與狀態 (Mutation)
            const newList = RelationRanking.update(currentList, activeIds, limit);
            const newRankWeights = RankVotingPolicy.adjustWeights(currentList, activeIds, currentRankWeights, votingLimit);

            // 寫入變更
            source.item.meta!.relations![relKey] = newList;
            source.item.meta!.confidence![relKey] = newConfidence;
            source.item.meta!.rankWeights![relKey] = newRankWeights;
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
        globalColorWeights: ColorRecommendationWeights,
        overridePoolSizes?: Record<string, number>
    ): Promise<{ itemChanged: boolean, weightChanged: boolean }> {
        let colorsToAdd: string[] = [];
        let weightChanged = false;

        // 過濾有效玩家
        const validPlayers = players.filter(p => {
            const isSystemId = p.id.startsWith('sys_player_') || p.id.startsWith('slot_') || p.id.startsWith('player_');
            const isDefaultName = /^(玩家|Player)\s?\d+$/.test(p.name);
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
            const currentRankWeights = source.item.meta!.rankWeights![relKey];

            // Get Config Window
            let totalPoolSize = COLORS.length;
            if (overridePoolSizes && overridePoolSizes[relKey] !== undefined) {
                totalPoolSize = overridePoolSizes[relKey];
            }

            const votingLimit = RelationMapper.getVotingLimit(relKey, totalPoolSize);
            const predictionWindow = votingLimit;
            const rankedPredictionList = RankVotingPolicy.rankCandidates(currentList, currentRankWeights, votingLimit);

            // [LEARN 1] Update Global Weights
            const factor = RelationMapper.getColorRecommendationFactor(source.type);
            if (factor) {
                this.updateGlobalWeight(
                    rankedPredictionList,
                    colorsToAdd,
                    globalColorWeights as any,
                    factor,
                    predictionWindow,
                    () => { weightChanged = true; }
                );
            }

            // [LEARN 2] Calculate Confidence
            const newConfidence = ConfidenceCalculator.calculate(
                rankedPredictionList,
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
            source.item.meta!.rankWeights![relKey] = RankVotingPolicy.adjustWeights(
                currentList,
                colorsToAdd,
                currentRankWeights,
                votingLimit
            );
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
        if (!source.item.meta.rankWeights) {
            source.item.meta.rankWeights = {};
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
