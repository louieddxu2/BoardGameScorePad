import { db } from '../db';
import { HistoryRecord, SavedListItem, AnalyticsLog } from '../types';
import { Table } from 'dexie';
import { DATA_LIMITS } from '../dataLimits';
import { entityService } from './entityService';
import { getRecordBggId, getRecordScoringRule } from '../utils/historyUtils';

interface RelationItem {
    id: string;
    count: number;
    weight: number; 
}

interface ResolvedEntity {
    item: SavedListItem;
    table: Table<SavedListItem>;
    type: 'player' | 'game' | 'location' | 'weekday' | 'timeslot' | 'playerCount' | 'gameMode';
    isNewContext: boolean; 
}

class RelationshipService {

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

            // Added db.savedGameModes to transaction scope
            await (db as any).transaction('rw', db.savedPlayers, db.savedGames, db.savedLocations, db.savedWeekdays, db.savedTimeSlots, db.savedPlayerCounts, db.savedGameModes, db.analyticsLogs, db.bggGames, async () => {
                
                const resolvedEntitiesMap = new Map<string, ResolvedEntity>();

                // --- Helper: 使用 EntityService 解析並快取結果 ---
                const resolveAndCache = async (
                    table: Table<SavedListItem>, 
                    name: string, 
                    type: ResolvedEntity['type'],
                    forceNewContext: boolean, 
                    preferredId?: string,
                    externalIds?: { bggId?: string, bgStatsId?: string }
                ) => {
                    if (!name) return;
                    
                    // 固定 ID 的實體 (時間、人數、模式) 不走複雜解析
                    if (type === 'weekday' || type === 'timeslot' || type === 'playerCount' || type === 'gameMode') {
                         let item = await table.get(preferredId!);
                         if (!item) {
                             item = {
                                 id: preferredId!,
                                 name: name,
                                 lastUsed: 0,
                                 usageCount: 0,
                                 meta: { relations: {} }
                             };
                             await table.add(item);
                         }
                         if (!resolvedEntitiesMap.has(item.id)) {
                             resolvedEntitiesMap.set(item.id, { item, table, type, isNewContext: forceNewContext });
                         }
                         return;
                    }

                    // 一般實體使用 EntityService
                    // 注意：EntityService 會負責「建立」新項目，這裡我們確保拿到的是已存在的
                    const item = await entityService.resolveOrCreate(table, name, type as any, preferredId, externalIds);
                    
                    if (item && !resolvedEntitiesMap.has(item.id)) {
                        resolvedEntitiesMap.set(item.id, { item, table, type, isNewContext: forceNewContext });
                    }
                };

                // --- 2. 解析實體 (Load Entities) ---
                const isFull = mode === 'full';

                // A. Location
                if (record.location) {
                    await resolveAndCache(
                        db.savedLocations, 
                        record.location, 
                        'location', 
                        true, 
                        record.locationId,
                        { bgStatsId: undefined } 
                    );
                }

                // B. Game
                const bggId = getRecordBggId(record);
                const bgStatsId = record.bgStatsId;

                await resolveAndCache(
                    db.savedGames, 
                    record.gameName, 
                    'game', 
                    isFull, 
                    undefined, 
                    { bggId, bgStatsId }
                );

                // C. Players
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
                    
                    await resolveAndCache(db.savedPlayers, p.name, 'player', isFull, targetId);
                }

                // D. Time & Count & Game Mode
                const date = new Date(record.endTime);
                const dayIndex = date.getDay(); 
                const hour = date.getHours();
                const slotIndex = Math.floor(hour / 3); 
                const startH = String(slotIndex * 3).padStart(2, '0');
                const endH = String((slotIndex + 1) * 3).padStart(2, '0');
                const timeSlotName = `${startH}-${endH}`;
                const playerCount = record.players.length;
                const scoringRule = getRecordScoringRule(record);

                await resolveAndCache(db.savedWeekdays, dayIndex.toString(), 'weekday', isFull, `weekday_${dayIndex}`);
                await resolveAndCache(db.savedTimeSlots, timeSlotName, 'timeslot', isFull, `timeslot_${slotIndex}`);
                if (playerCount > 0) {
                    await resolveAndCache(db.savedPlayerCounts, playerCount.toString(), 'playerCount', isFull, `count_${playerCount}`);
                }
                // [New] Resolve Game Mode using the rule string as ID
                await resolveAndCache(db.savedGameModes, scoringRule, 'gameMode', isFull, scoringRule);

                // --- 3. 執行統計更新 ---
                const resolvedEntities = Array.from(resolvedEntitiesMap.values());
                const newContextEntities = resolvedEntities.filter(e => e.isNewContext);

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
                            const targetsByType = new Map<string, string[]>();
                            
                            for (const target of targetCandidates) {
                                const key = this.getRelationKey(target.type);
                                if (!targetsByType.has(key)) targetsByType.set(key, []);
                                targetsByType.get(key)!.push(target.item.id);
                            }

                            if (!source.item.meta) source.item.meta = {};
                            if (!source.item.meta.relations || Array.isArray(source.item.meta.relations)) {
                                source.item.meta.relations = {};
                            }
                            if (!source.item.meta.confidence) {
                                source.item.meta.confidence = {};
                            }

                            for (const [relKey, activeIds] of targetsByType.entries()) {
                                const limit = (relKey === 'weekdays' || relKey === 'timeSlots' || relKey === 'playerCounts' || relKey === 'gameModes') 
                                    ? DATA_LIMITS.RELATION.TIME_LIST_SIZE 
                                    : DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE;
                                    
                                const currentList = source.item.meta.relations[relKey];
                                const newList = this.updateRankings(currentList, activeIds, limit);
                                source.item.meta.relations[relKey] = newList;
                                source.item.meta.confidence[relKey] = 1.0;
                                hasChanges = true;
                            }
                        }
                        
