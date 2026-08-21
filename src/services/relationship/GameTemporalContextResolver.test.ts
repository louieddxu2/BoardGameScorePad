import { describe, expect, it } from 'vitest';
import { DEFAULT_COUNT_WEIGHTS, DEFAULT_LOCATION_WEIGHTS, DEFAULT_PLAYER_WEIGHTS } from '../../features/recommendation/types';
import { HistoryRecord, Player, SavedListItem } from '../../types';
import { RelationMapper } from './RelationMapper';
import { relationTrainer } from './RelationTrainer';
import {
    classifyGamePlayStage,
    classifyGameRecency,
    classifyGameTemporalContext,
    createLifecycleBucketItems,
    GAME_LIFECYCLE_RELATION_TARGET_SCOPE,
    gameTemporalContextResolver,
    sortHistoryRecordsStable
} from './GameTemporalContextResolver';
import { ResolvedEntity } from './types';

const DAY = 24 * 60 * 60 * 1000;
const table = {} as ResolvedEntity['table'];

function player(id: string): Player {
    return { id, name: id, color: 'transparent', scores: {}, totalScore: 0 };
}

function record(id: string, startTime: number, endTime: number, players: Player[] = []): HistoryRecord {
    return {
        id,
        templateId: 'template-a',
        gameName: 'Azul',
        startTime,
        endTime,
        players,
        winnerIds: [],
        snapshotTemplate: {} as HistoryRecord['snapshotTemplate']
    };
}

function savedItem(id: string, extra: Partial<SavedListItem> = {}): SavedListItem {
    return { id, name: id, lastUsed: 0, usageCount: 0, meta: { relations: {}, confidence: {} }, ...extra };
}

async function trainSequence(input: HistoryRecord[]) {
    const records = sortHistoryRecordsStable(input);
    const buckets = new Map(createLifecycleBucketItems().map(item => [item.id, item]));
    const players = new Map(['p1', 'p2'].map(id => [id, savedItem(id)]));
    const weights = { ...DEFAULT_PLAYER_WEIGHTS };
    const game = savedItem('game-azul', { name: 'Azul' });

    for (const current of records) {
        const temporal = gameTemporalContextResolver.resolveFromSavedGameStats(game, current.startTime);

        for (const bucketId of [temporal.stageBucketId, ...(temporal.recencyBucketId ? [temporal.recencyBucketId] : [])]) {
            const bucket = buckets.get(bucketId)!;
            const source: ResolvedEntity = {
                item: bucket,
                table,
                type: bucketId.startsWith('game_play_stage:') ? 'gamePlayStage' : 'gameRecency',
                isNewContext: true,
                relationTargetScope: [...GAME_LIFECYCLE_RELATION_TARGET_SCOPE],
                relationSourceScope: [...GAME_LIFECYCLE_RELATION_TARGET_SCOPE]
            };
            const targets: ResolvedEntity[] = current.players.map(value => ({
                item: players.get(value.id)!, table, type: 'player', isNewContext: true
            }));
            bucket.usageCount++;
            bucket.lastUsed = Math.max(bucket.lastUsed, current.endTime);
            await relationTrainer.trainRelations(
                source,
                targets,
                weights,
                { ...DEFAULT_COUNT_WEIGHTS },
                { ...DEFAULT_LOCATION_WEIGHTS },
                { players: players.size }
            );
        }
        game.usageCount++;
        game.lastUsed = Math.max(game.lastUsed, current.endTime);
    }

    return {
        buckets: [...buckets.values()],
        weights
    };
}

describe('game lifecycle bucket boundaries', () => {
    it.each([
        [0, 'game_play_stage:first'],
        [1, 'game_play_stage:second'],
        [2, 'game_play_stage:third_to_fourth'],
        [3, 'game_play_stage:third_to_fourth'],
        [4, 'game_play_stage:fifth_to_ninth'],
        [8, 'game_play_stage:fifth_to_ninth'],
        [9, 'game_play_stage:tenth_plus']
    ])('maps prior count %i to %s', (count, expected) => {
        expect(classifyGamePlayStage(count)).toBe(expected);
    });

    it.each([
        [DAY, 'game_recency:within_1_day'],
        [DAY + 1, 'game_recency:within_7_days'],
        [7 * DAY, 'game_recency:within_7_days'],
        [7 * DAY + 1, 'game_recency:within_30_days'],
        [30 * DAY, 'game_recency:within_30_days'],
        [30 * DAY + 1, 'game_recency:within_90_days'],
        [90 * DAY, 'game_recency:within_90_days'],
        [90 * DAY + 1, 'game_recency:over_90_days']
    ])('maps elapsed time %i to %s', (elapsed, expected) => {
        expect(classifyGameRecency(elapsed)).toBe(expected);
    });

    it('creates first without recency and defines exactly ten empty buckets', () => {
        const temporal = classifyGameTemporalContext(0, 1_000);
        const buckets = createLifecycleBucketItems();
        expect(temporal.stageBucketId).toBe('game_play_stage:first');
        expect(temporal.recencyBucketId).toBeUndefined();
        expect(buckets).toHaveLength(10);
        expect(new Set(buckets.map(bucket => bucket.id)).size).toBe(10);
    });
});

