
import { db } from '../../db';
import Dexie, { Table } from 'dexie';
import { HistoryRecord, AnalyticsLog, SavedListItem, Player } from '../../types';
import { weightAdjustmentEngine, PLAYER_WEIGHTS_ID, COUNT_WEIGHTS_ID, LOCATION_WEIGHTS_ID, COLOR_WEIGHTS_ID } from '../../features/recommendation/WeightAdjustmentEngine';
import { PlayerRecommendationWeights, DEFAULT_PLAYER_WEIGHTS, CountRecommendationWeights, DEFAULT_COUNT_WEIGHTS, LocationRecommendationWeights, DEFAULT_LOCATION_WEIGHTS, ColorRecommendationWeights, DEFAULT_COLOR_WEIGHTS } from '../../features/recommendation/types';
import { relationTrainer } from './RelationTrainer';
import { COLORS } from '../../colors';
import { ResolvedEntity, EntityType } from './types';
import { generateId } from '../../utils/idGenerator';
import { DATA_LIMITS } from '../../dataLimits';
import { getRecordScoringRule, getRecordBggId } from '../../utils/historyUtils';

/**
 * 歷史紀錄批次處理器 (High Performance Version)
 * 策略：Harvest (採集) -> Bulk Load (預載) -> In-Memory Process (記憶體運算) -> Bulk Write (批次寫入)
 * 目的：將資料庫 I/O 從 O(N) 降為 O(1)，解決手機端效能瓶頸。
 */
export class HistoryBatchProcessor {
    
