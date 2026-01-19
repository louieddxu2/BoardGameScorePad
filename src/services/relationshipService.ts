
import { db } from '../db';
import { HistoryRecord, SavedListItem, AnalyticsLog } from '../types';
import { generateId } from '../utils/idGenerator';
import { Table } from 'dexie';

// Data Structure: Ordered Array
// Order = Rank
interface RelationItem {
    id: string;
    count: number;
}

interface ResolvedEntity {
    item: SavedListItem;
    table: Table<SavedListItem>;
    type: 'player' | 'game' | 'location' | 'weekday' | 'timeslot';
    isNewContext: boolean; // [Key Feature] 是否為本次新增的上下文 (影響是否計數)
}

const MAX_RELATIONS_DEFAULT = 50;
const MAX_RELATIONS_TIME = 50;
const INSERTION_RATIO = 0.4;

class RelationshipService {

    /**
     * 主要進入點：當遊戲結束並儲存歷史紀錄後，或在歷史紀錄介面修改資料後呼叫。
     * 它會自動分析並更新所有相關實體 (玩家、遊戲、地點、時間) 的相互關聯性。
     * 
     * [Optimization Update] 
     * 優化演算邏輯：
     * 1. 只有 isNewContext=true 的實體需要增加 usageCount。
     * 2. 關係更新採不對稱邏輯：
     *    - 新實體 (New) -> 需要掃描所有人 (All) 來建立關係。
     *    - 舊實體 (Old) -> 只需要掃描新實體 (New) 來建立關係 (因為舊對舊的關係早已存在)。
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
                
                const resolvedEntities: ResolvedEntity[] = [];

                // --- Helper: 安全地取得或建立實體 ---
                const resolveOrCreate = async (
                    table: Table<SavedListItem>, 
                    name: string, 
                    type: ResolvedEntity['type'],
                    forceNewContext: boolean, // If true, treat as new context even if it exists
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
                        const newId = (preferredId && preferredId.length > 4) ? preferredId : generateId(8);
                        item = {
                            id: newId,
                            name: cleanName,
                            lastUsed: 0, 
                            usageCount: 0,
                            meta: { relations: {} } 
                        };
                    }
                    
                    // [Fix] If forceNewContext is true (e.g. Full Mode), we treat it as new context regardless of existence.
                    // This fixes the issue where existing items were skipped during re-scan.
                    const isNewContext = forceNewContext; 

                    resolvedEntities.push({ item, table, type, isNewContext });
                };

                // --- 2. 解析實體 (Load Entities) ---
                // 無論是 Full 還是 LocationOnly，我們都需要載入所有相關角色以便建立連結
                // 差別在於 forceNewContext 的標記

                const isFull = mode === 'full';

                // A. Location (如果是 location_only 模式，這就是主角)
                if (record.location) {
                    // Location 總是 NewContext (在此次操作中)
                    // 若是 Full Mode，它是新的。若是補登，它也是新的。
                    await resolveOrCreate(db.savedLocations, record.location, 'location', true, record.locationId);
                }

                // B. Game
                await resolveOrCreate(db.savedGames, record.gameName, 'game', isFull);

                // C. Players
                const validPlayers = record.players.filter(p => {
                    const isSystemId = p.id.startsWith('sys_player_');
                    const isDefaultName = /^玩家\s?\d+$/.test(p.name);
                    return !isSystemId || !isDefaultName;
                });

                for (const p of validPlayers) {
                    const targetId = p.linkedPlayerId || (!p.id.startsWith('sys_player_') ? p.id : undefined);
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

                // --- 3. 執行統計更新 (Optimized Logic) ---
                
                // 預先篩選出「新環境」的實體列表，供「舊實體」快速查找
                const newContextEntities = resolvedEntities.filter(e => e.isNewContext);

                if (resolvedEntities.length > 0) {
                    for (const source of resolvedEntities) {
                        let hasChanges = false;

                        // 3.1 基礎計數更新 (只針對 New Context)
                        if (source.isNewContext) {
                            source.item.usageCount = (source.item.usageCount || 0) + 1;
                            // [Fix] Ensure lastUsed updates to the record time (for re-scan correctness)
                            source.item.lastUsed = Math.max(source.item.lastUsed, record.endTime);
                            hasChanges = true;
                        }

                        // 3.2 關聯更新 (不對稱優化)
                        // 定義：誰是目標？
                        // - 如果我是新的 (New) -> 我要認識所有人 (All minus self)
                        // - 如果我是舊的 (Old) -> 我只要認識新來的 (NewContextEntities)
                        
                        let targetCandidates: ResolvedEntity[] = [];
                        
                        if (source.isNewContext) {
                            // 我是新的，我要跟所有其他人在這場遊戲建立連結
                            targetCandidates = resolvedEntities.filter(t => t.item.id !== source.item.id);
                        } else {
                            // 我是舊的，我只需要跟新加入的元素 (如補登的地點) 建立連結
                            // 注意：New 列表中肯定不包含自己 (因為我是 Old)，所以不用 filter self
                            targetCandidates = newContextEntities;
                        }

                        // 如果沒有目標 (例如：Old 遇到沒有任何 New 的情況，雖然理論上這被外層 mode check 擋掉了)，則跳過
                        if (targetCandidates.length > 0) {
                            
                            // Group targets by type
                            const targetsByType = new Map<string, string[]>();
                            
                            for (const target of targetCandidates) {
                                const key = this.getRelationKey(target.type);
                                if (!targetsByType.has(key)) targetsByType.set(key, []);
                                targetsByType.get(key)!.push(target.item.id);
                            }

                            // Ensure meta structure
                            if (!source.item.meta) source.item.meta = {};
                            if (!source.item.meta.relations || Array.isArray(source.item.meta.relations)) {
                                source.item.meta.relations = {};
                            }

                            // Apply relations
                            for (const [relKey, activeIds] of targetsByType.entries()) {
                                const limit = (relKey === 'weekdays' || relKey === 'timeSlots') ? MAX_RELATIONS_TIME : MAX_RELATIONS_DEFAULT;
                                const currentList = source.item.meta.relations[relKey];
                                const newList = this.updateRankings(currentList, activeIds, limit);
                                source.item.meta.relations[relKey] = newList;
                                hasChanges = true;
                            }
                        }
                        
                        // 3.3 顏色統計 
                        // 只在 Full Mode (New Player/Game) 時處理
                        // 邏輯：只有當我是新資料時，我才需要去統計這場遊戲的顏色分佈
                        if (source.isNewContext && (source.type === 'game' || source.type === 'player')) {
                            this.processColorStats(source, record.players);
                            hasChanges = true;
                        }

                        // Write back only if necessary
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

    private processColorStats(source: ResolvedEntity, players: HistoryRecord['players']) {
        const validPlayers = players.filter(p => {
            const isSystemId = p.id.startsWith('sys_player_');
            const isDefaultName = /^玩家\s?\d+$/.test(p.name);
            return !isSystemId || !isDefaultName;
        });

        if (source.type === 'game') {
            const allColors = validPlayers
                .map(p => p.color)
                .filter(c => c && c !== 'transparent');
            
            if (allColors.length > 0) {
                if (!source.item.meta) source.item.meta = {};
                if (!source.item.meta.relations) source.item.meta.relations = {};
                
                source.item.meta.relations['colors'] = this.updateRankings(
                    source.item.meta.relations['colors'],
                    allColors,
                    MAX_RELATIONS_DEFAULT
                );
            }
        } else if (source.type === 'player') {
            // Find the record for this player
            const pRecord = validPlayers.find(p => {
                const targetId = p.linkedPlayerId || (!p.id.startsWith('sys_player_') ? p.id : undefined);
                return (targetId && source.item.id === targetId) || source.item.name === p.name;
            });

            if (pRecord && pRecord.color && pRecord.color !== 'transparent') {
                if (!source.item.meta) source.item.meta = {};
                if (!source.item.meta.relations) source.item.meta.relations = {};

                source.item.meta.relations['colors'] = this.updateRankings(
                    source.item.meta.relations['colors'],
                    [pRecord.color],
                    MAX_RELATIONS_DEFAULT
                );
            }
        }
    }

    // [Refactor] Heuristic Ranking Update (Group Bubble Up + Insert)
    // 依據使用者需求修正：
    // 1. **絕對不重排順序 (No Sort)**：保留上次的順序作為基礎。
    // 2. 泡沫上浮 (Bubble Up)：當前活躍的項目若遇到前一個是不活躍的，就交換位置。
    //    這會讓一群活躍的項目像火車一樣推過不活躍的項目，但彼此之間保持相對順序。
    // 3. 新增項目：插入在列表前 40% 的位置。
    private updateRankings(
        currentList: any, 
        activeIds: string[], 
        limit: number
    ): RelationItem[] {
        // 1. 標準化輸入 (List)
        let list: RelationItem[] = [];
        if (Array.isArray(currentList)) {
            // [CRITICAL FIX] 不要執行 sort()，直接使用原始陣列保留歷史順序
            list = [...currentList];
        } else if (currentList && typeof currentList === 'object') {
            // 只有針對舊版資料 (Object) 才需要做一次性的初始排序 (Count DESC)
            list = Object.entries(currentList).map(([id, count]) => ({
                id,
                count: Number(count)
            })).sort((a, b) => b.count - a.count);
        }

        const activeSet = new Set(activeIds);
        const existingActiveIds = new Set<string>();

        // 2. 更新現有項目的計數，並標記哪些是「列表內已存在且本次活躍」
        list.forEach(item => {
            if (activeSet.has(item.id)) {
                item.count = (item.count || 0) + 1;
                existingActiveIds.add(item.id);
            }
        });

        // 找出本次新增的項目 (不在原本列表內)
        const newIds = activeIds.filter(id => !existingActiveIds.has(id));

        // 3. 執行 Bubble Up (往前一格)
        // [Logic Check] 我們必須「從前往後 (0 -> N)」掃描，確保活躍的群體可以像火車一樣依序跨過障礙物。
        // 如果是 [Inactive, ActiveA, ActiveB]：
        // i=1 (ActiveA): 跟 i=0 (Inactive) 交換 -> [ActiveA, Inactive, ActiveB]
        // i=2 (ActiveB): 跟 i=1 (Inactive) 交換 -> [ActiveA, ActiveB, Inactive]
        // 結果：活躍群體整體前移，且 A 仍在 B 前面。
        for (let i = 1; i < list.length; i++) {
            const current = list[i];
            const prev = list[i-1];

            const isCurrentActive = existingActiveIds.has(current.id);
            const isPrevActive = existingActiveIds.has(prev.id);

            // 只有當「我是活躍的」且「擋在我前面的人是不活躍的」時，才交換。
            // 這能保證我不會跨越另一個活躍的人，從而保持活躍者之間的相對順序。
            if (isCurrentActive && !isPrevActive) {
                // Swap
                list[i] = prev;
                list[i-1] = current;
            }
        }

        // 4. 插入新項目 (Insert New at 40%)
        if (newIds.length > 0) {
            const newItems: RelationItem[] = newIds.map(id => ({ id, count: 1 }));
            // 計算插入點：列表長度的 40% 位置 (例如 10 個項目插在第 4 格)
            // 這讓新朋友有機會曝光，但不會直接蓋過最常玩的前幾名
            const insertIndex = Math.floor(list.length * INSERTION_RATIO);
            list.splice(insertIndex, 0, ...newItems);
        }

        // 5. 截斷長度
        if (list.length > limit) {
            return list.slice(0, limit);
        }

        return list;
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
