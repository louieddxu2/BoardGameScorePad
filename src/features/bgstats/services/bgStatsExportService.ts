
import { db } from '../../../db';
import { BgStatsExport, BgStatsGame, BgStatsPlayer, BgStatsLocation } from '../types';
import { HistoryRecord, BggGame } from '../../../types';
import { computeBgStatsRanks, findFirstPlays, isManualWinner, isNoPointsRule, isRecordWinner } from './bgStatsExportRules';
import { generateId } from '../../../utils/idGenerator';
import { getRecordScoringRule } from '../../../utils/historyUtils';
import { getHistoryBggId } from './bgStatsBggData';
import { isDefaultPlayerName } from '../../../utils/historyGameEntries';
import { exportUuidOf } from './bgStatsLinkMemory';

// BG Stats 以單一「匿名玩家」代表所有沒有身分的參與者。
// ScorePad 中未連結且仍用預設名稱（玩家 N / Player N）的玩家都匯出成這一位；
// uuid 固定不變，重複匯出到 BG Stats 時才會對應到同一位匿名玩家。
const ANONYMOUS_PLAYER_KEY = 'anonymous';
const ANONYMOUS_PLAYER_UUID = 'B6E1C3A0-5C0B-4F0E-9A57-2D5C0A9E7F41';
const ANONYMOUS_PLAYER_NAME = 'Anonymous player';

// Helper class to map UUIDs (strings) to Integer IDs (required by BG Stats)
class IntIdMapper {
    private map = new Map<string, number>();
    private reverseMap = new Map<number, string>();
    private counter = 1;

    public getId(uuid: string): number {
        if (!this.map.has(uuid)) {
            const newId = this.counter++;
            this.map.set(uuid, newId);
            this.reverseMap.set(newId, uuid);
            return newId;
        }
        return this.map.get(uuid)!;
    }
}

// Helper to format date as "YYYY-MM-DD HH:mm:ss"
const formatDate = (timestamp: number): string => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Helper for YYYYMMDD integer
const formatDateYmd = (timestamp: number): number => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return parseInt(`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`, 10);
};

class BgStatsExportService {
    
