import { describe, expect, it } from 'vitest';
import { db } from '../../db';
import {
    DEFAULT_COUNT_WEIGHTS,
    DEFAULT_LOCATION_WEIGHTS,
    DEFAULT_PLAYER_WEIGHTS
} from '../../features/recommendation/types';
import { SavedListItem } from '../../types';
import { RelationTrainer } from './RelationTrainer';
import { ResolvedEntity } from './types';

describe('RelationTrainer rank voting integration', () => {
    it('keeps an original top-N candidate correct when weighted top N excludes it', async () => {
        const sourceItem: SavedListItem = {
            id: 'game-union-hit',
            name: 'Union Hit Game',
            usageCount: 5,
            lastUsed: 1,
            meta: {
                relations: {
                    players: Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, count: 1 }))
                },
                confidence: { players: 1 },
                // N=3. Weighted top three are p1, p4 and p5, excluding raw rank p3.
                rankWeights: { players: [5, 1, 1, 4, 3, 0] }
            }
        };
        const playerWeights = { ...DEFAULT_PLAYER_WEIGHTS };

        await new RelationTrainer().trainRelations(
            {
                item: sourceItem,
                table: db.savedGames,
                type: 'game',
                isNewContext: true
            },
            [{
                item: { id: 'p3', name: 'P3', usageCount: 1, lastUsed: 1 },
                table: db.savedPlayers,
                type: 'player',
                isNewContext: true
            }],
            playerWeights,
            { ...DEFAULT_COUNT_WEIGHTS },
            { ...DEFAULT_LOCATION_WEIGHTS },
            { players: 12 }
        );

        expect(playerWeights.game).toBe(1.1);
        expect(sourceItem.meta!.confidence!.players).toBe(1.1);
    });

    it('uses the same dynamic N for the 2N rank window and top-N correctness check', async () => {
        const sourceItem: SavedListItem = {
            id: 'game-small-pool',
            name: 'Small Pool Game',
            usageCount: 3,
            lastUsed: 1,
            meta: {
                relations: {
                    players: Array.from({ length: 4 }, (_, index) => ({ id: `p${index + 1}`, count: 1 }))
                },
                confidence: { players: 1 },
                // Six saved players => N = 2. Rank 3 is promoted into the top two by vote weight.
                rankWeights: { players: [4, 1, 3, 1] }
            }
        };
        const playerWeights = { ...DEFAULT_PLAYER_WEIGHTS };

        await new RelationTrainer().trainRelations(
            {
                item: sourceItem,
                table: db.savedGames,
                type: 'game',
                isNewContext: true
            },
            [{
                item: { id: 'p3', name: 'P3', usageCount: 1, lastUsed: 1 },
                table: db.savedPlayers,
                type: 'player',
                isNewContext: true
            }],
            playerWeights,
            { ...DEFAULT_COUNT_WEIGHTS },
            { ...DEFAULT_LOCATION_WEIGHTS },
            { players: 6 }
        );

        expect(playerWeights.game).toBe(1.1);
        expect(sourceItem.meta!.confidence!.players).toBe(1.1);
        expect(sourceItem.meta!.rankWeights!.players).toHaveLength(4);
    });

    it('evaluates confidence and factor weight from the weighted prediction set before updating relations', async () => {
        const sourceItem: SavedListItem = {
            id: 'game-1',
            name: 'Game',
            usageCount: 7,
            lastUsed: 1,
            meta: {
                relations: {
                    players: Array.from({ length: 7 }, (_, index) => ({ id: `p${index + 1}`, count: 1 }))
                },
                confidence: { players: 1 },
                rankWeights: {
                    players: [5, 4, 2, 1, 0.5, 0, 2, 0.5, 0, 0]
                }
            }
        };
        const source: ResolvedEntity = {
            item: sourceItem,
            table: db.savedGames,
            type: 'game',
            isNewContext: true
        };
        const target: ResolvedEntity = {
            item: { id: 'p7', name: 'P7', usageCount: 1, lastUsed: 1 },
            table: db.savedPlayers,
            type: 'player',
            isNewContext: true
        };
        const playerWeights = { ...DEFAULT_PLAYER_WEIGHTS };

        await new RelationTrainer().trainRelations(
            source,
            [target],
            playerWeights,
            { ...DEFAULT_COUNT_WEIGHTS },
            { ...DEFAULT_LOCATION_WEIGHTS },
            { players: 20 }
        );

        // p7 was relation rank 7, but its learned vote placed it in the weighted top 5.
        expect(sourceItem.meta!.confidence!.players).toBe(1.1);
        expect(playerWeights.game).toBe(1.1);
        expect(sourceItem.meta!.rankWeights!.players[6]).toBeGreaterThanOrEqual(2);
        expect(sourceItem.meta!.rankWeights!.players.reduce((sum, value) => sum + value, 0)).toBe(15);
    });
});
