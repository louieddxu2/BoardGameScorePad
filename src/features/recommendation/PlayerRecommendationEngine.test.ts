import { afterEach, describe, it, expect, vi } from 'vitest';
import { db } from '../../db';
import { contextResolver, Voter } from './ContextResolver';
import { playerRecommendationEngine } from './PlayerRecommendationEngine';
import { SavedListItem } from '../../types';
import { gameTemporalContextResolver } from '../../services/relationship/GameTemporalContextResolver';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('PlayerRecommendationEngine.generateSuggestions', () => {
    const mockSavedPlayers: SavedListItem[] = [
        {
            id: 'player_1',
            name: 'Alice',
            usageCount: 10,
            lastUsed: 1000,
            meta: {
                relations: {
                    players: [
                        { id: 'player_2', count: 5 },
                        { id: 'player_3', count: 3 }
                    ]
                }
            }
        },
        {
            id: 'player_2',
            name: 'Bob',
            usageCount: 5,
            lastUsed: 500,
            meta: {
                relations: {
                    players: [
                        { id: 'player_1', count: 5 }
                    ]
                }
            }
        },
        {
            id: 'player_3',
            name: 'Charlie',
            usageCount: 8,
            lastUsed: 800,
            meta: {
                relations: {}
            }
        },
        {
            id: 'player_4',
            name: 'David',
            usageCount: 1,
            lastUsed: 100,
            meta: {
                relations: {}
            }
        }
    ];

    it('should sort by usageCount and lastUsed when no players are locked and no votes', () => {
        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: [],
            lockedNames: [],
            sessionPlayers: []
        });

        // 預期順序：Alice (10) -> Charlie (8) -> Bob (5) -> David (1)
        expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie', 'Bob', 'David']);
    });

    it('should calculate relation scores and recommend related players first', () => {
        // 鎖定 Alice
        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: ['player_1'],
            lockedNames: ['Alice'],
            sessionPlayers: []
        });

        // Alice 關係人：Bob (count 5) 與 Charlie (count 3)
        // 排除 Alice 後，Bob 分數最高排首位，Charlie 居次，其餘排後面
        expect(result.map(r => r.name)).toEqual(['Bob', 'Charlie', 'David']);
    });

    it('should exclude locked player IDs from recommendation list', () => {
        // 鎖定 Alice 與 Bob
        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: ['player_1', 'player_2'],
            lockedNames: ['Alice', 'Bob'],
            sessionPlayers: []
        });

        // 驗證 Alice 與 Bob 已被排除
        expect(result.find(r => r.id === 'player_1')).toBeUndefined();
        expect(result.find(r => r.id === 'player_2')).toBeUndefined();
        expect(result.map(r => r.name)).toEqual(['Charlie', 'David']);
    });

    it('should fill with session players when recommended count is less than 4', () => {
        // 鎖定 Alice 與 Bob，剩餘真實玩家只有 2 個，應以 Eve 與 Frank 補足
        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: mockSavedPlayers,
            contextVoters: [],
            lockedPlayerIds: ['player_1', 'player_2'],
            lockedNames: ['Alice', 'Bob'],
            sessionPlayers: [
                { id: 'session_p1', name: 'Eve' },
                { id: 'session_p2', name: 'Frank' },
                { id: 'session_p3', name: 'Charlie' } // 已有 Charlie 應排除避免重名
            ]
        });

        expect(result.map(r => r.name)).toEqual(['Charlie', 'David', 'Eve', 'Frank']);
    });

    it('uses the original five-player voting window by default', () => {
        const candidates = [
            'A', 'B', 'C', 'D', 'E', 'F'
        ].map((name, index) => ({
            id: `candidate-${name}`,
            name,
            usageCount: name === 'F' ? 100 : 1,
            lastUsed: index
        }));
        const voter: SavedListItem = {
            id: 'voter',
            name: 'Voter',
            usageCount: 1,
            lastUsed: 1,
            meta: {
                relations: {
                    players: candidates.map(candidate => ({ id: candidate.id, count: 1 }))
                }
            }
        };

        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: candidates,
            contextVoters: [{ item: voter, factor: 'game' }],
            lockedPlayerIds: [],
            lockedNames: [],
            sessionPlayers: []
        });

        expect(result.slice(0, 5).map(candidate => candidate.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
        expect(result[5].name).toBe('F');
    });

    it('applies supplied dynamic weights to the single-pass vote', () => {
        const candidates = [
            { id: 'candidate-a', name: 'A', usageCount: 1, lastUsed: 1 },
            { id: 'candidate-b', name: 'B', usageCount: 10, lastUsed: 10 }
        ];
        const voter: SavedListItem = {
            id: 'voter',
            name: 'Voter',
            usageCount: 1,
            lastUsed: 1,
            meta: {
                relations: {
                    players: [
                        { id: 'candidate-a', count: 1 },
                        { id: 'candidate-b', count: 1 }
                    ]
                }
            }
        };

        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: candidates,
            contextVoters: [{ item: voter, factor: 'game' }],
            lockedPlayerIds: [],
            lockedNames: [],
            sessionPlayers: [],
            weights: {
                game: 0,
                gamePlayStage: 1,
                gameRecency: 1,
                location: 1,
                weekday: 1,
                timeSlot: 1,
                playerCount: 1,
                gameMode: 1,
                relatedPlayer: 1,
                sessionContext: 1
            }
        });

        expect(result.map(candidate => candidate.name)).toEqual(['B', 'A']);
    });

    it('counts play-stage and recency voters in player scores', () => {
        const candidates = [
            { id: 'candidate-a', name: 'A', usageCount: 1, lastUsed: 1 },
            { id: 'candidate-b', name: 'B', usageCount: 10, lastUsed: 10 }
        ];
        const lifecycleVoter = (id: string): SavedListItem => ({
            id,
            name: id,
            usageCount: 1,
            lastUsed: 1,
            meta: {
                relations: { players: [{ id: 'candidate-a', count: 1 }] },
                confidence: { players: 1 }
            }
        });

        const result = playerRecommendationEngine.generateSuggestions({
            allSavedPlayers: candidates,
            contextVoters: [
                { item: lifecycleVoter('game_play_stage:second'), factor: 'gamePlayStage' },
                { item: lifecycleVoter('game_recency:within_7_days'), factor: 'gameRecency' }
            ],
            lockedPlayerIds: [],
            lockedNames: [],
            sessionPlayers: []
        });

        expect(result.map(candidate => candidate.name)).toEqual(['A', 'B']);
    });

    it('adds resolved play-stage and recency buckets to player context', async () => {
        const gameItem: SavedListItem = { id: 'game', name: 'Azul', usageCount: 1, lastUsed: 1 };
        vi.spyOn(contextResolver, 'resolveBaseContext').mockResolvedValue([{ item: gameItem, factor: 'game' }]);
        vi.spyOn(gameTemporalContextResolver, 'resolveFromHistory').mockResolvedValue({
            priorCount: 1,
            lastCompletedAt: 100,
            stageBucketId: 'game_play_stage:second',
            recencyBucketId: 'game_recency:within_1_day'
        });
        vi.spyOn(gameTemporalContextResolver, 'resolveBucketEntities').mockResolvedValue([
            { item: { id: 'game_play_stage:second', name: 'stage', usageCount: 1, lastUsed: 1 }, table: db.savedGameLifecycleContexts, type: 'gamePlayStage', isNewContext: true },
            { item: { id: 'game_recency:within_1_day', name: 'recency', usageCount: 1, lastUsed: 1 }, table: db.savedGameLifecycleContexts, type: 'gameRecency', isNewContext: true }
        ]);

        const voters = await contextResolver.resolvePlayerContext({ gameName: 'Azul', timestamp: 1_000 });

        expect(voters.map(voter => voter.factor)).toEqual(['game', 'gamePlayStage', 'gameRecency']);
        expect(gameTemporalContextResolver.resolveFromHistory).toHaveBeenCalledWith(expect.objectContaining({
            referenceStartTime: 1_000,
            gameName: 'Azul',
            resolvedGame: gameItem
        }));
    });

    it('builds initial player suggestions by chaining single-pass suggestions', async () => {
        const savedPlayers: SavedListItem[] = [
            { id: 'a', name: 'A', usageCount: 1, lastUsed: 1 },
            { id: 'b', name: 'B', usageCount: 1, lastUsed: 1 },
            { id: 'c', name: 'C', usageCount: 1, lastUsed: 1 }
        ];
        const contextVoter: Voter = {
            item: {
                id: 'game',
                name: 'Game',
                usageCount: 1,
                lastUsed: 1,
                meta: {
                    relations: {
                        players: [
                            { id: 'a', count: 5 },
                            { id: 'b', count: 4 },
                            { id: 'c', count: 3 }
                        ]
                    }
                }
            },
            factor: 'game'
        };

        vi.spyOn(contextResolver, 'resolvePlayerContext').mockResolvedValue([contextVoter]);
        vi.spyOn(db.savedPlayers, 'toArray').mockResolvedValue(savedPlayers);
        const generateSuggestionsSpy = vi.spyOn(playerRecommendationEngine, 'generateSuggestions');

        const result = await playerRecommendationEngine.generateInitialPlayersSuggestions({}, undefined, 2);

        expect(result.map(player => player.name)).toEqual(['A', 'B']);
        expect(generateSuggestionsSpy).toHaveBeenCalledTimes(2);
    });
});