    public async exportData(): Promise<BgStatsExport> {
        // 1. Load all data
        const allHistory = await db.history.toArray();
        const savedPlayers = await db.savedPlayers.toArray();
        const savedLocations = await db.savedLocations.toArray();
        const savedGames = await db.savedGames.toArray(); 
        const bggGames = await db.bggGames.toArray();
        
        // Maps for fast lookup
        const bggLookup = new Map<string, BggGame>(bggGames.map(g => [g.id, g])); // Key: BGG ID String
        const playerLookup = new Map(savedPlayers.map(p => [p.id, p]));
        const locationLookup = new Map(savedLocations.map(l => [l.id, l]));
        const gameLookup = new Map(savedGames.map(g => [g.id, g]));
        
        // ID Mappers for Export Integer IDs
        const gameMapper = new IntIdMapper();
        const playerMapper = new IntIdMapper();
        const locationMapper = new IntIdMapper();

        // Temporary storage for entities found in history
        const gamesMap = new Map<number, BgStatsGame>();
        const playersMap = new Map<number, BgStatsPlayer>();
        const locationsMap = new Map<number, BgStatsLocation>();

        const plays: any[] = [];
        // Use Template Name as unique key for Game unless BGG ID is present
        const gameKeyOf = (record: HistoryRecord) => {
            const id = getHistoryBggId(record);
            return id ? `bgg:${id}` : `name:${record.gameName}`;
        };
        const firstPlays = findFirstPlays(allHistory, gameKeyOf);

        // 2. Process History Records -> Plays
        for (const record of allHistory) {
            // --- Game Resolution ---
            const bggId = getHistoryBggId(record);
            const gameKey = gameKeyOf(record);

            const gameRefId = gameMapper.getId(gameKey);

            if (!gamesMap.has(gameRefId)) {
                // Construct Game Object
                const bggData = bggId ? bggLookup.get(bggId) : undefined;
                
                // A game linked to a BG Stats game keeps that game's uuid; otherwise the local id.
                const originalUuid = exportUuidOf(gameLookup.get(record.templateId), record.templateId);

                const scoringRule = getRecordScoringRule(record);

                gamesMap.set(gameRefId, {
                    id: gameRefId,
                    uuid: originalUuid, 
                    name: record.gameName,
                    bggId: bggId ? Number(bggId) : undefined,
                    bggName: bggData?.name,
                    bggYear: bggData?.year,
                    designers: bggData?.designers,
                    // BG Stats keeps highestWins true for cooperative and no-points games.
                    highestWins: scoringRule !== 'LOWEST_WINS',
                    noPoints: isNoPointsRule(scoringRule),
                    cooperative: scoringRule === 'COOP' || scoringRule === 'COOP_NO_SCORE',
                    modificationDate: formatDate(record.updatedAt || record.endTime),
                    isBaseGame: 1,
                    isExpansion: 0,
                    rating: 0,
                    usesTeams: false
                });
            }

            // --- Location Resolution ---
            let locationRefId = 0;
            if (record.location) {
                // Use Location ID if available (preferred), else use Name
                const locKey = record.locationId || `name:${record.location}`;
                locationRefId = locationMapper.getId(locKey);
                
                if (!locationsMap.has(locationRefId)) {
                    const originalUuid = record.locationId
                        ? exportUuidOf(locationLookup.get(record.locationId), record.locationId)
                        : "";

                    locationsMap.set(locationRefId, {
                        id: locationRefId,
                        uuid: originalUuid,
                        name: record.location,
                        modificationDate: formatDate(record.updatedAt || record.endTime)
                    });
                }
            }

            // --- Player Scores Resolution ---
            const ranks = computeBgStatsRanks(record);
            const noPoints = isNoPointsRule(getRecordScoringRule(record));
            const playerScores = record.players.map((p, index) => {
                // Determine Identity
                // If linkedPlayerId exists, map to that. Otherwise map to name (anonymous)
                const isAnonymous = !p.linkedPlayerId && isDefaultPlayerName(p.name);
                const playerKey = p.linkedPlayerId || (isAnonymous ? ANONYMOUS_PLAYER_KEY : `name:${p.name}`);
                const playerRefId = playerMapper.getId(playerKey);

                if (isAnonymous && !playersMap.has(playerRefId)) {
                    playersMap.set(playerRefId, {
                        id: playerRefId,
                        uuid: ANONYMOUS_PLAYER_UUID,
                        name: ANONYMOUS_PLAYER_NAME,
                        isAnonymous: true,
                        modificationDate: formatDate(Date.now()),
                        bggUsername: ""
                    });
                }

                if (!playersMap.has(playerRefId)) {
                    // Try to find full info from saved list
                    const savedP = p.linkedPlayerId ? playerLookup.get(p.linkedPlayerId) : undefined;
                    
                    const originalUuid = p.linkedPlayerId ? exportUuidOf(savedP, p.linkedPlayerId) : "";

                    playersMap.set(playerRefId, {
                        id: playerRefId,
                        uuid: originalUuid,
                        name: p.name,
                        isAnonymous: !p.linkedPlayerId, // If no link, consider anonymous/temporary
                        modificationDate: formatDate(Date.now()),
                        bggUsername: ""
                    });
                }

                return {
                    playerRefId: playerRefId,
                    // A no-points play has no scores; BG Stats stores them blank.
                    score: noPoints ? '' : p.totalScore.toString(),
                    winner: isRecordWinner(record, p),
                    startPlayer: !!p.isStarter,
                    newPlayer: !!p.linkedPlayerId && firstPlays.has(`${record.id}|${p.linkedPlayerId}`),
                    rank: ranks[index],
                    seatOrder: index
                };
            });

            // --- Play Object ---
            plays.push({
                // [Unified UUID Strategy] record.id IS the UUID.
                uuid: record.id,
                gameRefId: gameRefId,
                locationRefId: locationRefId || undefined,
                playDate: formatDate(record.startTime),
                playDateYmd: formatDateYmd(record.startTime), // Added
                durationMin: Math.round((record.endTime - record.startTime) / 60000),
                scoringSetting: 0,
                playerScores: playerScores,
                rounds: 0,
                manualWinner: isManualWinner(record),
                ignored: false,
                importPlayId: 0,
                modificationDate: formatDate(record.updatedAt || record.endTime),
                entryDate: formatDate(record.startTime),
                comments: record.note || "",
                usesTeams: false, // Added
                playImages: "[]", // Added (Stringified JSON array)
                rating: 0
            });
        }

        // 3. Assemble Final Object
        const exportData: BgStatsExport = {
            games: Array.from(gamesMap.values()),
            players: Array.from(playersMap.values()),
            locations: Array.from(locationsMap.values()),
            plays: plays,
            userInfo: {
                meRefId: 0, // Placeholder
                exportDate: formatDate(Date.now()),
                appVersion: "BoardGameScorePad v1.0"
            }
        };

        return exportData;
    }
}

export const bgStatsExportService = new BgStatsExportService();
