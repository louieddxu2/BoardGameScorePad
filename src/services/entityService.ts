
import { db } from '../db';
import { SavedListItem, BggGame } from '../types';
import { generateId } from '../utils/idGenerator';
import { Table } from 'dexie';
import { DATA_LIMITS } from '../dataLimits';

// 定義分析結果介面 (供未來 UI 使用)
export interface EntityAnalysisResult {
    status: 'MATCH_BY_ID' | 'MATCH_BY_NAME' | 'NEW';
    match?: SavedListItem; // 如果有找到對應項目
    suggestedId?: string;  // 如果是新項目，預先生成的 ID
}

// [New] BGG Metadata payload for creating/updating games
export interface GameMetadataPayload {
    year?: number;
    designers?: string;
    // [Added] Extended BGG Stats for Recommendation Engine
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    minAge?: number;
    complexity?: number;
    rank?: number;
    bestPlayers?: number[];
}

class EntityService {
    
    /**
     * [純讀取] 分析實體狀態
     * 不進行任何寫入，僅回傳系統判斷的結果。
     * 用於匯入前的預覽與「連連看」邏輯。
     */
    public async analyzeEntity(
        table: Table<SavedListItem>,
        name: string,
        type: 'game' | 'location' | 'player',
        externalIds?: { bggId?: string, bgStatsId?: string }
    ): Promise<EntityAnalysisResult> {
        const cleanName = name?.trim();
        if (!cleanName) return { status: 'NEW' }; 

        // 1. Check BGG ID (Only for games) - 查詢是否有內部紀錄關聯到此 BGG ID
        if (type === 'game' && externalIds?.bggId) {
            const match = await table.where('bggId').equals(externalIds.bggId).first();
            if (match) return { status: 'MATCH_BY_ID', match };
        }

        // 2. Check BGStats ID (Now treated as Primary Key Check)
        if (externalIds?.bgStatsId) {
            const match = await table.get(externalIds.bgStatsId);
            if (match) return { status: 'MATCH_BY_ID', match };
        }

        // 3. Name Match (Fallback)
        const nameMatch = await table.where('name').equals(cleanName).first();
        if (nameMatch) {
            return { status: 'MATCH_BY_NAME', match: nameMatch };
        }

        // 4. No Match
        return { status: 'NEW' };
    }

