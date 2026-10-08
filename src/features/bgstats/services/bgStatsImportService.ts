
import { BgStatsExport, ImportAnalysisReport, ImportCategoryData, ImportManualLinks } from '../types';
import { SavedListItem } from '../../../types';
import { db } from '../../../db';
import { HistoryBatchProcessor } from './historyBatchUtils';
import { entityBatchProcessor } from './EntityBatchProcessor';
import { loadBgStatsGameMatcher } from './bgStatsGameMatching';
import { fillHistoryBggId, normalizeBggId } from './bgStatsBggData';

class BgStatsImportService {

    public async analyzeData(data: BgStatsExport): Promise<ImportAnalysisReport> {
        console.log("[BgStatsImportService] Analyzing data...");

        // 1. 讀取所有本地資料
        const savedGames = await db.savedGames.toArray();
        const savedPlayers = await db.savedPlayers.toArray();
        const savedLocations = await db.savedLocations.toArray();

        // [New] 讀取 BGG 字典以支援別名匹配
        const bggDict = await db.bggGames.toArray();
        const gameMatcher = await loadBgStatsGameMatcher(data.games || [], savedGames, bggDict);
        const matchedImportIds = new Set<number>();
        const matchedLocalIds = new Set<string>();
        for (const game of data.games || []) {
            const match = await gameMatcher.find(game);
            if (match) {
                matchedImportIds.add(game.id);
                matchedLocalIds.add(match.id);
            }
        }

        const analyzeCategory = <TLocal extends SavedListItem, TImport extends { id: number, uuid: string, name: string, bggId?: number }>(
            localItems: TLocal[],
            importItems: TImport[] = [],
            type: 'player' | 'location'
        ): ImportCategoryData => {

            const matchedImportIds = new Set<number>();
            const matchedLocalIds = new Set<string>();

            // Index by ID (Primary Key)
            const localById = new Map<string, TLocal>();
            const localByName = new Map<string, TLocal>();

            localItems.forEach(local => {
                localById.set(local.id, local);

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

                // 3. Name Match (Exact)
                if (!matchFound && imp.name) {
                    const match = localByName.get(imp.name.trim().toLowerCase());
                    if (match) {
                        matchedImportIds.add(imp.id);
                        matchedLocalIds.add(match.id);
                        matchFound = true;
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
            games: {
                localUnmatched: savedGames.filter(game => !matchedLocalIds.has(game.id)),
                importUnmatched: (data.games || []).filter(game => !matchedImportIds.has(game.id)),
                matchedCount: matchedImportIds.size
            },
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
        await batchProcessor.fillExistingBggIds();

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

            const gameBggMap = new Map<string, Set<string>>();
            const addName = (name: string, id: string) => {
                const key = name.trim().toLowerCase();
                if (!key) return;
                const ids = gameBggMap.get(key) ?? new Set<string>();
                ids.add(id);
                gameBggMap.set(key, ids);
            };
            savedGames.forEach(g => {
                const id = normalizeBggId(g.bggId);
                if (id && g.name) addName(g.name, id);
            });

            // Load aliases once only when a custom template needs dictionary fallback.
            const needsDictionary = templates.some(t => !normalizeBggId(t.bggId) &&
                !gameBggMap.has(t.name.trim().toLowerCase()));
            if (needsDictionary) {
                for (const entry of await db.bggGames.toArray()) {
                    const id = normalizeBggId(entry.id);
                    if (!id) continue;
                    for (const name of [entry.name, ...(entry.altNames ?? [])]) addName(name, id);
                }
            }

            for (const [table, rows] of [[db.templates, templates], [db.builtins, builtins]] as const) {
                const targetIds = new Map<string, string>();
                for (const t of rows) {
                    if (normalizeBggId(t.bggId)) continue;
                    const ids = gameBggMap.get(t.name.trim().toLowerCase());
                    if (ids?.size !== 1) continue; // Never guess between same-name BGG identities.
                    targetIds.set(t.id, [...ids][0]);
                }
                const templateIds = [...targetIds.keys()];
                const CHUNK_SIZE = 500;
                for (let i = 0; i < templateIds.length; i += CHUNK_SIZE) {
                    const chunk = templateIds.slice(i, i + CHUNK_SIZE);
                    await db.transaction('rw', table, db.history, async () => {
                        const now = Date.now();
                        const changedIds: string[] = [];
                        await table.where('id').anyOf(chunk).modify(row => {
                            if (normalizeBggId(row.bggId)) return false;
                            row.bggId = targetIds.get(row.id)!;
                            row.updatedAt = now;
                            changedIds.push(row.id);
                        });
                        if (changedIds.length) {
                            await db.history.where('templateId').anyOf(changedIds)
                                .filter(record => !normalizeBggId(record.bggId))
                                .modify(record => fillHistoryBggId(record, targetIds.get(record.templateId)!, now) || false);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Failed to propagate BGG IDs", e);
            throw e;
        }
    }
}

export const bgStatsImportService = new BgStatsImportService();
