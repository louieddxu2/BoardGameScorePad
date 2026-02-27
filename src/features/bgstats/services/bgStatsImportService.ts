
import { BgStatsExport, BgStatsGame, BgStatsPlayer, BgStatsLocation, ImportAnalysisReport, ImportCategoryData, ManualLink, ImportManualLinks } from '../types';
import { HistoryRecord, GameTemplate, Player, SavedListItem, ScoringRule, BggGame } from '../../../types';
import { generateId } from '../../../utils/idGenerator';
import { db } from '../../../db';
import { importStrategies } from './importStrategies';
import { bgStatsEntityService } from './bgStatsEntityService';
import { HistoryBatchProcessor } from './historyBatchUtils';
import { entityBatchProcessor } from './EntityBatchProcessor';

class BgStatsImportService {

    public async analyzeData(data: BgStatsExport): Promise<ImportAnalysisReport> {
        console.log("[BgStatsImportService] Analyzing data...");

        // 1. 讀取所有本地資料
        const savedGames = await db.savedGames.toArray();
        const savedPlayers = await db.savedPlayers.toArray();
        const savedLocations = await db.savedLocations.toArray();

        // [New] 讀取 BGG 字典以支援別名匹配
        const bggDict = await db.bggGames.toArray();
        const aliasToBggId = new Map<string, string>();

        bggDict.forEach(entry => {
            // 將主名稱與所有別名都映射到 BGG ID
            const id = entry.id;
            if (entry.name) aliasToBggId.set(entry.name.toLowerCase().trim(), id);
            if (entry.altNames) {
                entry.altNames.forEach(alt => aliasToBggId.set(alt.toLowerCase().trim(), id));
            }
        });

        // 2. 準備遊戲候選清單 (Game Identities)
        const gameIdentityMap = new Map<string, SavedListItem>();

        savedGames.forEach(g => {
            gameIdentityMap.set(g.name.trim().toLowerCase(), g);
        });

        const localGameCandidates = Array.from(gameIdentityMap.values());

        const analyzeCategory = <TLocal extends SavedListItem, TImport extends { id: number, uuid: string, name: string, bggId?: number }>(
            localItems: TLocal[],
            importItems: TImport[] = [],
            type: 'game' | 'player' | 'location'
        ): ImportCategoryData => {

            const matchedImportIds = new Set<number>();
            const matchedLocalIds = new Set<string>();

            // Index by ID (Primary Key)
            const localById = new Map<string, TLocal>();
            const localByBggId = new Map<string, TLocal>();
            const localByName = new Map<string, TLocal>();

            localItems.forEach(local => {
                localById.set(local.id, local);
                if (type === 'game' && local.bggId) localByBggId.set(local.bggId.toString(), local);

                const cleanName = local.name.trim().toLowerCase();
                if (cleanName) localByName.set(cleanName, local);
            });

            importItems.forEach(imp => {
                let matchFound = false;

                // 1. UUID Match (Unified ID Check)
                // If incoming UUID exists as a local ID, it's a match.
                if (imp.uuid) {
                    const match = localById.get(imp.uuid);
                    if (match) {
                        matchedImportIds.add(imp.id);
                        matchedLocalIds.add(match.id);
                        matchFound = true;
                    }
                }

                // 2. BGG ID Match (Explicit)
                if (!matchFound && type === 'game' && imp.bggId && imp.bggId > 0) {
                    const match = localByBggId.get(imp.bggId.toString());
                    if (match) {
                        matchedImportIds.add(imp.id);
                        matchedLocalIds.add(match.id);
                        matchFound = true;
                    }
                }

                // 3. Name Match (Exact)
                if (!matchFound && imp.name) {
                    const match = localByName.get(imp.name.trim().toLowerCase());
                    if (match) {
                        matchedImportIds.add(imp.id);
                        matchedLocalIds.add(match.id);
                        matchFound = true;
                    }
                }

                // 4. [New] Dictionary Alias Match (Indirect via BGG Dictionary)
                // 邏輯：ImportName -> BGG Dictionary -> BGG ID -> Local Game (w/ BGG ID)
                if (!matchFound && type === 'game' && imp.name) {
                    const cleanName = imp.name.trim().toLowerCase();
                    const dictBggId = aliasToBggId.get(cleanName);

                    if (dictBggId) {
                        // 字典說這個名字對應到某個 BGG ID，檢查本地是否有遊戲綁定此 ID
                        const match = localByBggId.get(dictBggId);
                        if (match) {
                            matchedImportIds.add(imp.id);
                            matchedLocalIds.add(match.id);
                            matchFound = true;
                        }
                    }
                }
            });

            const localUnmatched = localItems.filter(l => {
                if (matchedLocalIds.has(l.id)) return false;
                return true;
            });

            const importUnmatched = importItems.filter(i => !matchedImportIds.has(i.id));

            return { localUnmatched, importUnmatched, matchedCount: matchedImportIds.size };
        };

        const validSourcePlayers = (data.players || []).filter(p => !p.isAnonymous);

        return {
            games: analyzeCategory(localGameCandidates, data.games, 'game'),
            players: analyzeCategory(savedPlayers, validSourcePlayers, 'player'),
            locations: analyzeCategory(savedLocations, data.locations, 'location'),
            sourceData: data
        };
    }

