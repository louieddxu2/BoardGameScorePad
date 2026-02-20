
import { db } from '../db';
import { HistoryRecord, AnalyticsLog } from '../types';
import { weightAdjustmentEngine, PLAYER_WEIGHTS_ID, COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID, COLOR_WEIGHTS_ID } from '../features/recommendation/WeightAdjustmentEngine';
import { PlayerRecommendationWeights, DEFAULT_PLAYER_WEIGHTS, CountRecommendationWeights, DEFAULT_COUNT_WEIGHTS, LocationRecommendationWeights, DEFAULT_LOCATION_WEIGHTS, ColorRecommendationWeights, DEFAULT_COLOR_WEIGHTS } from '../features/recommendation/types';

import { ResolvedEntity } from './relationship/types';
import { trainingContextResolver } from './relationship/TrainingContextResolver';
import { relationTrainer } from './relationship/RelationTrainer';
import { HistoryBatchProcessor } from './relationship/HistoryBatchProcessor';

class RelationshipService {

    /**
     * 批次處理歷史紀錄
     * 將邏輯委派給 HistoryBatchProcessor
     */
    public async processHistoryBatch(records: HistoryRecord[]): Promise<void> {
        const processor = new HistoryBatchProcessor();
        return processor.run(records);
    }

    public async processGameEnd(record: HistoryRecord): Promise<void> {
        console.log(`[RelationshipService] Checking record: ${record.gameName} (${record.id})`);

        try {
            // 1. Check Log Status
            const log = await db.analyticsLogs.get(record.id);
            let mode: 'full' | 'location_only' | 'skip' = 'full';

            if (log) {
                if (log.status === 'processed') {
                    mode = 'skip';
                } else if (log.status === 'missing_location') {
                    if (record.location) {
                        mode = 'location_only';
                    } else {
                        mode = 'skip'; 
                    }
                }
            } else {
                mode = 'full';
            }

            if (mode === 'skip') {
                return;
            }

            console.log(`[RelationshipService] Processing mode: ${mode}`);

            // Transaction Scope
            await (db as any).transaction('rw', db.savedPlayers, db.savedGames, db.savedLocations, db.savedWeekdays, db.savedTimeSlots, db.savedPlayerCounts, db.savedGameModes, db.savedCurrentSession, db.analyticsLogs, db.bggGames, db.weights, async () => {
                
                // --- 2. 解析實體 ---
                const resolvedEntities = await trainingContextResolver.resolve(record, mode as 'full' | 'location_only');
                const newContextEntities = resolvedEntities.filter(e => e.isNewContext);

                // --- 3. 執行統計更新 ---
                
                // Load Current Global Weights (All types)
                const globalPlayerWeights = await weightAdjustmentEngine.getWeights<PlayerRecommendationWeights>(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS);
                const globalCountWeights = await weightAdjustmentEngine.getWeights<CountRecommendationWeights>(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS);
                const globalLocationWeights = await weightAdjustmentEngine.getWeights<LocationRecommendationWeights>(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS);
                const globalColorWeights = await weightAdjustmentEngine.getWeights<ColorRecommendationWeights>(COLOR_WEIGHTS_ID, DEFAULT_COLOR_WEIGHTS);
                
                let playerWeightsDirty = false;
                let countWeightsDirty = false;
                let locationWeightsDirty = false;
                let colorWeightsDirty = false;

                if (resolvedEntities.length > 0) {
                    for (const source of resolvedEntities) {
                        let hasChanges = false;

                        // 3.1 基礎計數更新 (只針對 New Context)
                        if (source.isNewContext) {
                            source.item.usageCount = (source.item.usageCount || 0) + 1;
                            source.item.lastUsed = Math.max(source.item.lastUsed, record.endTime);
                            hasChanges = true;
                        }

                        // 3.2 關聯更新
                        let targetCandidates: ResolvedEntity[] = [];
                        if (source.isNewContext) {
                            targetCandidates = resolvedEntities.filter(t => t.item.id !== source.item.id);
                        } else {
                            targetCandidates = newContextEntities;
                        }

                        if (targetCandidates.length > 0) {
                            // [Refactor] 委派給 RelationTrainer
                            // 傳入三組權重，Trainer 會自動判斷要更新哪一組
                            const result = await relationTrainer.trainRelations(
                                source, 
                                targetCandidates, 
                                globalPlayerWeights, 
                                globalCountWeights,
                                globalLocationWeights
                            );
                            
                            if (result.playerWeightsChanged) playerWeightsDirty = true;
                            if (result.countWeightsChanged) countWeightsDirty = true;
                            if (result.locationWeightsChanged) locationWeightsDirty = true;
                            
                            hasChanges = true;
                        }
                        
                        // 3.3 顏色統計 
                        if (source.isNewContext && (source.type === 'game' || source.type === 'player')) {
                            // [Refactor] 委派給 RelationTrainer
                            const colorResult = await relationTrainer.trainColors(
                                source, 
                                record.players, 
                                globalColorWeights
                            );
                            if (colorResult.itemChanged) hasChanges = true;
                            if (colorResult.weightChanged) colorWeightsDirty = true;
                        }

                        if (hasChanges) {
                            await source.table.put(source.item);
                        }
                    }
                }

                // Save Global Weights if changed
                if (playerWeightsDirty) {
                    await weightAdjustmentEngine.saveWeights(PLAYER_WEIGHTS_ID, globalPlayerWeights);
                }
                if (countWeightsDirty) {
                    await weightAdjustmentEngine.saveWeights(COUNT_WEIGHTS_ID, globalCountWeights);
                }
                if (locationWeightsDirty) {
                    await weightAdjustmentEngine.saveWeights(LOCATION_WEIGHTS_ID, globalLocationWeights);
                }
                if (colorWeightsDirty) {
                    await weightAdjustmentEngine.saveWeights(COLOR_WEIGHTS_ID, globalColorWeights);
                }

                // --- 4. Update Log ---
                const newStatus: AnalyticsLog['status'] = record.location ? 'processed' : 'missing_location';
                await db.analyticsLogs.put({
                    historyId: record.id,
                    status: newStatus,
                    lastProcessedAt: Date.now()
                });

            });
            console.log("[RelationshipService] Update complete.");

        } catch (error) {
            console.error("[RelationshipService] Failed:", error);
        }
    }
}

export const relationshipService = new RelationshipService();