                        // 3.3 顏色統計 
                        if (source.isNewContext && (source.type === 'game' || source.type === 'player')) {
                            const colorsChanged = this.processColorStats(source, record.players);
                            if (colorsChanged) hasChanges = true;
                        }

                        if (hasChanges) {
                            await source.table.put(source.item);
                        }
                    }
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

    // [Fix] Return boolean to indicate if changes were made
    private processColorStats(source: ResolvedEntity, players: HistoryRecord['players']): boolean {
        let colorsToAdd: string[] = [];

        // Filter valid players first
        const validPlayers = players.filter(p => {
            const isSystemId = p.id.startsWith('sys_player_') || p.id.startsWith('slot_') || p.id.startsWith('player_');
            const isDefaultName = /^玩家\s?\d+$/.test(p.name);
            return !isSystemId || !isDefaultName;
        });

        if (source.type === 'game') {
            colorsToAdd = validPlayers.map(p => p.color).filter(c => c && c !== 'transparent');
        } else if (source.type === 'player') {
            const matchingSlots = validPlayers.filter(p => {
                const isPlaceholder = p.id.startsWith('slot_') || p.id.startsWith('sys_') || p.id.startsWith('player_');
                const targetId = p.linkedPlayerId || (!isPlaceholder ? p.id : undefined);
                return (targetId && source.item.id === targetId) || source.item.name === p.name;
            });
            colorsToAdd = matchingSlots.map(p => p.color).filter(c => c && c !== 'transparent');
        }

        if (colorsToAdd.length > 0) {
            if (!source.item.meta) source.item.meta = {};
            if (!source.item.meta.relations) source.item.meta.relations = {};

            source.item.meta.relations['colors'] = this.updateRankings(
                source.item.meta.relations['colors'],
                colorsToAdd, 
                DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE
            );
            return true;
        }
        return false;
    }

    private updateRankings(currentList: any, activeIds: string[], limit: number): RelationItem[] {
        // Standardized ranking update logic (Halving Jump)
        let list: RelationItem[] = [];
        if (Array.isArray(currentList)) {
            list = [...currentList];
        } else if (currentList && typeof currentList === 'object') {
            list = Object.entries(currentList).map(([id, count]) => ({
                id, count: Number(count), weight: 1.0
            })).sort((a, b) => b.count - a.count);
        }

        const activeCounts = new Map<string, number>();
        activeIds.forEach(id => activeCounts.set(id, (activeCounts.get(id) || 0) + 1));
        
        const oldActiveItems: { item: RelationItem; originalIndex: number }[] = [];
        const inactiveItems: RelationItem[] = [];

        list.forEach((item, index) => {
            if (item.weight === undefined) item.weight = 1.0;
            if (activeCounts.has(item.id)) {
                item.count = (item.count || 0) + activeCounts.get(item.id)!;
                oldActiveItems.push({ item, originalIndex: index });
            } else {
                inactiveItems.push(item);
            }
        });

        const resultList = [...inactiveItems];
        const insertionOffsets: Record<number, number> = {};

        oldActiveItems.forEach(({ item, originalIndex }) => {
            const targetBase = Math.floor(originalIndex / 2);
            const offset = insertionOffsets[targetBase] || 0;
            const finalTarget = targetBase + offset;
            resultList.splice(finalTarget, 0, item);
            insertionOffsets[targetBase] = offset + 1;
        });

        const newIds = Array.from(activeCounts.keys()).filter(id => !list.find(existing => existing.id === id));
        if (newIds.length > 0) {
            const newItems: RelationItem[] = newIds.map(id => ({ id, count: activeCounts.get(id)!, weight: 1.0 }));
            let insertIndex = -1; 
            for (let i = resultList.length - 1; i >= 0; i--) {
                const itemId = resultList[i].id;
                if (activeCounts.has(itemId) && !newIds.includes(itemId)) {
                    insertIndex = i + 1; break;
                }
            }
            if (insertIndex === -1) insertIndex = Math.floor(resultList.length / 2);
            resultList.splice(insertIndex, 0, ...newItems);
        }

        if (resultList.length > limit) return resultList.slice(0, limit);
        return resultList;
    }

    private getRelationKey(type: ResolvedEntity['type']): string {
        switch (type) {
            case 'player': return 'players';
            case 'game': return 'games';
            case 'location': return 'locations';
            case 'weekday': return 'weekdays';
            case 'timeslot': return 'timeSlots';
            case 'playerCount': return 'playerCounts';
            case 'gameMode': return 'gameModes';
        }
        return 'others';
    }
}

export const relationshipService = new RelationshipService();