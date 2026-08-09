import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { DEFAULT_COUNT_WEIGHTS, DEFAULT_LOCATION_WEIGHTS, DEFAULT_PLAYER_WEIGHTS } from '../../features/recommendation/types';
import { HistoryRecord, Player, SavedListItem } from '../../types';
import { RelationMapper } from './RelationMapper';
import { relationTrainer } from './RelationTrainer';
import {
    classifyGamePlayStage,
    classifyGameRecency,
    classifyGameTemporalContext,
    createLifecycleBucketItems,
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

async function trainSequence(input: HistoryRecord[], mode: 'single' | 'batch') {
    const records = sortHistoryRecordsStable(input);
    const buckets = new Map(createLifecycleBucketItems().map(item => [item.id, item]));
    const players = new Map(['p1', 'p2'].map(id => [id, savedItem(id)]));
    const weights = { ...DEFAULT_PLAYER_WEIGHTS };
    const state = gameTemporalContextResolver.createRunningState();

    for (const current of records) {
        let temporal;
        if (mode === 'single') {
            const prior = records.filter(candidate =>
                candidate.id !== current.id &&
                candidate.startTime < current.startTime &&
                candidate.endTime < current.startTime
            );
            const lastEnd = prior.reduce<number | undefined>(
                (latest, candidate) => latest === undefined ? candidate.endTime : Math.max(latest, candidate.endTime),
                undefined
            );
            temporal = classifyGameTemporalContext(prior.length, current.startTime, lastEnd);
        } else {
            temporal = gameTemporalContextResolver.resolveFromRunningState(state, current.startTime);
        }

        for (const bucketId of [temporal.stageBucketId, ...(temporal.recencyBucketId ? [temporal.recencyBucketId] : [])]) {
            const bucket = buckets.get(bucketId)!;
            const source: ResolvedEntity = {
                item: bucket,
                table,
                type: bucketId.startsWith('game_play_stage:') ? 'gamePlayStage' : 'gameRecency',
                isNewContext: true,
                relationTargetScope: ['players'],
                canBeRelationTarget: false
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

        if (mode === 'batch') gameTemporalContextResolver.recordCompletion(state, current);
    }

    return {
        buckets: [...buckets.values()],
        weights
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

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

describe('game identity and temporal history', () => {
    it('prefers BGG ID and lets older no-BGG records match the resolved game fallback', () => {
        const resolved = savedItem('saved-azul', { name: 'Azul', bggId: '230802' });
        const identity = gameTemporalContextResolver.resolveIdentity({ gameName: 'Azul' }, resolved);
        expect(identity).toBe('bgg:230802');
        expect(gameTemporalContextResolver.recordsMatchGame(record('old', 1, 2), identity, resolved)).toBe(true);
        expect(gameTemporalContextResolver.recordsMatchGame({ ...record('other', 1, 2), bggId: '999' }, identity, resolved)).toBe(false);
        expect(gameTemporalContextResolver.resolveIdentity({ gameName: '  AZUL  ' })).toBe('name:azul');
    });

    it('excludes current and future records even when they are already returned from storage', async () => {
        const current = record('current', 1_000, 500);
        const future = record('future', 3_000, 400);
        const below = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([current, future]) });
        vi.spyOn(db.history, 'where').mockReturnValue({ below } as never);

        const result = await gameTemporalContextResolver.resolveFromHistory({
            referenceStartTime: current.startTime,
            currentRecordId: current.id,
            gameName: current.gameName
        });

        expect(result.priorCount).toBe(0);
        expect(result.stageBucketId).toBe('game_play_stage:first');
        expect(result.recencyBucketId).toBeUndefined();
    });
});

describe('lifecycle replay consistency', () => {
    const chronological = [
        record('a', 100, 200, [player('p1')]),
        record('b', 1_000, 1_100, [player('p2')]),
        record('c', 2_000, 2_100, [player('p1'), player('p2')])
    ];

    it('produces identical relations, confidence and weights for sequential settlement and batch replay', async () => {
        const single = await trainSequence(chronological, 'single');
        const batch = await trainSequence(chronological, 'batch');
        expect(batch).toEqual(single);
    });

    it('produces the same model from unordered batch input', async () => {
        const ordered = await trainSequence(chronological, 'batch');
        const unordered = await trainSequence([chronological[2], chronological[0], chronological[1]], 'batch');
        expect(unordered).toEqual(ordered);
    });

    it('does not let equal-start records become prior to each other', () => {
        const state = gameTemporalContextResolver.createRunningState();
        expect(gameTemporalContextResolver.resolveFromRunningState(state, 100).priorCount).toBe(0);
        gameTemporalContextResolver.recordCompletion(state, { id: 'a', endTime: 50 });
        expect(gameTemporalContextResolver.resolveFromRunningState(state, 100).priorCount).toBe(0);
        expect(gameTemporalContextResolver.resolveFromRunningState(state, 101).priorCount).toBe(1);
    });
});

describe('lifecycle relation scope', () => {
    it('learns players only, cannot become a target, and has no count/location/color factor', async () => {
        const bucket: ResolvedEntity = {
            item: savedItem('game_play_stage:first'), table, type: 'gamePlayStage', isNewContext: true,
            relationTargetScope: ['players'], canBeRelationTarget: false
        };
        const playerEntity: ResolvedEntity = { item: savedItem('p1'), table, type: 'player', isNewContext: true };
        const gameEntity: ResolvedEntity = { item: savedItem('g1'), table, type: 'game', isNewContext: true };
        const locationSource: ResolvedEntity = { item: savedItem('l1'), table, type: 'location', isNewContext: true };

        await relationTrainer.trainRelations(
            bucket, [playerEntity, gameEntity], { ...DEFAULT_PLAYER_WEIGHTS }, { ...DEFAULT_COUNT_WEIGHTS },
            { ...DEFAULT_LOCATION_WEIGHTS }, { players: 1, games: 1 }
        );
        await relationTrainer.trainRelations(
            locationSource, [bucket], { ...DEFAULT_PLAYER_WEIGHTS }, { ...DEFAULT_COUNT_WEIGHTS },
            { ...DEFAULT_LOCATION_WEIGHTS }, { gamePlayStages: 1 }
        );

        expect(Object.keys(bucket.item.meta!.relations!)).toEqual(['players']);
        expect(locationSource.item.meta!.relations).toEqual({});
        expect(RelationMapper.getCountRecommendationFactor('gamePlayStage')).toBeUndefined();
        expect(RelationMapper.getLocationRecommendationFactor('gamePlayStage')).toBeUndefined();
        expect(RelationMapper.getColorRecommendationFactor('gamePlayStage')).toBeUndefined();
    });
});
