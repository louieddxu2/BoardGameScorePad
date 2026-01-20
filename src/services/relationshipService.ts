
import { db } from '../db';
import { HistoryRecord, SavedListItem, AnalyticsLog } from '../types';
import { generateId } from '../utils/idGenerator';
import { Table } from 'dexie';
import { DATA_LIMITS } from '../dataLimits';

// Data Structure: Ordered Array
// Order = Rank
interface RelationItem {
    id: string;
    count: number;
    weight: number; // [New] 0.2 ~ 5.0, Default 1.0. 代表預測的可信度/權重。
}

interface ResolvedEntity {
    item: SavedListItem;
    table: Table<SavedListItem>;
    type: 'player' | 'game' | 'location' | 'weekday' | 'timeslot';
    isNewContext: boolean; // [Key Feature] 是否為本次新增的上下文 (影響是否計數)
}

class RelationshipService {

    /**
     * 主要進入點：當遊戲結束並儲存歷史紀錄後，或在歷史紀錄介面修改資料後呼叫。
     * 它會自動分析並更新所有相關實體 (玩家、遊戲、地點、時間) 的相互關聯性。
     */
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

            await (db as any).transaction('rw', db.savedPlayers, db.savedGames, db.savedLocations, db.savedWeekdays, db.savedTimeSlots, db.analyticsLogs, async () => {
                
                // [Fix] Use Map for deduplication based on Item ID
                // This prevents double-counting if the same player (UUID) occupies multiple slots in one game.
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

                    // 1. Try to fetch by ID first
                    if (preferredId) {
                        item = await table.get(preferredId);
                    }

                    // 2. If not found, try by Name
                    if (!item) {
                        item = await table.where('name').equals(cleanName).first();
                    }

                    // 3. Create if missing
                    if (!item) {
                        const newId = (preferredId && preferredId.length > 4) ? preferredId : generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                        item = {
                            id: newId,
                            name: cleanName,
                            lastUsed: 0, 
                            usageCount: 0,
                            predictivePower: 1.0, // [New] 物件本身的預測權重 (預設 1.0)
                            meta: { relations: {} } 
                        };
                    }
                    
                    // [Deduplication Logic]
                    // If this entity is already in our map for this transaction, don't add it again.
                    // This ensures "Alice" only gets +1 play count even if she played 2 hands.
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
                const validPlayers = record.players.filter(p => {
                    // Filter out unused slots.
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

                // D. Time
                const date = new Date(record.endTime);
                const dayIndex = date.getDay(); 
                const hour = date.getHours();
                const slotIndex = Math.floor(hour / 3); 
                const startH = String(slotIndex * 3).padStart(2, '0');
                const endH = String((slotIndex + 1) * 3).padStart(2, '0');
                const timeSlotName = `${startH}-${endH}`;

                await resolveOrCreate(db.savedWeekdays, dayIndex.toString(), 'weekday', isFull, `weekday_${dayIndex}`);
                await resolveOrCreate(db.savedTimeSlots, timeSlotName, 'timeslot', isFull, `timeslot_${slotIndex}`);

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
                            // Exclude self from candidates to avoid A->A or B->B links.
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

                            for (const [relKey, activeIds] of targetsByType.entries()) {
                                const limit = (relKey === 'weekdays' || relKey === 'timeSlots') 
                                    ? DATA_LIMITS.RELATION.TIME_LIST_SIZE 
                                    : DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE;
                                    
                                const currentList = source.item.meta.relations[relKey];
                                const newList = this.updateRankings(currentList, activeIds, limit);
                                source.item.meta.relations[relKey] = newList;
                                hasChanges = true;
                            }
                        }
                        
                        // 3.3 顏色統計 
                        // [Optimized] Now handles aggregation of multiple colors if the entity played multiple hands
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
            // [Fix] Use .filter() instead of .find() to catch multiple hands played by same person
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
                colorsToAdd, // Pass array of all colors
                DATA_LIMITS.RELATION.DEFAULT_LIST_SIZE
            );
            return true;
        }
        return false;
    }

    // [Refactor] Halving Jump Algorithm (折半躍進)
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

        // Use a map to count occurrences in this batch (handling multiple hands of same color/game)
        const activeCounts = new Map<string, number>();
        activeIds.forEach(id => {
            activeCounts.set(id, (activeCounts.get(id) || 0) + 1);
        });
        
        // 分離 Active 和 Inactive
        const oldActiveItems: { item: RelationItem; originalIndex: number }[] = [];
        const inactiveItems: RelationItem[] = [];

        list.forEach((item, index) => {
            // [Migration] Ensure weight exists
            if (item.weight === undefined) item.weight = 1.0;

            if (activeCounts.has(item.id)) {
                // Increment by occurrence count (e.g., played Red twice -> +2)
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
                weight: 1.0 // [New] Init weight
            }));
            
            let insertIndex = resultList.length; 
            for (let i = resultList.length - 1; i >= 0; i--) {
                const itemId = resultList[i].id;
                if (activeCounts.has(itemId) && !newIds.includes(itemId)) {
                    insertIndex = i + 1; 
                    break;
                }
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
        }
        return 'others';
    }
}

export const relationshipService = new RelationshipService();