    /**
     * 核心解析與寫入邏輯
     * 1. 若提供 preferredId (內部 8 位 ID)，則強制使用該 ID。
     * 2. 若提供 externalIds.bgStatsId 且找不到現有紀錄，則將其作為 ID 建立新項目 (Unified UUID)。
     * 3. 執行資料庫寫入 (建立新項目 或 更新現有項目 ID)。
     */
    public async resolveOrCreate(
        table: Table<SavedListItem>, 
        name: string, 
        type: 'game' | 'location' | 'player',
        preferredId?: string, // 這是內部 ID (例如匯入備份時)
        externalIds?: { bggId?: string, bgStatsId?: string },
        metadata?: GameMetadataPayload
    ): Promise<SavedListItem> {
        const cleanName = name?.trim();
        if (!cleanName) {
            throw new Error("Entity name cannot be empty");
        }

        let item: SavedListItem | undefined;

        // --- Step 1: 決定目標實體 (Target Resolution) ---

        // A. 強制指定模式 (Manual Override / Known Internal ID)
        if (preferredId) {
            item = await table.get(preferredId);
        }

        // B. 自動偵測模式 (Auto Detect)
        if (!item) {
            const analysis = await this.analyzeEntity(table, cleanName, type, externalIds);
            
            if (analysis.status !== 'NEW') {
                item = analysis.match;
            }
        }

        // --- Step 2: 執行寫入 (Execution) ---
        // 對於遊戲類型，如果我們有 BGG Metadata，則獨立寫入 bggGames 表 (百科全書)
        // 即使沒有 Metadata，只要有 BGG ID，我們也建立一個佔位符 (Placeholder) 或更新別名
        if (type === 'game' && externalIds?.bggId) {
            const id = externalIds.bggId;
            const existingBgg = await db.bggGames.get(id);
            const currentName = cleanName;

            // [Metadata Logic] 檢查是否有新的有效資料 (用於判斷是否需要觸發更新)
            const hasNewMetadata = metadata && (
                metadata.year !== undefined || 
                metadata.designers !== undefined ||
                metadata.minPlayers !== undefined ||
                metadata.complexity !== undefined
            );

            // [Smart Name Promotion Logic]
            // 判斷是否為「資料升級」(Data Upgrade)
            let finalPrimaryName = currentName;
            let finalAltNames: string[] = existingBgg?.altNames || [];

            if (existingBgg) {
                // 只有在 existingBgg 存在時才進行判斷，減少 redundant check
                // 判斷是否為「資料升級」: 當資料庫內僅有「佔位符」(無年份)，而本次寫入帶有 Metadata 時
                const isUpgrade = !existingBgg.year && hasNewMetadata;

                if (isUpgrade) {
                    // 情境：升級。新資料(英文)變正宮 (finalPrimaryName 保持 currentName)，舊資料(中文)變別名。
                    if (existingBgg.name && existingBgg.name !== finalPrimaryName) {
                        finalAltNames.push(existingBgg.name);
                    }
                } else {
                    // 情境：一般。保留現有正宮(可能已是英文)，新資料(中文)變別名。
                    finalPrimaryName = existingBgg.name;
                    if (currentName !== finalPrimaryName) {
                        finalAltNames.push(currentName);
                    }
                }
            } 
            // else: 全新資料，finalPrimaryName 保持 currentName，finalAltNames 為空

            // 別名去重與清理 (移除與主名稱重複的)
            const uniqueAltNames = Array.from(new Set(finalAltNames)).filter(n => n !== finalPrimaryName);

            // [Write Logic: Safe Merge]
            // 寫入條件：
            // 1. 完全新資料 (!existingBgg) -> 建立
            // 2. 名稱或別名有變動 -> 更新
            // 3. 有新的 Metadata 需要更新 -> 補完
            const isAliasChanged = uniqueAltNames.length !== (existingBgg?.altNames?.length || 0);
            const isNameChanged = existingBgg && existingBgg.name !== finalPrimaryName;

            if (!existingBgg || isNameChanged || isAliasChanged || hasNewMetadata) {
                const bggData: BggGame = {
                    id: id,
                    name: finalPrimaryName, 
                    altNames: uniqueAltNames,
                    
                    // [Safe Merge Strategy] 
                    // 優先使用新傳入的資料 (New)
                    // 若新資料為空，則回退使用舊資料 (Existing)
                    // 這確保了「歷史掃描」(無 metadata) 不會覆蓋「BG Stats 匯入」(有 metadata) 的結果
                    year: metadata?.year ?? existingBgg?.year,
                    designers: metadata?.designers || existingBgg?.designers,
                    
                    minPlayers: metadata?.minPlayers ?? existingBgg?.minPlayers,
                    maxPlayers: metadata?.maxPlayers ?? existingBgg?.maxPlayers,
                    playingTime: metadata?.playingTime ?? existingBgg?.playingTime,
                    minAge: metadata?.minAge ?? existingBgg?.minAge,
                    rank: metadata?.rank ?? existingBgg?.rank,
                    complexity: metadata?.complexity ?? existingBgg?.complexity,
                    bestPlayers: metadata?.bestPlayers ?? existingBgg?.bestPlayers,

                    updatedAt: Date.now()
                };
                // Upsert BGG Data
                await db.bggGames.put(bggData);
            }
        }

        // 情境 1: 找到現有資料 -> 檢查是否需要補完 BGG ID
        if (item) {
            const updates: Partial<SavedListItem> = {};
            let hasUpdates = false;

            if (type === 'game' && externalIds?.bggId && !item.bggId) {
                updates.bggId = externalIds.bggId;
                hasUpdates = true;
            }
                
            // Note: We don't store bgStatsId anymore as a secondary field. It is the ID itself.
            // Note: 我們不將 metadata 寫入 SavedListItem.meta，因為已經有 bggGames 表了

            if (hasUpdates) {
                await table.update(item.id, updates);
                Object.assign(item, updates);
            }
            return item;
        }

        // 情境 2: 完全新資料 -> 建立 (Create)
        // [Unified UUID Strategy] 優先使用外部 bgStatsId 作為 Primary Key
        const newId = preferredId || externalIds?.bgStatsId || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
        
        item = {
            id: newId,
            name: cleanName,
            lastUsed: 0, 
            usageCount: 0,
            // 記錄 BGG ID 作為 Foreign Key
            bggId: (type === 'game') ? externalIds?.bggId : undefined,
            meta: { relations: {}, confidence: {} } // 保持 meta 乾淨
        };
        
        await table.add(item);
        console.log(`[EntityService] Created new ${type}: ${cleanName} (${newId})`);

        return item;
    }

    /**
     * 專門處理遊戲實體的解析
     */
    public async ensureGame(
        name: string, 
        bggId?: string, 
        bgStatsId?: string,
        metadata?: GameMetadataPayload
    ): Promise<SavedListItem> {
        return this.resolveOrCreate(db.savedGames, name, 'game', undefined, { bggId, bgStatsId }, metadata);
    }

    /**
     * 專門處理地點實體的解析
     */
    public async ensureLocation(name: string, locationId?: string, bgStatsId?: string): Promise<SavedListItem> {
        return this.resolveOrCreate(db.savedLocations, name, 'location', locationId, { bgStatsId });
    }

    /**
     * 專門處理玩家實體的解析
     */
    public async ensurePlayer(name: string, playerId?: string, bgStatsId?: string): Promise<SavedListItem> {
        return this.resolveOrCreate(db.savedPlayers, name, 'player', playerId, { bgStatsId });
    }
}

export const entityService = new EntityService();
