
import { db } from '../../../db';
import { BgStatsExport, BgStatsGame, BgStatsPlayer, BgStatsLocation } from '../types';
import { HistoryRecord, BggGame } from '../../../types';
import { getScoreRank } from '../../../utils/ranking';
import { generateId } from '../../../utils/idGenerator';
import { getRecordScoringRule, getRecordBggId } from '../../../utils/historyUtils';

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
        
        // ID Mappers for Export Integer IDs
        const gameMapper = new IntIdMapper();
        const playerMapper = new IntIdMapper();
        const locationMapper = new IntIdMapper();

        // Temporary storage for entities found in history
        const gamesMap = new Map<number, BgStatsGame>();
        const playersMap = new Map<number, BgStatsPlayer>();
        const locationsMap = new Map<number, BgStatsLocation>();

        const plays: any[] = [];

        // 2. Process History Records -> Plays
        for (const record of allHistory) {
            // --- Game Resolution ---
            const bggId = getRecordBggId(record);
            // Use Template Name as unique key for Game unless BGG ID is present
            const gameKey = bggId 
                ? `bgg:${bggId}` 
                : `name:${record.gameName}`;
            
            const gameRefId = gameMapper.getId(gameKey);

            if (!gamesMap.has(gameRefId)) {
                // Construct Game Object
                const bggData = bggId ? bggLookup.get(bggId) : undefined;
                
                // [Unified UUID Strategy] Use record.templateId as the UUID if no specific logic overrides it.
                // Or better, use the ID of the SavedGame if available. 
                // Since we don't have bgStatsId map anymore, we need a stable ID.
                // record.templateId is the stable local ID for the game definition.
                const originalUuid = record.templateId;

                const scoringRule = getRecordScoringRule(record);

                gamesMap.set(gameRefId, {
                    id: gameRefId,
                    uuid: originalUuid, 
                    name: record.gameName,
                    bggId: bggData ? parseInt(bggData.id) : undefined,
                    bggName: bggData?.name,
                    bggYear: bggData?.year,
                    designers: bggData?.designers,
                    highestWins: scoringRule === 'HIGHEST_WINS',
                    noPoints: scoringRule === 'COMPETITIVE_NO_SCORE' || scoringRule === 'COOP_NO_SCORE',
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
                    const originalUuid = record.locationId || "";

                    locationsMap.set(locationRefId, {
                        id: locationRefId,
                        uuid: originalUuid,
                        name: record.location,
                        modificationDate: formatDate(record.updatedAt || record.endTime)
                    });
                }
            }

            // --- Player Scores Resolution ---
            // Pre-calculate ranks for this play
            const scores = record.players.map(p => p.totalScore);
            const playerScores = record.players.map((p, index) => {
                // Determine Identity
                // If linkedPlayerId exists, map to that. Otherwise map to name (anonymous)
                const playerKey = p.linkedPlayerId || `name:${p.name}`;
                const playerRefId = playerMapper.getId(playerKey);

                if (!playersMap.has(playerRefId)) {
                    // Try to find full info from saved list
                    const savedP = p.linkedPlayerId ? playerLookup.get(p.linkedPlayerId) : undefined;
                    
                    const originalUuid = p.linkedPlayerId || "";

                    playersMap.set(playerRefId, {
                        id: playerRefId,
                        uuid: originalUuid,
                        name: p.name,
                        isAnonymous: !p.linkedPlayerId, // If no link, consider anonymous/temporary
                        modificationDate: formatDate(Date.now()),
                        bggUsername: ""
                    });
                }

                // Check winner status (support legacy ID or linked ID)
                const isWinner = record.winnerIds.includes(p.id) || (p.linkedPlayerId && record.winnerIds.includes(p.linkedPlayerId));
                
                // Calculate Rank
                const rank = getScoreRank(p.totalScore, scores);

                return {
                    playerRefId: playerRefId,
                    score: p.totalScore.toString(),
                    winner: !!isWinner,
                    startPlayer: !!p.isStarter,
                    newPlayer: false, // Default false
                    rank: rank,
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
                manualWinner: false,
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