    public async importData(
        data: BgStatsExport,
        links: ImportManualLinks,
        onProgress?: (msg: string) => void
    ): Promise<number> {

        console.log("[BgStatsImportService] Starting import...");

        // --- Phase 1: Entity Resolution (Delegated to EntityBatchProcessor) ---

        if (onProgress) onProgress('msg_syncing_location');
        const sourceLocationIdToLocalIdMap = await entityBatchProcessor.processLocations(
            data.locations || [],
            links.locations
        );

        if (onProgress) onProgress('msg_syncing_players');
        const sourcePlayerIdToLocalIdMap = await entityBatchProcessor.processPlayers(
            data.players || [],
            links.players
        );

        if (onProgress) onProgress('msg_syncing_games');
        const sourceGameIdToLocalIdMap = await entityBatchProcessor.processGames(
            data.games || [],
            links.games,
            { backfillHistory: false } // 批次匯入時關閉即時回溯，統一在 Phase 3 處理
        );

        // --- Phase 2: History Processing (Batch Optimized) ---
        const plays = data.plays || [];
        if (onProgress) onProgress('msg_importing_plays'); // Parameterization will be handled in the caller if needed, but for now just the key

        const batchProcessor = new HistoryBatchProcessor(data);

        // Pre-load data to avoid N+1 queries
        if (onProgress) onProgress('msg_preparing_data');
        await batchProcessor.prepare(
            sourceGameIdToLocalIdMap,
            sourcePlayerIdToLocalIdMap,
            sourceLocationIdToLocalIdMap
        );

        const newRecords = batchProcessor.processPlays();

        if (newRecords.length > 0) {
            // Bulk insert for performance
            const CHUNK_SIZE = 500;
            for (let i = 0; i < newRecords.length; i += CHUNK_SIZE) {
                const chunk = newRecords.slice(i, i + CHUNK_SIZE);
                if (onProgress) onProgress('msg_writing_records'); // Params 'current'/'total' handled by caller if complex, or just key
                await db.history.bulkAdd(chunk);
            }
        }

        // --- Phase 3: Post Processing ---
        if (onProgress) onProgress('msg_updating_links');
        await this.propagateBggIds();

        return newRecords.length;
    }

    private async propagateBggIds() {
        try {
            const templates = await db.templates.toArray();
            const builtins = await db.builtins.toArray();
            const savedGames = await db.savedGames.toArray();

            const gameBggMap = new Map<string, string>();
            savedGames.forEach(g => {
                if (g.bggId && g.name) gameBggMap.set(g.name.trim().toLowerCase(), g.bggId);
            });

            const updates: Promise<any>[] = [];

            for (const t of templates) {
                if (!t.bggId) {
                    const cleanName = t.name.trim().toLowerCase();

                    let matchBggId = gameBggMap.get(cleanName);

                    if (!matchBggId) {
                        const bggMatch = await db.bggGames.where('name').equalsIgnoreCase(t.name.trim()).first();
                        if (bggMatch) matchBggId = bggMatch.id;
                    }

                    if (!matchBggId) {
                        const bggAltMatch = await db.bggGames.where('altNames').equals(t.name.trim()).first();
                        if (bggAltMatch) matchBggId = bggAltMatch.id;
                    }

                    if (matchBggId) {
                        updates.push(db.templates.update(t.id, { bggId: matchBggId }));
                        updates.push(bgStatsEntityService.updateHistoryByTemplateId(matchBggId, t.id));
                    }
                }
            }

            for (const t of builtins) {
                if (!t.bggId) {
                    const matchBggId = gameBggMap.get(t.name.trim().toLowerCase());
                    if (matchBggId) {
                        updates.push(db.builtins.update(t.id, { bggId: matchBggId }));
                    }
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
            }
        } catch (e) {
            console.warn("Failed to propagate BGG IDs", e);
        }
    }
}

export const bgStatsImportService = new BgStatsImportService();
