import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryRecord, SavedListItem } from '../../types';

const testDb = vi.hoisted(() => {
    type Row = Record<string, any>;

    const createTable = (initial: Row[] = []) => {
        const rows = [...initial];
        return {
            rows,
            toArray: vi.fn(async () => rows),
            count: vi.fn(async () => rows.length),
            bulkGet: vi.fn(async (ids: string[]) => ids.map(id => rows.find(row => row.id === id))),
            where: vi.fn((key: string) => ({
                anyOf: vi.fn((values: string[]) => ({
                    toArray: vi.fn(async () => rows.filter(row => values.includes(row[key])))
                }))
            })),
            bulkPut: vi.fn(async (items: Row[]) => {
                for (const item of items) {
                    const index = rows.findIndex(row => row.id === item.id);
                    if (index >= 0) rows[index] = item;
                    else rows.push(item);
                }
            }),
            bulkAdd: vi.fn(async (items: Row[]) => rows.push(...items)),
            put: vi.fn(async (item: Row) => {
                const index = rows.findIndex(row => row.id === item.id);
                if (index >= 0) rows[index] = item;
                else rows.push(item);
            })
        };
    };

    const savedGames = createTable([{
        id: 'game-azul',
        name: 'Azul',
        lastUsed: 0,
        usageCount: 0,
        meta: { relations: {}, confidence: {} }
    }]);

    const tables = {
        savedGames,
        savedPlayers: createTable(),
        savedLocations: createTable(),
        savedWeekdays: createTable(),
        savedTimeSlots: createTable(),
        savedPlayerCounts: createTable(),
        savedGameModes: createTable(),
        savedGameLifecycleContexts: createTable(),
        analyticsLogs: createTable()
    };

    const db = {
        ...tables,
        savedCurrentSession: {},
        bggGames: {},
        weights: {},
        transaction: vi.fn(async (...args: any[]) => args[args.length - 1]())
    };

    return { db, tables };
});

vi.mock('../../db', () => ({ db: testDb.db }));

vi.mock('dexie', () => ({
    default: { waitFor: async (value: unknown) => value }
}));

vi.mock('../../features/recommendation/WeightAdjustmentEngine', () => ({
    PLAYER_WEIGHTS_ID: 'player',
    COUNT_WEIGHTS_ID: 'count',
    LOCATION_WEIGHTS_ID: 'location',
    COLOR_WEIGHTS_ID: 'color',
    DEFAULT_PLAYER_WEIGHTS: {},
    DEFAULT_COUNT_WEIGHTS: {},
    DEFAULT_LOCATION_WEIGHTS: {},
    DEFAULT_COLOR_WEIGHTS: {},
    weightAdjustmentEngine: {
        getWeights: vi.fn(async (_id: string, defaults: unknown) => ({ ...(defaults as Record<string, unknown>) })),
        saveWeights: vi.fn(async () => undefined)
    }
}));

vi.mock('./RelationTrainer', () => ({
    relationTrainer: {
        trainRelations: vi.fn(async () => ({
            playerWeightsChanged: false,
            countWeightsChanged: false,
            locationWeightsChanged: false
        })),
        trainColors: vi.fn(async () => ({ itemChanged: false, weightChanged: false }))
    }
}));

vi.mock('./PredictionStrengthEvaluator', () => ({
    predictionStrengthEvaluator: { evaluate: vi.fn(() => undefined) }
}));

vi.mock('../../utils/idGenerator', () => ({ generateId: vi.fn(() => 'generated-id') }));

import { HistoryBatchProcessor } from './HistoryBatchProcessor';

function historyRecord(id: string, endTime: number): HistoryRecord {
    return {
        id,
        templateId: 'template-a',
        gameName: 'Azul',
        startTime: 100,
        endTime,
        players: [],
        winnerIds: [],
        snapshotTemplate: {} as HistoryRecord['snapshotTemplate']
    };
}

function lifecycleItem(id: string): SavedListItem | undefined {
    return testDb.tables.savedGameLifecycleContexts.rows.find(row => row.id === id) as SavedListItem | undefined;
}

describe('HistoryBatchProcessor lifecycle replay', () => {
    beforeEach(() => {
        for (const table of Object.values(testDb.tables)) {
            table.rows.splice(0, table.rows.length);
        }
        testDb.tables.savedGames.rows.push({
            id: 'game-azul',
            name: 'Azul',
            lastUsed: 0,
            usageCount: 0,
            meta: { relations: {}, confidence: {} }
        });
        vi.clearAllMocks();
    });

    it('uses the saved game statistics accumulated by earlier replayed records', async () => {
        await new HistoryBatchProcessor().run([
            historyRecord('first', 150),
            historyRecord('second', 200)
        ]);

        expect(testDb.tables.savedGames.rows[0]).toMatchObject({ usageCount: 2, lastUsed: 200 });
        expect(lifecycleItem('game_play_stage:first')).toMatchObject({ usageCount: 1 });
        expect(lifecycleItem('game_play_stage:second')).toMatchObject({ usageCount: 1 });
        expect(lifecycleItem('game_recency:within_1_day')).toMatchObject({ usageCount: 1 });
    });
});
