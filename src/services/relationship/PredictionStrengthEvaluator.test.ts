import { describe, expect, it } from 'vitest';
import { HistoryRecord, SavedListItem } from '../../types';
import { DEFAULT_COLOR_WEIGHTS, DEFAULT_COUNT_WEIGHTS, DEFAULT_LOCATION_WEIGHTS, DEFAULT_PLAYER_WEIGHTS } from '../../features/recommendation/types';
import { PredictionStrengthEvaluator, summarizeRecentPredictionStrength } from './PredictionStrengthEvaluator';
import { ResolvedEntity } from './types';

const table = {} as ResolvedEntity['table'];
const item = (id: string, relations: Record<string, unknown> = {}, usageCount = 1): SavedListItem => ({
    id,
    name: id,
    lastUsed: 1,
    usageCount,
    meta: { relations, confidence: {} }
});
const entity = (value: SavedListItem, type: ResolvedEntity['type']): ResolvedEntity => ({
    item: value,
    type,
    table,
    isNewContext: true
});

describe('PredictionStrengthEvaluator', () => {
    it('uses the actual player count as denominator and evaluates the pre-training vote', () => {
        const p1 = item('p1');
        const p2 = item('p2');
        const p3 = item('p3');
        const game = item('game', { players: [{ id: 'p1' }, { id: 'p3' }] });
        const record = {
            id: 'h1', startTime: 10, endTime: 20, templateId: 't', gameName: 'G',
            players: [
                { id: 'p1', name: 'p1', color: 'red', scores: {}, totalScore: 0 },
                { id: 'p2', name: 'p2', color: 'blue', scores: {}, totalScore: 0 }
            ],
            winnerIds: [], snapshotTemplate: { id: 't', name: 'G', columns: [], createdAt: 1 }
        } as HistoryRecord;

        const outcome = new PredictionStrengthEvaluator().evaluate(
            record,
            [entity(game, 'game'), entity(p1, 'player'), entity(p2, 'player')],
            [p1, p2, p3],
            [],
            { player: DEFAULT_PLAYER_WEIGHTS, count: DEFAULT_COUNT_WEIGHTS, location: DEFAULT_LOCATION_WEIGHTS, color: DEFAULT_COLOR_WEIGHTS }
        );

        expect(outcome.player).toEqual({ hits: 1, total: 2 });
    });

    it('does not score a model when no prior prediction can be produced', () => {
        const p1 = item('p1', {}, 0);
        const record = {
            id: 'h1', startTime: 10, endTime: 20, templateId: 't', gameName: 'G',
            players: [{ id: 'p1', name: 'p1', color: 'transparent', scores: {}, totalScore: 0 }],
            winnerIds: [], snapshotTemplate: { id: 't', name: 'G', columns: [], createdAt: 1 }
        } as HistoryRecord;
        const outcome = new PredictionStrengthEvaluator().evaluate(
            record,
            [entity(item('game'), 'game'), entity(p1, 'player')],
            [p1],
            [],
            { player: DEFAULT_PLAYER_WEIGHTS, count: DEFAULT_COUNT_WEIGHTS, location: DEFAULT_LOCATION_WEIGHTS, color: DEFAULT_COLOR_WEIGHTS }
        );
        expect(outcome).toEqual({});
    });

    it('evaluates count, location, and per-player color with their live voting windows', () => {
        const player = item('p1', { colors: [{ id: 'blue' }] });
        const game = item('game', {
            playerCounts: [{ id: 'count_3' }],
            locations: [{ id: 'home' }]
        });
        const home = item('home');
        const record = {
            id: 'h2', startTime: 10, endTime: 20, templateId: 't', gameName: 'G', location: 'Home',
            players: [{ id: 'p1', name: 'p1', color: 'blue', scores: {}, totalScore: 0 }],
            winnerIds: [], snapshotTemplate: { id: 't', name: 'G', columns: [], createdAt: 1 }
        } as HistoryRecord;
        const outcome = new PredictionStrengthEvaluator().evaluate(
            record,
            [entity(game, 'game'), entity(player, 'player'), entity(item('count_3'), 'playerCount'), entity(home, 'location')],
            [player],
            [home],
            { player: DEFAULT_PLAYER_WEIGHTS, count: DEFAULT_COUNT_WEIGHTS, location: DEFAULT_LOCATION_WEIGHTS, color: DEFAULT_COLOR_WEIGHTS }
        );
        expect(outcome.count).toEqual({ hits: 1, total: 1 });
        expect(outcome.location).toEqual({ hits: 1, total: 1 });
        expect(outcome.color).toEqual({ hits: 1, total: 1 });
    });
});

describe('summarizeRecentPredictionStrength', () => {
    it('uses only the latest ten evaluable games and sums their denominators', () => {
        const logs = Array.from({ length: 11 }, (_, index) => ({
            historyId: String(index),
            status: 'processed' as const,
            lastProcessedAt: index,
            referenceStartTime: index,
            predictionStrength: { player: { hits: index === 0 ? 0 : 1, total: 2 } }
        }));
        expect(summarizeRecentPredictionStrength(logs, 'player')).toEqual({
            hits: 10,
            total: 20,
            games: 10,
            rate: 0.5
        });
    });

    it('averages each game equally instead of pooling all player appearances', () => {
        const logs = [
            {
                historyId: 'small', status: 'processed' as const, lastProcessedAt: 1,
                predictionStrength: { player: { hits: 1, total: 2 } }
            },
            {
                historyId: 'large', status: 'processed' as const, lastProcessedAt: 2,
                predictionStrength: { player: { hits: 4, total: 4 } }
            }
        ];
        expect(summarizeRecentPredictionStrength(logs, 'player')).toEqual({
            hits: 5,
            total: 6,
            games: 2,
            rate: 0.75
        });
    });
});