describe('lifecycle replay consistency', () => {
    const chronological = [
        record('a', 100, 200, [player('p1')]),
        record('b', 1_000, 1_100, [player('p2')]),
        record('c', 2_000, 2_100, [player('p1'), player('p2')])
    ];

    it('classifies each replayed record from accumulated saved game statistics', async () => {
        const replay = await trainSequence(chronological);
        expect(replay.buckets.find(bucket => bucket.id === 'game_play_stage:first')).toMatchObject({ usageCount: 1 });
        expect(replay.buckets.find(bucket => bucket.id === 'game_play_stage:second')).toMatchObject({ usageCount: 1 });
        expect(replay.buckets.find(bucket => bucket.id === 'game_play_stage:third_to_fourth')).toMatchObject({ usageCount: 1 });
    });

    it('produces the same model from unordered batch input', async () => {
        const ordered = await trainSequence(chronological);
        const unordered = await trainSequence([chronological[2], chronological[0], chronological[1]]);
        expect(unordered).toEqual(ordered);
    });
});

describe('lifecycle relation scope', () => {
    it('learns broad non-game context in both directions without game relations or unrelated factors', async () => {
        const bucket: ResolvedEntity = {
            item: savedItem('game_play_stage:first'), table, type: 'gamePlayStage', isNewContext: true,
            relationTargetScope: [...GAME_LIFECYCLE_RELATION_TARGET_SCOPE],
            relationSourceScope: [...GAME_LIFECYCLE_RELATION_TARGET_SCOPE]
        };
        const playerEntity: ResolvedEntity = { item: savedItem('p1'), table, type: 'player', isNewContext: true };
        const gameEntity: ResolvedEntity = { item: savedItem('g1'), table, type: 'game', isNewContext: true };
        const locationEntity: ResolvedEntity = { item: savedItem('l1'), table, type: 'location', isNewContext: true };
        const weekdayEntity: ResolvedEntity = { item: savedItem('w1'), table, type: 'weekday', isNewContext: true };
        const timeSlotEntity: ResolvedEntity = { item: savedItem('t1'), table, type: 'timeslot', isNewContext: true };
        const playerCountEntity: ResolvedEntity = { item: savedItem('c1'), table, type: 'playerCount', isNewContext: true };
        const gameModeEntity: ResolvedEntity = { item: savedItem('m1'), table, type: 'gameMode', isNewContext: true };
        const gameSource: ResolvedEntity = { item: savedItem('g1'), table, type: 'game', isNewContext: true };
        const countWeights = { ...DEFAULT_COUNT_WEIGHTS };
        const locationWeights = { ...DEFAULT_LOCATION_WEIGHTS };

        await relationTrainer.trainRelations(
            bucket,
            [playerEntity, gameEntity, locationEntity, weekdayEntity, timeSlotEntity, playerCountEntity, gameModeEntity],
            { ...DEFAULT_PLAYER_WEIGHTS },
            countWeights,
            locationWeights,
            { players: 1, games: 1, locations: 1, weekdays: 7, timeSlots: 8, playerCounts: 24, gameModes: 5 }
        );
        await relationTrainer.trainRelations(
            bucket,
            [locationEntity, playerCountEntity],
            { ...DEFAULT_PLAYER_WEIGHTS },
            countWeights,
            locationWeights,
            { locations: 1, playerCounts: 24 }
        );
        for (const source of [playerEntity, locationEntity, weekdayEntity, timeSlotEntity, playerCountEntity, gameModeEntity]) {
            await relationTrainer.trainRelations(
                source, [bucket], { ...DEFAULT_PLAYER_WEIGHTS }, { ...DEFAULT_COUNT_WEIGHTS },
                { ...DEFAULT_LOCATION_WEIGHTS }, { gamePlayStages: 1 }
            );
        }
        await relationTrainer.trainRelations(
            gameSource, [bucket], { ...DEFAULT_PLAYER_WEIGHTS }, { ...DEFAULT_COUNT_WEIGHTS },
            { ...DEFAULT_LOCATION_WEIGHTS }, { gamePlayStages: 1 }
        );

        expect(GAME_LIFECYCLE_RELATION_TARGET_SCOPE).toEqual([
            'players', 'locations', 'weekdays', 'timeSlots', 'playerCounts', 'gameModes'
        ]);
        expect(Object.keys(bucket.item.meta!.relations!)).toEqual([
            'players', 'locations', 'weekdays', 'timeSlots', 'playerCounts', 'gameModes'
        ]);
        expect(bucket.item.meta!.relations!.games).toBeUndefined();
        for (const source of [playerEntity, locationEntity, weekdayEntity, timeSlotEntity, playerCountEntity, gameModeEntity]) {
            expect(source.item.meta!.relations!.gamePlayStages).toEqual([
                { id: 'game_play_stage:first', count: 1 }
            ]);
        }
        expect(gameSource.item.meta!.relations).toEqual({});
        expect(RelationMapper.getCountRecommendationFactor('gamePlayStage')).toBe('gamePlayStage');
        expect(RelationMapper.getCountRecommendationFactor('gameRecency')).toBe('gameRecency');
        expect(RelationMapper.getLocationRecommendationFactor('gamePlayStage')).toBe('gamePlayStage');
        expect(RelationMapper.getLocationRecommendationFactor('gameRecency')).toBe('gameRecency');
        expect(countWeights.gamePlayStage).toBeGreaterThan(1);
        expect(locationWeights.gamePlayStage).toBeGreaterThan(1);
        expect(RelationMapper.getColorRecommendationFactor('gamePlayStage')).toBeUndefined();
    });
});
