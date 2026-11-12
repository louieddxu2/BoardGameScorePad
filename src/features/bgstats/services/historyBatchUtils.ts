
import { db } from '../../../db';
import { HistoryRecord, GameTemplate, Player, ScoringRule, SavedListItem } from '../../../types';
import { generateId } from '../../../utils/idGenerator';
import { BgStatsExport, BgStatsGame } from '../types';
import { fillHistoryBggId, normalizeBggId } from './bgStatsBggData';

export class HistoryBatchProcessor {
    private existingIds: Set<string> = new Set();
    private localGameMap: Map<string, SavedListItem | GameTemplate> = new Map();
    private localLocationMap: Map<string, SavedListItem> = new Map();
    
    // Cache for Source ID -> Local ID mapping from Phase 1
    private sourceGameIdToLocalId = new Map<number, string>();
    private sourcePlayerIdToLocalId = new Map<number, string>();
    private sourceLocationIdToLocalId = new Map<number, string>();

    // Source Data Lookup
    private sourceGames = new Map<number, BgStatsGame>();
    private sourcePlayers = new Map<number, any>();
    private sourceLocations = new Map<number, any>();

    constructor(private data: BgStatsExport) {
        (data.games || []).forEach(g => this.sourceGames.set(g.id, g));
        (data.players || []).forEach(p => this.sourcePlayers.set(p.id, p));
        (data.locations || []).forEach(l => this.sourceLocations.set(l.id, l));
    }

    /**
     * 預先載入所有需要的資料到記憶體中
     */
    public async prepare(
        sourceGameIdToLocalId: Map<number, string>,
        sourcePlayerIdToLocalId: Map<number, string>,
        sourceLocationIdToLocalId: Map<number, string>
    ) {
        this.sourceGameIdToLocalId = sourceGameIdToLocalId;
        this.sourcePlayerIdToLocalId = sourcePlayerIdToLocalId;
        this.sourceLocationIdToLocalId = sourceLocationIdToLocalId;

        // 1. Bulk load existing history IDs (Batch Check with Chunking)
        const playUuids = [...new Set((this.data.plays || [])
            .map(p => p.uuid)
            .filter(u => !!u))] as string[];
        
        if (playUuids.length > 0) {
            // [Optimization] Split into chunks to avoid "Transaction too large" or slow indexed queries
            const CHUNK_SIZE = 2000;
            const chunks = [];
            for (let i = 0; i < playUuids.length; i += CHUNK_SIZE) {
                chunks.push(playUuids.slice(i, i + CHUNK_SIZE));
            }

            const results = await Promise.all(chunks.map(chunk => 
                db.history.where('id').anyOf(chunk).primaryKeys()
            ));
            
            const allExisting = results.flat();
            this.existingIds = new Set(allExisting as string[]);
        }

        // 2. Bulk load referenced Local Entities (Games, Locations)
        // 這是為了在轉換 HistoryRecord 時能取得正確的 name (snapshot)
        const neededGameIds = new Set(sourceGameIdToLocalId.values());
        const neededLocationIds = new Set(sourceLocationIdToLocalId.values());

        // Load Games (SavedGames + Templates + Builtins)
        const savedGames = await db.savedGames.where('id').anyOf([...neededGameIds]).toArray();
        const templates = await db.templates.where('id').anyOf([...neededGameIds]).toArray();
        const builtins = await db.builtins.where('id').anyOf([...neededGameIds]).toArray();
        
        savedGames.forEach(g => this.localGameMap.set(g.id, g));
        for (const t of [...templates, ...builtins]) {
            const bggId = normalizeBggId(t.bggId) ?? normalizeBggId(this.localGameMap.get(t.id)?.bggId);
            this.localGameMap.set(t.id, { ...t, bggId });
        }

        // Load Locations
        const savedLocations = await db.savedLocations.where('id').anyOf([...neededLocationIds]).toArray();
        savedLocations.forEach(l => this.localLocationMap.set(l.id, l));
    }

    /** Patch existing plays by their play UUID, not by a name or a surviving template. */
    public async fillExistingBggIds(): Promise<void> {
        const idsByUuid = new Map<string, Set<string>>();
        const localIdsByUuid = new Map<string, Set<string>>();
        for (const play of this.data.plays || []) {
            if (!this.existingIds.has(play.uuid)) continue;
            const bggId = normalizeBggId(this.sourceGames.get(play.gameRefId)?.bggId);
            if (!bggId) continue;
            const ids = idsByUuid.get(play.uuid) ?? new Set<string>();
            ids.add(bggId);
            idsByUuid.set(play.uuid, ids);
            const localId = this.sourceGameIdToLocalId.get(play.gameRefId);
            const localBggId = normalizeBggId(localId ? this.localGameMap.get(localId)?.bggId : undefined);
            if (localBggId) {
                const localIds = localIdsByUuid.get(play.uuid) ?? new Set<string>();
                localIds.add(localBggId);
                localIdsByUuid.set(play.uuid, localIds);
            }
        }
        // Conflicting copies of a UUID within one file are not a reliable source of a new ID.
        const incomingIds = new Map([...idsByUuid]
            .filter(([uuid, ids]) => ids.size === 1 && (localIdsByUuid.get(uuid)?.size ?? 0) <= 1)
            .map(([uuid, ids]) => [uuid, [...(localIdsByUuid.get(uuid) ?? ids)][0]]));
        const uuids = [...incomingIds.keys()];
        const CHUNK_SIZE = 500;
        for (let i = 0; i < uuids.length; i += CHUNK_SIZE) {
            const chunk = uuids.slice(i, i + CHUNK_SIZE);
            await db.transaction('rw', db.history, async () => {
                const now = Date.now();
                await db.history.where('id').anyOf(chunk).modify(record =>
                    fillHistoryBggId(record, incomingIds.get(record.id)!, now) || false
                );
            });
        }
    }

