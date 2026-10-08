
import { BgStatsGame, BgStatsLocation, BgStatsPlayer, ManualLink } from '../types';
import { importStrategies } from './importStrategies';
import { db } from '../../../db';
import { bgStatsEntityService } from './bgStatsEntityService';
import { normalizeBggId } from './bgStatsBggData';
import { enrichBggDictionary } from './bgStatsBggDictionary';
import { loadBgStatsGameMatcher } from './bgStatsGameMatching';

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
        if (!games.length) return idMap;
        const matcher = await loadBgStatsGameMatcher(games);
        const localNames = new Map<number, string>();
        const writeOptions = { ...options, deferDictionary: true };

        for (const g of games) {
            try {
                const link = links.get(g.id);
                const match = link ? undefined : await matcher.find(g);
                const targetId = link?.targetId ?? match?.id;
                const sourceBggId = normalizeBggId(g.bggId);

                if (targetId) {
                    if (sourceBggId && (link || matcher.needsBggFill(targetId))) {
                        const name = await bgStatsEntityService.bindGame(targetId, g, writeOptions);
                        if (name) {
                            localNames.set(g.id, name);
                            matcher.rememberSaved({
                                id: targetId, name, bggId: sourceBggId, lastUsed: 0, usageCount: 0
                            });
                        }
                    }
                    if (!localNames.has(g.id) && match && sourceBggId && normalizeBggId(match.bggId) === sourceBggId) {
                        localNames.set(g.id, match.name);
                    }
                    idMap.set(g.id, targetId);
                } else {
                    const localId = await bgStatsEntityService.createGame(g, writeOptions);
                    matcher.rememberSaved({
                        id: localId, name: g.name.trim(), bggId: sourceBggId, lastUsed: 0, usageCount: 0
                    });
                    idMap.set(g.id, localId);
                }
            } catch (e) {
                console.warn(`[EntityBatchProcessor] Failed to sync game ${g.name}`, e);
            }
        }
        // One missing-only dictionary merge per BGG ID, independent of the UUID fast path.
        await enrichBggDictionary(games, localNames);
        return idMap;
    }
}

export const entityBatchProcessor = new EntityBatchProcessor();
