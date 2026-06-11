import { db } from '../../db';
import { GameTemplate, SavedListItem } from '../../types';
import { RecommendationContext, SuggestedPlayer, PlayerRecommendationWeights, DEFAULT_PLAYER_WEIGHTS, ColorRecommendationWeights, DEFAULT_COLOR_WEIGHTS } from './types';
import { contextResolver, Voter } from './ContextResolver';
import { votingEngine } from './VotingEngine';
import { RELATION_PREDICTION_CONFIG } from '../../services/relationship/RelationMapper';
import { Candidate } from '../../components/tools/player-selector/types';
import { COLORS } from '../../colors';

export interface GetRecommendedCandidatesParams {
    allSavedPlayers: SavedListItem[];
    contextVoters: Voter[];
    lockedPlayerIds: string[];
    lockedNames: string[];
    sessionPlayers: Array<{ id: string; name: string }>;
    candidateLimit?: number;
    template?: GameTemplate;
}

export function predictColorsForPlayer(
    player: SavedListItem,
    template?: GameTemplate,
    contextVoters?: Voter[],
    weights: ColorRecommendationWeights = DEFAULT_COLOR_WEIGHTS
): string[] {
    const voters: Voter[] = [];

    // 1. Template Settings (Virtual Voter)
    if (template?.supportedColors && template.supportedColors.length > 0) {
        const relations = template.supportedColors.map(c => ({ 
            id: c, 
            count: 0 
        }));
        
        voters.push({
            item: {
                id: 'template_settings_virtual',
                name: 'Template Settings',
                lastUsed: 0,
                usageCount: 0,
                meta: {
                    relations: { colors: relations },
                    confidence: { colors: 5.0 }
                }
            },
            factor: 'templateSetting'
        });
    }

    // 2. Game Voter
    if (contextVoters) {
        const gameVoter = contextVoters.find(v => v.factor === 'game');
        if (gameVoter) {
            voters.push(gameVoter);
        }
    }

    // 3. Player Voter
    voters.push({
        item: player,
        factor: 'player'
    });

    // 4. Run Synchronous Voting
    const scoresMap = votingEngine.calculateScores(
        voters, 
        weights as any, 
        'colors', 
        [], // 排除規則在 getPlayerPaletteColors 中進行，此處保留完整推薦
        20
    );

    // 5. Sort Result
    const sortedColors = Array.from(scoresMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .filter(c => c !== 'transparent');

    // 6. Fill remaining global colors
    COLORS.forEach(color => {
        if (!sortedColors.includes(color) && color !== 'transparent') {
            sortedColors.push(color);
        }
    });

    return sortedColors;
}

/**
 * 記憶體同步算分推薦玩家
 * 根據當前已鎖定玩家與背景 voters，在記憶體內直接進行一次性投票算分並排序。
 * 消除 iterations 迴圈與非同步 I/O，大幅提升視覺選擇器在操作時的反應速度。
 */
export function getRecommendedCandidatesPure({
    allSavedPlayers,
    contextVoters,
    lockedPlayerIds,
    lockedNames,
    sessionPlayers,
    candidateLimit,
    template
}: GetRecommendedCandidatesParams): Candidate[] {
    // 1. 準備投票者 (Voters)
    const voters = [...contextVoters];

    // 已鎖定的玩家也作為 Voter 參與投票
    const allSavedPlayersMap = new Map(allSavedPlayers.map(p => [p.id, p]));
    lockedPlayerIds.forEach(id => {
        const p = allSavedPlayersMap.get(id);
        if (p) {
            voters.push({ item: p, factor: 'relatedPlayer' });
        }
    });

    // 2. 呼叫 votingEngine.calculateScores (同步算分)
    // 傳入 candidateLimit (若無則預設為 allSavedPlayers.length 確保每位同玩玩家都能計分)
    const limitToUse = candidateLimit ?? allSavedPlayers.length;
    const scoresMap = votingEngine.calculateScores(
        voters,
        DEFAULT_PLAYER_WEIGHTS as unknown as Record<string, number>,
        'players',
        lockedPlayerIds,
        limitToUse
    );

    // 3. 對所有真實存檔玩家進行算分與排序 (排除已鎖定的)
    const candidatesList = allSavedPlayers
        .filter(p => !lockedPlayerIds.includes(p.id))
        .map(p => {
            const score = scoresMap.get(p.id) || 0;
            return {
                id: p.id,
                name: p.name,
                linkedPlayerId: p.id,
                score,
                usageCount: p.usageCount || 0,
                lastUsed: p.lastUsed || 0,
                suggestedColors: predictColorsForPlayer(p, template, contextVoters)
            };
        });

    // 排序優先級：
    // A. 算分 (score) 降序
    // B. usageCount 降序
    // C. lastUsed 降序
    candidatesList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        return b.lastUsed - a.lastUsed;
    });

    // 4. 將排序後的候選人轉成 Candidate[]
    let list: Candidate[] = candidatesList.map(c => ({
        id: c.id,
        name: c.name,
        linkedPlayerId: c.linkedPlayerId,
        suggestedColors: c.suggestedColors
    }));

    // 5. 推薦不足 4 人，用現有 session 中的玩家名稱補足
    if (list.length < 4) {
        const existingNames = new Set(list.map(item => item.name));
        const lockedNamesSet = new Set(lockedNames);
        const fallbackPlayers = sessionPlayers
            .filter(p => !existingNames.has(p.name) && !lockedNamesSet.has(p.name))
            .map(p => {
                const matchedSaved = allSavedPlayers.find(sp => sp.name === p.name);
                const suggestedColors = matchedSaved 
                    ? predictColorsForPlayer(matchedSaved, template, contextVoters)
                    : (template?.supportedColors && template.supportedColors.length > 0
                        ? [...template.supportedColors, ...COLORS.filter(c => !template.supportedColors?.includes(c))]
                        : COLORS);
                return {
                    id: p.id,
                    name: p.name,
                    linkedPlayerId: p.id,
                    suggestedColors: suggestedColors.filter(c => c !== 'transparent')
                };
            });
        list = [...list, ...fallbackPlayers];
    }

    return list;
}