    public async run(records: HistoryRecord[]): Promise<void> {
        if (records.length === 0) return;

        console.time("BatchProcess");

        await (db as any).transaction('rw', db.savedPlayers, db.savedGames, db.savedLocations, db.savedWeekdays, db.savedTimeSlots, db.savedPlayerCounts, db.savedGameModes, db.savedCurrentSession, db.analyticsLogs, db.bggGames, db.weights, async () => {
            
            // --- 1. Pre-load Fixed Dimensions (Read All) ---
            // 這些維度資料量小，一次全讀取比反覆查詢快得多
            const [weekdays, timeSlots, playerCounts, gameModes] = await Promise.all([
                db.savedWeekdays.toArray(),
                db.savedTimeSlots.toArray(),
                db.savedPlayerCounts.toArray(),
                db.savedGameModes.toArray()
            ]);

            // 建立 ID 索引 Map
            const mapById = new Map<string, SavedListItem>();
            const addAllToMap = (items: SavedListItem[]) => items.forEach(i => mapById.set(i.id, i));
            
            addAllToMap(weekdays);
            addAllToMap(timeSlots);
            addAllToMap(playerCounts);
            addAllToMap(gameModes);

            // --- 2. Harvest Context from Records (採集階段) ---
            const gameIds = new Set<string>();
            const gameNames = new Set<string>();
            const gameBggIds = new Set<string>();
            
            const locationIds = new Set<string>();
            const locationNames = new Set<string>();
            
            const playerIds = new Set<string>();
            const playerNames = new Set<string>();

            // 預先過濾 Log 狀態
            const recordIds = records.map(r => r.id);
            const logs = await db.analyticsLogs.bulkGet(recordIds);
            
            const logsMap = new Map<string, AnalyticsLog>();
            logs.forEach(l => {
                if (l) logsMap.set(l.historyId, l);
            });

            const recordsToProcess: { record: HistoryRecord, mode: 'full' | 'location_only' }[] = [];

            for (const record of records) {
                const log = logsMap.get(record.id);
                let mode: 'full' | 'location_only' | 'skip' = 'full';

                if (log) {
                    if (log.status === 'processed') mode = 'skip';
                    else if (log.status === 'missing_location') mode = record.location ? 'location_only' : 'skip';
                }

                if (mode === 'skip') continue;
                recordsToProcess.push({ record, mode });

                // Harvest Logic
                const bggId = getRecordBggId(record);
                if (record.templateId) gameIds.add(record.templateId); 
                if (record.gameName) gameNames.add(record.gameName.trim());
                if (bggId) gameBggIds.add(bggId);

                if (record.locationId) locationIds.add(record.locationId);
                if (record.location) locationNames.add(record.location.trim());

                if (mode === 'full') {
                    for (const p of record.players) {
                         const isSlotId = p.id.startsWith('slot_') || p.id.startsWith('player_');
                         const isSystemId = p.id.startsWith('sys_player_'); 
                         const isDefaultName = /^玩家\s?\d+$/.test(p.name);
                         
                         // Skip pure placeholders
                         if ((isSlotId || isSystemId) && isDefaultName && !p.linkedPlayerId) continue;
                         
                         if (p.linkedPlayerId) playerIds.add(p.linkedPlayerId);
                         else if (!isSlotId && !isSystemId) playerIds.add(p.id);
                         
                         if (p.name) playerNames.add(p.name.trim());
                    }
                }
            }

            if (recordsToProcess.length === 0) return;

            // --- 3. Bulk Fetch Dynamic Entities (預載階段) ---
            
            // Helper: Safe fetch that handles empty sets to avoid 'anyOf([])' crash
            const safeFetch = async (
                table: Table<SavedListItem>, 
                ids: Set<string>, 
                names: Set<string>, 
                bggIds?: Set<string>
            ) => {
                const tasks: Promise<SavedListItem[] | (SavedListItem | undefined)[]>[] = [];
                
                if (ids.size > 0) tasks.push(table.bulkGet([...ids]));
                if (names.size > 0) tasks.push(table.where('name').anyOf([...names]).toArray());
                if (bggIds && bggIds.size > 0) tasks.push(table.where('bggId').anyOf([...bggIds]).toArray());
                
                const results = await Promise.all(tasks);
                // Flatten and remove undefined/null
                return results.flat().filter((i): i is SavedListItem => !!i);
            };

            const [
                existingGames,
                existingLocations,
                existingPlayers,
                totalGamesCount,
                totalLocationsCount,
                totalPlayersCount
            ] = await Promise.all([
                safeFetch(db.savedGames, gameIds, gameNames, gameBggIds),
                safeFetch(db.savedLocations, locationIds, locationNames),
                safeFetch(db.savedPlayers, playerIds, playerNames),
                db.savedGames.count(),
                db.savedLocations.count(),
                db.savedPlayers.count()
            ]);

            // Add fetched items to Main Map and Name Maps
            addAllToMap(existingGames);
            addAllToMap(existingLocations);
            addAllToMap(existingPlayers);

            const mapByName = new Map<string, SavedListItem>(); // Key format: "type:name"
            const mapByBggId = new Map<string, SavedListItem>(); // Key: bggId

            const indexItem = (item: SavedListItem, type: EntityType) => {
                mapByName.set(`${type}:${item.name.trim().toLowerCase()}`, item);
                if (type === 'game' && item.bggId) mapByBggId.set(item.bggId, item);
            };

            existingGames.forEach(i => indexItem(i, 'game'));
            existingLocations.forEach(i => indexItem(i, 'location'));
            existingPlayers.forEach(i => indexItem(i, 'player'));

            // --- 4. Prepare Tracking State (追蹤修改) ---
            // 分別追蹤不同 Table 的修改，以便最後 bulkPut
            const modifiedGames = new Map<string, SavedListItem>();
            const modifiedPlayers = new Map<string, SavedListItem>();
            const modifiedLocations = new Map<string, SavedListItem>();
            const modifiedWeekdays = new Map<string, SavedListItem>();
            const modifiedTimeSlots = new Map<string, SavedListItem>();
            const modifiedPlayerCounts = new Map<string, SavedListItem>();
            const modifiedGameModes = new Map<string, SavedListItem>();

            const markDirty = (item: SavedListItem, type: EntityType) => {
                if (type === 'game') modifiedGames.set(item.id, item);
                else if (type === 'player') modifiedPlayers.set(item.id, item);
                else if (type === 'location') modifiedLocations.set(item.id, item);
                else if (type === 'weekday') modifiedWeekdays.set(item.id, item);
                else if (type === 'timeslot') modifiedTimeSlots.set(item.id, item);
                else if (type === 'playerCount') modifiedPlayerCounts.set(item.id, item);
                else if (type === 'gameMode') modifiedGameModes.set(item.id, item);
            };
            
            // Pool Sizes (Base + New Created)
            const poolSizes = {
                players: totalPlayersCount,
                games: totalGamesCount,
                locations: totalLocationsCount,
                weekdays: 7,
                timeSlots: 8,
                playerCounts: 24,
                gameModes: 5,
                colors: COLORS.length
            };

            // Global Weights
            const globalPlayerWeights = await weightAdjustmentEngine.getWeights<PlayerRecommendationWeights>(PLAYER_WEIGHTS_ID, DEFAULT_PLAYER_WEIGHTS);
            const globalCountWeights = await weightAdjustmentEngine.getWeights<CountRecommendationWeights>(COUNT_WEIGHTS_ID, DEFAULT_COUNT_WEIGHTS);
            const globalLocationWeights = await weightAdjustmentEngine.getWeights<LocationRecommendationWeights>(LOCATION_WEIGHTS_ID, DEFAULT_LOCATION_WEIGHTS);
            const globalColorWeights = await weightAdjustmentEngine.getWeights<ColorRecommendationWeights>(COLOR_WEIGHTS_ID, DEFAULT_COLOR_WEIGHTS);
            
            let playerWeightsDirty = false;
            let countWeightsDirty = false;
            let locationWeightsDirty = false;
            let colorWeightsDirty = false;

            const logUpdates: AnalyticsLog[] = [];

            // *** In-Memory Resolver Helper ***
            // 模擬 EntityService 的 resolveOrCreate 邏輯，但操作記憶體物件
            const resolveInMemory = (
                type: EntityType, 
                name: string | undefined, 
                preferredId?: string, 
                bggId?: string
            ): SavedListItem | null => {
                if (!name) return null;
                const cleanName = name.trim();
                const lowerName = cleanName.toLowerCase();

                // 1. Try Preferred ID
                if (preferredId && mapById.has(preferredId)) return mapById.get(preferredId)!;

                // 2. Try BGG ID (Games)
                if (type === 'game' && bggId && mapByBggId.has(bggId)) return mapByBggId.get(bggId)!;

                // 3. Try Name
                const key = `${type}:${lowerName}`;
                if (mapByName.has(key)) return mapByName.get(key)!;

                // 4. Create New (Cache Miss)
                const newId = preferredId || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                const newItem: SavedListItem = {
                    id: newId,
                    name: cleanName,
                    lastUsed: 0,
                    usageCount: 0,
                    bggId: (type === 'game' ? bggId : undefined),
                    meta: { relations: {}, confidence: {} }
                };

                // Update Indexes & Mark Dirty
                mapById.set(newId, newItem);
                mapByName.set(key, newItem);
                if (type === 'game' && bggId) mapByBggId.set(bggId, newItem);
                
                markDirty(newItem, type);

                // Increment Pool Size immediately for accurate calculation
                if (type === 'game') poolSizes.games++;
                if (type === 'player') poolSizes.players++;
                if (type === 'location') poolSizes.locations++;

                return newItem;
            };

            // --- 5. Process Loop (運算階段) ---
            for (const { record, mode } of recordsToProcess) {
                const resolvedEntities: ResolvedEntity[] = [];
                const isFull = mode === 'full';

                // A. Location
                if (record.location) {
                    const item = resolveInMemory('location', record.location, record.locationId);
                    if (item) resolvedEntities.push({ item, table: db.savedLocations, type: 'location', isNewContext: true });
                }

                // B. Game
                const recBggId = getRecordBggId(record);
                const itemGame = resolveInMemory('game', record.gameName, undefined, recBggId);
                if (itemGame) resolvedEntities.push({ item: itemGame, table: db.savedGames, type: 'game', isNewContext: isFull });

                // C. Players
                if (isFull) {
                    const validPlayers = record.players.filter(p => {
                        const isSlotId = p.id.startsWith('slot_') || p.id.startsWith('player_');
                        const isSystemId = p.id.startsWith('sys_player_'); 
                        const isDefaultName = /^玩家\s?\d+$/.test(p.name);
                        if ((isSlotId || isSystemId) && isDefaultName && !p.linkedPlayerId) return false;
                        return true;
                    });

                    for (const p of validPlayers) {
                        const isPlaceholderId = p.id.startsWith('slot_') || p.id.startsWith('player_') || p.id.startsWith('sys_');
                        const targetId = p.linkedPlayerId || (!isPlaceholderId ? p.id : undefined);
                        const itemP = resolveInMemory('player', p.name, targetId);
                        if (itemP) resolvedEntities.push({ item: itemP, table: db.savedPlayers, type: 'player', isNewContext: isFull });
                    }
                }

                // D. Fixed Dimensions
                if (isFull) {
                    const date = new Date(record.endTime);
                    const dayIndex = date.getDay(); 
                    const hour = date.getHours();
                    const slotIndex = Math.floor(hour / 3); 
                    
                    const startH = String(slotIndex * 3).padStart(2, '0');
                    const endH = String((slotIndex + 1) * 3).padStart(2, '0');
                    const timeSlotName = `${startH}-${endH}`;
                    const playerCount = record.players.length;
                    const rule = getRecordScoringRule(record);

                    // Helper to ensure fixed entities exist (Upsert logic for empty DB)
                    const resolveFixed = (id: string, name: string, type: EntityType, table: Table<SavedListItem>) => {
                        let item = mapById.get(id);
                        if (!item) {
                            item = {
                                id,
                                name,
                                lastUsed: 0,
                                usageCount: 0,
                                meta: { relations: {}, confidence: {} }
                            };
                            mapById.set(id, item);
                            markDirty(item, type);
                        }
                        resolvedEntities.push({ item, table, type, isNewContext: true });
                    };

                    resolveFixed(`weekday_${dayIndex}`, dayIndex.toString(), 'weekday', db.savedWeekdays);
                    resolveFixed(`timeslot_${slotIndex}`, timeSlotName, 'timeslot', db.savedTimeSlots);
                    
                    if (playerCount > 0) {
                        resolveFixed(`count_${playerCount}`, playerCount.toString(), 'playerCount', db.savedPlayerCounts);
                    }

                    resolveFixed(rule, rule, 'gameMode', db.savedGameModes);
                }

                // Note: Skip Session Context for Batch (Short-term memory not needed for historical data)

                // --- Train Relations ---
                const newContextEntities = resolvedEntities.filter(e => e.isNewContext);
                
                if (resolvedEntities.length > 0) {
                    for (const source of resolvedEntities) {
                        let entityChanged = false;

                        // Usage Count
                        if (source.isNewContext) {
                            source.item.usageCount = (source.item.usageCount || 0) + 1;
                            source.item.lastUsed = Math.max(source.item.lastUsed, record.endTime);
                            entityChanged = true;
                        }

                        // Relations
                        let targetCandidates: ResolvedEntity[] = [];
                        if (source.isNewContext) {
                            targetCandidates = resolvedEntities.filter(t => t.item.id !== source.item.id);
                        } else {
                            targetCandidates = newContextEntities;
                        }

                        if (targetCandidates.length > 0) {
                            // [Critical Fix] Wrap non-DB async work with Dexie.waitFor to prevent transaction commit
                            const result = await Dexie.waitFor(relationTrainer.trainRelations(
                                source, 
                                targetCandidates, 
                                globalPlayerWeights, 
                                globalCountWeights, 
                                globalLocationWeights,
                                poolSizes // Use current pool sizes
                            ));
                            
                            if (result.playerWeightsChanged) playerWeightsDirty = true;
                            if (result.countWeightsChanged) countWeightsDirty = true;
                            if (result.locationWeightsChanged) locationWeightsDirty = true;
                            
                            entityChanged = true;
                        }

                        // Colors
                        if (source.isNewContext && (source.type === 'game' || source.type === 'player')) {
                             // [Critical Fix] Wrap non-DB async work with Dexie.waitFor
                             const colorResult = await Dexie.waitFor(relationTrainer.trainColors(
                                source, 
                                record.players, 
                                globalColorWeights,
                                poolSizes
                            ));
                            if (colorResult.itemChanged) entityChanged = true;
                            if (colorResult.weightChanged) colorWeightsDirty = true;
                        }

                        // Mark dirty if changed
                        if (entityChanged) {
                            markDirty(source.item, source.type);
                        }
                    }
                }

                // Prepare Log Update
                logUpdates.push({
                    historyId: record.id,
                    status: record.location ? 'processed' : 'missing_location',
                    lastProcessedAt: Date.now()
                });
            } // End Loop

            // --- 6. Bulk Write Back (批次寫入) ---
            if (modifiedGames.size > 0) await db.savedGames.bulkPut(Array.from(modifiedGames.values()));
            if (modifiedPlayers.size > 0) await db.savedPlayers.bulkPut(Array.from(modifiedPlayers.values()));
            if (modifiedLocations.size > 0) await db.savedLocations.bulkPut(Array.from(modifiedLocations.values()));
            if (modifiedWeekdays.size > 0) await db.savedWeekdays.bulkPut(Array.from(modifiedWeekdays.values()));
            if (modifiedTimeSlots.size > 0) await db.savedTimeSlots.bulkPut(Array.from(modifiedTimeSlots.values()));
            if (modifiedPlayerCounts.size > 0) await db.savedPlayerCounts.bulkPut(Array.from(modifiedPlayerCounts.values()));
            if (modifiedGameModes.size > 0) await db.savedGameModes.bulkPut(Array.from(modifiedGameModes.values()));

            // Write Logs
            if (logUpdates.length > 0) await db.analyticsLogs.bulkPut(logUpdates);

            // Write Weights
            if (playerWeightsDirty) await weightAdjustmentEngine.saveWeights(PLAYER_WEIGHTS_ID, globalPlayerWeights);
            if (countWeightsDirty) await weightAdjustmentEngine.saveWeights(COUNT_WEIGHTS_ID, globalCountWeights);
            if (locationWeightsDirty) await weightAdjustmentEngine.saveWeights(LOCATION_WEIGHTS_ID, globalLocationWeights);
            if (colorWeightsDirty) await weightAdjustmentEngine.saveWeights(COLOR_WEIGHTS_ID, globalColorWeights);

        });
        
        console.timeEnd("BatchProcess");
    }
}
