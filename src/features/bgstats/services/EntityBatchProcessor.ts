
import { BgStatsGame, BgStatsLocation, BgStatsPlayer, ManualLink } from '../types';
import { importStrategies } from './importStrategies';
import { db } from '../../../db';
import { bgStatsEntityService } from './bgStatsEntityService';

/**
 * 實體批次處理器
 * 職責：
 * 1. 遍歷來源資料 (Games, Players, Locations)
 * 2. 應用手動連結 (Manual Links)
 * 3. 呼叫策略層 (importStrategies) 進行單一項目的解析或建立
 * 4. 回傳 Source ID -> Local ID 的對照表
 */
export class EntityBatchProcessor {

    /**
     * 處理地點
     */
    public async processLocations(
        locations: BgStatsLocation[], 
        links: Map<number, ManualLink>
    ): Promise<Map<number, string>> {
        const idMap = new Map<number, string>();
        
        // 1. Batch Check Existence (Performance Optimization)
        const uuids = locations.map(l => l.uuid).filter(u => !!u);
        let existingSet = new Set<string>();
        try {
            const existingKeys = await db.savedLocations.where('id').anyOf(uuids).primaryKeys();
            existingSet = new Set(existingKeys as string[]);
        } catch (e) {
            console.warn("[EntityBatchProcessor] Batch check failed for locations", e);
        }

        for (const loc of locations) {
            try {
                const link = links.get(loc.id);
                
                if (link) {
                    // A. Manual Link (Override)
                    const localId = await importStrategies.resolveLocation(loc.name, loc.uuid, link);
                    idMap.set(loc.id, localId);
                } else if (existingSet.has(loc.uuid)) {
                    // B. Fast Path: ID Exists locally
                    const localId = loc.uuid;
                    // [Optimization] Skip bindLocation as it's a no-op for existing UUIDs
                    idMap.set(loc.id, localId);
                } else {
                    // C. Slow Path: Name Match or Create
                    const localId = await importStrategies.resolveLocation(loc.name, loc.uuid, undefined);
                    idMap.set(loc.id, localId);
                }
            } catch (e) {
                console.warn(`[EntityBatchProcessor] Skipping location ${loc.name}`, e);
            }
        }
        return idMap;
    }

    /**
     * 處理玩家
     * 過濾掉匿名玩家
     */
    public async processPlayers(
        players: BgStatsPlayer[], 
        links: Map<number, ManualLink>
    ): Promise<Map<number, string>> {
        const idMap = new Map<number, string>();
        
        // 1. Batch Check Existence
        const validPlayers = players.filter(p => !p.isAnonymous);
        const uuids = validPlayers.map(p => p.uuid).filter(u => !!u);
        let existingSet = new Set<string>();
        try {
            const existingKeys = await db.savedPlayers.where('id').anyOf(uuids).primaryKeys();
            existingSet = new Set(existingKeys as string[]);
        } catch (e) {
            console.warn("[EntityBatchProcessor] Batch check failed for players", e);
        }

        for (const p of validPlayers) {
            try {
                const link = links.get(p.id);

                if (link) {
                    // A. Manual Link
                    const localId = await importStrategies.resolvePlayer(p.name, p.uuid, link);
                    idMap.set(p.id, localId);
                } else if (existingSet.has(p.uuid)) {
                    // B. Fast Path
                    const localId = p.uuid;
                    // [Optimization] Skip bindPlayer as it's a no-op for existing UUIDs
                    idMap.set(p.id, localId);
                } else {
                    // C. Slow Path
                    const localId = await importStrategies.resolvePlayer(p.name, p.uuid, undefined);
                    idMap.set(p.id, localId);
                }
            } catch (e) {
                console.warn(`[EntityBatchProcessor] Skipping player ${p.name}`, e);
            }
        }
        return idMap;
    }

    /**
     * 處理遊戲
     * 包含 backfillHistory 選項控制
     */
    public async processGames(
        games: BgStatsGame[], 
        links: Map<number, ManualLink>,
        options: { backfillHistory: boolean } = { backfillHistory: false }
    ): Promise<Map<number, string>> {
        const idMap = new Map<number, string>();

        // 1. Batch Check Existence & Fetch Meta for Comparison
        const uuids = games.map(g => g.uuid).filter(u => !!u);
        const existingData = new Map<string, { bggId?: string }>(); // Map<UUID, { bggId }>
        
        try {
            // Fetch items to check current state
            const existingItems = await db.savedGames.where('id').anyOf(uuids).toArray();
            existingItems.forEach(item => {
                existingData.set(item.id, { bggId: item.bggId });
            });
        } catch (e) {
            console.warn("[EntityBatchProcessor] Batch check failed for games", e);
        }

        for (const g of games) {
            try {
                const link = links.get(g.id);

                if (link) {
                    // A. Manual Link
                    const localId = await importStrategies.resolveGame(g, link, options);
                    idMap.set(g.id, localId);
                } else if (existingData.has(g.uuid)) {
                    // B. Fast Path (Found by ID)
                    const localId = g.uuid;
                    const localData = existingData.get(localId);
                    const sourceBggId = (g.bggId && g.bggId > 0) ? g.bggId.toString() : undefined;
                    
                    // [Optimization] Only call bindGame if BGG ID needs update or differs
                    // This avoids redundant DB writes for fully existing games
                    if (sourceBggId && (!localData || localData.bggId !== sourceBggId)) {
                        await bgStatsEntityService.bindGame(localId, g, options);
                    }
                    // Else: Strictly skip to save time
                    
                    idMap.set(g.id, localId);
                } else {
                    // C. Slow Path (Name Match or Create)
                    const localId = await importStrategies.resolveGame(g, undefined, options);
                    idMap.set(g.id, localId);
                }
            } catch (e) {
                console.warn(`[EntityBatchProcessor] Failed to sync game ${g.name}`, e);
            }
        }
        return idMap;
    }
}

export const entityBatchProcessor = new EntityBatchProcessor();