    /**
     * 執行轉換邏輯 (CPU Bound, no DB IO)
     */
    public processPlays(): HistoryRecord[] {
        const result: HistoryRecord[] = [];
        const seenIds = new Set(this.existingIds);
        
        for (const play of (this.data.plays || [])) {
            // Skip existing records
            if (play.uuid && seenIds.has(play.uuid)) continue;

            const sourceGame = this.sourceGames.get(play.gameRefId);
            if (!sourceGame) continue;

            const localGameId = this.sourceGameIdToLocalId.get(play.gameRefId);
            if (!localGameId) continue;

            // Resolve Game Name
            const localGame = this.localGameMap.get(localGameId);
            const gameName = localGame?.name || sourceGame.name;
            const bggId = normalizeBggId(localGame?.bggId) ?? normalizeBggId(sourceGame.bggId);

            // Resolve Location
            let localLocationName: string | undefined;
            let localLocationId: string | undefined;

            if (play.locationRefId) {
                const sourceLoc = this.sourceLocations.get(play.locationRefId);
                if (sourceLoc) {
                    localLocationId = this.sourceLocationIdToLocalId.get(play.locationRefId);
                    if (localLocationId) {
                         const localLoc = this.localLocationMap.get(localLocationId);
                         localLocationName = localLoc?.name || sourceLoc.name;
                    } else {
                        localLocationName = sourceLoc.name;
                    }
                }
            }

            // Resolve Players
            const players: Player[] = [];
            const winnerIds: string[] = [];

            if (Array.isArray(play.playerScores)) {
                play.playerScores.forEach((ps: any, index: number) => {
                    const sourcePlayer = this.sourcePlayers.get(ps.playerRefId);
                    let name = `玩家 ${index + 1}`;
                    let localPlayerId: string | undefined;

                    if (sourcePlayer) {
                        if (sourcePlayer.isAnonymous) {
                             name = `玩家 ${index + 1}`;
                        } else {
                            localPlayerId = this.sourcePlayerIdToLocalId.get(ps.playerRefId);
                            name = sourcePlayer.name;
                        }
                    }

                    const scoreStr = ps.score || "0";
                    const scoreNum = parseFloat(scoreStr);
                    const validScore = isNaN(scoreNum) ? 0 : scoreNum;
                    const sessionPlayerId = `player_${index + 1}`;

                    players.push({
                        id: sessionPlayerId,
                        name: name,
                        color: 'transparent',
                        scores: {},
                        totalScore: validScore,
                        linkedPlayerId: localPlayerId,
                        isStarter: ps.startPlayer === true || ps.startPlayer === 1
                    });

                    if (ps.winner === true || ps.winner === 1) {
                        winnerIds.push(sessionPlayerId);
                    }
                });
            }

            const snapshotTemplate = this.createEmptySnapshot(sourceGame);
            snapshotTemplate.bggId = bggId;
            
            let scoringRule: ScoringRule = 'HIGHEST_WINS';
            if (sourceGame.cooperative) {
                scoringRule = sourceGame.noPoints ? 'COOP_NO_SCORE' : 'COOP';
            } else if (sourceGame.noPoints) {
                scoringRule = 'COMPETITIVE_NO_SCORE';
            } else if (!sourceGame.highestWins) {
                scoringRule = 'LOWEST_WINS';
            }

            const record: HistoryRecord = {
                id: play.uuid || generateId(),
                templateId: localGameId,
                gameName: gameName,
                bggId,
                startTime: this.parseDate(play.playDate),
                endTime: this.parseDate(play.playDate) + (play.durationMin || 0) * 60000,
                updatedAt: Date.now(),
                players: players,
                winnerIds: winnerIds,
                snapshotTemplate: snapshotTemplate,
                location: localLocationName,
                locationId: localLocationId,
                note: play.comments || "",
                scoringRule: scoringRule
            };

            result.push(record);
            seenIds.add(record.id);
        }

        return result;
    }

    private parseDate(dateStr: string): number {
        try {
            const d = new Date(dateStr.replace(' ', 'T'));
            if (!isNaN(d.getTime())) return d.getTime();
        } catch(e) {}
        return Date.now();
    }

    private createEmptySnapshot(sourceGame: BgStatsGame): GameTemplate {
        let scoringRule: ScoringRule = 'HIGHEST_WINS';
        if (sourceGame.cooperative) {
            scoringRule = sourceGame.noPoints ? 'COOP_NO_SCORE' : 'COOP';
        } else if (sourceGame.noPoints) {
            scoringRule = 'COMPETITIVE_NO_SCORE';
        } else if (!sourceGame.highestWins) {
            scoringRule = 'LOWEST_WINS';
        }

        return {
            id: generateId(), 
            name: sourceGame.name,
            bggId: normalizeBggId(sourceGame.bggId),
            columns: [], 
            createdAt: Date.now(),
            updatedAt: Date.now(),
            description: "Imported from BG Stats",
            defaultScoringRule: scoringRule
        };
    }
}
