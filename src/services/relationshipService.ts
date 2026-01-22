
// ... (existing imports)
import { db } from '../db';
import { HistoryRecord, SavedListItem, AnalyticsLog } from '../types';
import { generateId } from '../utils/idGenerator';
import { Table } from 'dexie';
import { DATA_LIMITS } from '../dataLimits';

// ... (existing interfaces)
interface RelationItem {
    id: string;
    count: number;
    weight: number; 
}

interface ResolvedEntity {
    item: SavedListItem;
    table: Table<SavedListItem>;
    type: 'player' | 'game' | 'location' | 'weekday' | 'timeslot' | 'playerCount';
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

            await (db as any).transaction('rw', db.savedPlayers, db.savedGames, db.savedLocations, db.savedWeekdays, db.savedTimeSlots, db.savedPlayerCounts, db.analyticsLogs, async () => {
                
                const resolvedEntitiesMap = new Map<string, ResolvedEntity>();

                // --- Helper: 安全地取得或建立實體 ---
                const resolveOrCreate = async (
                    table: Table<SavedListItem>, 
                    name: string, 
                    type: ResolvedEntity['type'],
                    forceNewContext: boolean, 
                    preferredId?: string
                ): Promise<void> => {
                    const cleanName = name?.trim();
                    if (!cleanName) return;

                    let item: SavedListItem | undefined;

                    if (preferredId) {
                        item = await table.get(preferredId);
                    }

                    if (!item) {
                        item = await table.where('name').equals(cleanName).first();
                    }

                    if (!item) {
                        const newId = (preferredId && preferredId.length > 4) ? preferredId : generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                        item = {
                            id: newId,
                            name: cleanName,
                            lastUsed: 0, 
                            usageCount: 0,
                            predictivePower: 1.0, 
                            meta: { relations: {}, confidence: {} } // [Updated] Initialize confidence
                        };
                    }
                    
                    if (resolvedEntitiesMap.has(item.id)) {
                        return;
                    }

                    const isNewContext = forceNewContext; 
                    resolvedEntitiesMap.set(item.id, { item, table, type, isNewContext });
                };

                // --- 2. 解析實體 (Load Entities) ---
                const isFull = mode === 'full';

                // A. Location
                if (record.location) {
                    await resolveOrCreate(db.savedLocations, record.location, 'location', true, record.locationId);
                }

                // B. Game
                await resolveOrCreate(db.savedGames, record.gameName, 'game', isFull);

                // C. Players
                // 用於統計「玩家個人」的數據，這裡排除系統預設名稱的空位是正確的
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
                    
                    await resolveOrCreate(db.savedPlayers, p.name, 'player', isFull, targetId);
                }

                // D. Time & Count
                const date = new Date(record.endTime);
                const dayIndex = date.getDay(); 
                const hour = date.getHours();
                const slotIndex = Math.floor(hour / 3); 
                const startH = String(slotIndex * 3).padStart(2, '0');
                const endH = String((slotIndex + 1) * 3).padStart(2, '0');
                const timeSlotName = `${startH}-${endH}`;
                
                // [Fix] Player Count logic: Use total session players count, not just named players
                const playerCount = record.players.length;

                await resolveOrCreate(db.savedWeekdays, dayIndex.toString(), 'weekday', isFull, `weekday_${dayIndex}`);
                await resolveOrCreate(db.savedTimeSlots, timeSlotName, 'timeslot', isFull, `timeslot_${slotIndex}`);
                
                // Player Count Entity
                if (playerCount > 0) {
                    await resolveOrCreate(db.savedPlayerCounts, playerCount.toString(), 'playerCount', isFull, `count_${playerCount}`);
                }

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

                        // 3.2 關聯更新 (不對稱優化)
                        let targetCandidates: ResolvedEntity[] = [];
                        
                        if (source.isNewContext) {
                            // [Self-Relation Prevention]
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
                            
                            // [Updated] Ensure confidence object exists
                            if (!source.item.meta.confidence) {
                                source.item.meta.confidence = {};
                            }

                            for (const [relKey, activeIds] of targetsByType.entries()) {
                                const limit = (relKey === 'weekdays' || relKey === 'timeSlots' || relKey === 'playerCounts') 
                                    ? DATA_LIMITS.RELATION.TIME_LIST_SIZE 
                                    : DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE;
                                    
                                const currentList = source.item.meta.relations[relKey];
                                const newList = this.updateRankings(currentList, activeIds, limit);
                                source.item.meta.relations[relKey] = newList;
                                
                                // [Updated] Placeholder for confidence value (default to 1.0 if not set)
                                // Only initializing structure here as requested, no algorithm implementation yet.
                                if (source.item.meta.confidence[relKey] === undefined) {
                                    source.item.meta.confidence[relKey] = 1.0;
                                }
                                
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
            // For games, collect ALL valid player colors
            colorsToAdd = validPlayers
                .map(p => p.color)
                .filter(c => c && c !== 'transparent');
            
        } else if (source.type === 'player') {
            // For players, we need to find ALL slots that match this entity (deduplicated entity)
            const matchingSlots = validPlayers.filter(p => {
                const isPlaceholder = p.id.startsWith('slot_') || p.id.startsWith('sys_') || p.id.startsWith('player_');
                const targetId = p.linkedPlayerId || (!isPlaceholder ? p.id : undefined);
                
                // Match by ID (preferred) or Name (legacy fallback)
                return (targetId && source.item.id === targetId) || source.item.name === p.name;
            });

            colorsToAdd = matchingSlots
                .map(p => p.color)
                .filter(c => c && c !== 'transparent');
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

    // [Refactor] Halving Jump Algorithm
    private updateRankings(
        currentList: any, 
        activeIds: string[], 
        limit: number
    ): RelationItem[] {
        // 1. 標準化輸入 (List)
        let list: RelationItem[] = [];
        if (Array.isArray(currentList)) {
            list = [...currentList];
        } else if (currentList && typeof currentList === 'object') {
            list = Object.entries(currentList).map(([id, count]) => ({
                id,
                count: Number(count),
                weight: 1.0 // Legacy data migration
            })).sort((a, b) => b.count - a.count);
        }

        const activeCounts = new Map<string, number>();
        activeIds.forEach(id => {
            activeCounts.set(id, (activeCounts.get(id) || 0) + 1);
        });
        
        // 分離 Active 和 Inactive
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

        // 2. 重組列表 (Process Old Active Items)
        const resultList = [...inactiveItems];
        const insertionOffsets: Record<number, number> = {};

        oldActiveItems.forEach(({ item, originalIndex }) => {
            const targetBase = Math.floor(originalIndex / 2);
            const offset = insertionOffsets[targetBase] || 0;
            const finalTarget = targetBase + offset;
            resultList.splice(finalTarget, 0, item);
            insertionOffsets[targetBase] = offset + 1;
        });

        // 3. 插入全新項目 (Process New Items)
        const newIds = Array.from(activeCounts.keys()).filter(id => !list.find(existing => existing.id === id));
        
        if (newIds.length > 0) {
            const newItems: RelationItem[] = newIds.map(id => ({ 
                id, 
                count: activeCounts.get(id)!,
                weight: 1.0 
            }));
            
            let insertIndex = -1; 
            for (let i = resultList.length - 1; i >= 0; i--) {
                const itemId = resultList[i].id;
                if (activeCounts.has(itemId) && !newIds.includes(itemId)) {
                    insertIndex = i + 1; 
                    break;
                }
            }
            
            if (insertIndex === -1) {
                insertIndex = Math.floor(resultList.length / 2);
            }
            
            resultList.splice(insertIndex, 0, ...newItems);
        }

        // 4. 截斷長度
        if (resultList.length > limit) {
            return resultList.slice(0, limit);
        }

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
        }
        return 'others';
    }
}

export const relationshipService = new RelationshipService();
