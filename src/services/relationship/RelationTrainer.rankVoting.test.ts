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