export class PlayerRecommendationEngine {

    public async generateSuggestions(
        context: RecommendationContext, 
        weights: PlayerRecommendationWeights = DEFAULT_PLAYER_WEIGHTS,
        limit: number = 4
    ): Promise<SuggestedPlayer[]> {
        
        // 1. Initial State: Start with already selected players for chained prediction
        const selectedPlayerIds: string[] = [...(context.knownPlayerIds || [])];
        
        // 2. Resolve Base Context Voters (Game, Location, Time...) - Do this ONCE via ContextResolver
        const baseVoters = await contextResolver.resolveBaseContext(context);
        
        // 3. 一次性撈取所有存檔玩家，消除迴圈內與迴圈後的重複查詢
        const allSavedPlayers = await db.savedPlayers.toArray();
        const candidateLimit = RELATION_PREDICTION_CONFIG.players.limit;

        // 4. Iterative Selection Loop (Chained Prediction)
        for (let i = 0; i < limit; i++) {
            // 呼叫抽離出的純函式，同步於記憶體內完成算分與排序
            const candidates = getRecommendedCandidatesPure({
                allSavedPlayers,
                contextVoters: baseVoters,
                lockedPlayerIds: selectedPlayerIds,
                lockedNames: [],
                sessionPlayers: [],
                candidateLimit
            });

            if (candidates.length > 0) {
                selectedPlayerIds.push(candidates[0].id);
            } else {
                break;
            }
        }

        // 5. Resolve Details & Return
        if (selectedPlayerIds.length === 0) return [];

        const playersMap = new Map<string, SavedListItem>();
        allSavedPlayers.forEach(p => {
            if (selectedPlayerIds.includes(p.id)) {
                playersMap.set(p.id, p);
            }
        });

        // Map back to result format, preserving the ORDER of selection (excluding knownPlayerIds)
        const result: SuggestedPlayer[] = [];
        const knownSet = new Set(context.knownPlayerIds || []);
        selectedPlayerIds.forEach(id => {
            if (knownSet.has(id)) return; // 排除已鎖定的玩家
            const playerInfo = playersMap.get(id);
            if (playerInfo) {
                result.push({
                    id: playerInfo.id,
                    name: playerInfo.name,
                    score: 0, // Score is transient in loop
                    suggestedColor: this.predictColor(playerInfo)
                });
            }
        });

        return result;
    }

    private predictColor(player: SavedListItem): string | undefined {
        const rawColors = player.meta?.relations?.colors;
        if (Array.isArray(rawColors) && rawColors.length > 0) {
            const first = rawColors[0];
            if (typeof first === 'object' && first.id) return first.id;
            if (typeof first === 'string') return first;
        }
        return undefined;
    }
}

export const playerRecommendationEngine = new PlayerRecommendationEngine();
