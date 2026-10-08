import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BggGame, GameTemplate, HistoryRecord, SavedListItem } from '../../../types';
import { BgStatsExport, BgStatsGame, ImportManualLinks } from '../types';

const testDb = vi.hoisted(() => {
    type Row = Record<string, any>;
    const clone = <T,>(value: T): T => structuredClone(value);
    const table = () => {
        const rows = new Map<string, Row>();
        const writes = vi.fn();
        const save = (row: Row) => {
            rows.set(row.id, clone(row));
            writes(row.id);
        };
        const collection = (predicate: (row: Row) => boolean) => ({
            toArray: vi.fn(async () => [...rows.values()].filter(predicate).map(clone)),
            primaryKeys: vi.fn(async () => [...rows.values()].filter(predicate).map(row => row.id)),
            first: vi.fn(async () => clone([...rows.values()].find(predicate))),
            filter: (next: (row: Row) => boolean) => collection(row => predicate(row) && next(row)),
            modify: vi.fn(async (change: Row | ((row: Row) => boolean | void)) => {
                let count = 0;
                for (const original of [...rows.values()].filter(predicate)) {
                    const row = clone(original);
                    if (typeof change === 'function') {
                        if (change(row) === false) continue;
                    } else {
                        Object.assign(row, clone(change));
                    }
                    save(row);
                    count++;
                }
                return count;
            })
        });
        return {
            rows, writes,
            toArray: vi.fn(async () => [...rows.values()].map(clone)),
            get: vi.fn(async (id: string) => clone(rows.get(id))),
            bulkGet: vi.fn(async (ids: string[]) => ids.map(id => clone(rows.get(id)))),
            put: vi.fn(async (row: Row) => save(row)),
            bulkPut: vi.fn(async (items: Row[]) => items.forEach(save)),
            bulkAdd: vi.fn(async (items: Row[]) => {
                const keys = new Set(rows.keys());
                for (const row of items) {
                    if (keys.has(row.id)) throw new Error(`Duplicate ID: ${row.id}`);
                    keys.add(row.id);
                }
                items.forEach(save);
            }),
            update: vi.fn(async (id: string, changes: Row) => {
                const row = rows.get(id);
                if (!row) return 0;
                save({ ...clone(row), ...clone(changes) });
                return 1;
            }),
            filter: vi.fn((predicate: (row: Row) => boolean) => collection(predicate)),
            where: vi.fn((key: string) => ({
                anyOf: (values: string[]) => {
                    const keys = new Set(values);
                    return collection(row => keys.has(row[key]));
                },
                equals: (value: string) => collection(row => Array.isArray(row[key])
                    ? row[key].includes(value) : row[key] === value),
                equalsIgnoreCase: (value: string) => collection(row =>
                    typeof row[key] === 'string' && row[key].toLowerCase() === value.toLowerCase())
            }))
        };
    };
    const tables = {
        history: table(), savedGames: table(), savedPlayers: table(), savedLocations: table(),
        templates: table(), builtins: table(), bggGames: table()
    };
    return {
        tables,
        db: { ...tables, transaction: vi.fn(async (...args: any[]) => args[args.length - 1]()) }
    };
});

vi.mock('../../../db', () => ({ db: testDb.db }));

import { bgStatsImportService } from './bgStatsImportService';
import { bgStatsExportService } from './bgStatsExportService';

const links = (): ImportManualLinks => ({ games: new Map(), players: new Map(), locations: new Map() });
const savedGame = (id: string, name = 'Sky Totems', bggId?: string): SavedListItem => ({
    id, name, bggId, lastUsed: 800, usageCount: 42,
    meta: { relations: { players: { player1: 5 } }, confidence: { location: 0.8 } }
});
const template = (id: string, name = 'Sky Totems', bggId?: string): GameTemplate => ({
    id, name, bggId, columns: [{ id: 'score', name: 'Score', formula: 'a1', inputType: 'keypad', isScoring: true }],
    createdAt: 100, updatedAt: 200, defaultScoringRule: 'HIGHEST_WINS'
});
const history = (id: string, templateId: string, bggId?: string): HistoryRecord => ({
    id, templateId, gameName: 'Sky Totems', bggId, startTime: 1000, endTime: 123456,
    updatedAt: 456, snapshotTemplate: template(templateId, 'Historical Name'),
    players: [{
        id: 'seat1', name: 'Player', color: '#123456', scores: { score: { parts: [12, 6], optionId: 'choice' } }, totalScore: 24,
        linkedPlayerId: 'player1', isStarter: true
    }],
    winnerIds: ['seat1'], note: 'Local note', location: 'Home', locationId: 'home0001',
    photos: ['photo1'], photoCloudIds: { photo1: 'cloud1' }, cloudFolderId: 'folder1',
    scoringRule: 'HIGHEST_WINS'
});
const sourceGame = (id: number, uuid: string, bggId?: number, name = 'Sky Totems'): BgStatsGame => ({
    id, uuid, name, bggId, highestWins: true
});
const play = (uuid: string, gameRefId = 1) => ({
    uuid, gameRefId, playDate: '2026-10-09 12:00:00', durationMin: 5,
    comments: 'Incoming note must not replace local note',
    playerScores: [{ playerRefId: 1, score: '999', winner: false }]
});

beforeEach(() => {
    for (const table of Object.values(testDb.tables)) table.rows.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(10000);
});

describe('BG Stats BGG ID enrichment', () => {
    it('patches the same play UUID across custom, built-in, disposable and separately linked templates without replacing play data', async () => {
        const records = [history('play1', 'custom01'), history('play2', 'builtin1'), history('play3', 'deleted1'),
            history('play4', 'scoretpl'), history('play5', 'legacy01')];
        records[2].snapshotTemplate = undefined as unknown as GameTemplate;
        records[4].snapshotTemplate = [] as unknown as GameTemplate;
        for (const record of records) testDb.tables.history.rows.set(record.id, structuredClone(record));
        testDb.tables.templates.rows.set('custom01', template('custom01'));
        testDb.tables.builtins.rows.set('builtin1', template('builtin1', 'Built-in'));
        testDb.tables.templates.rows.set('scoretpl', template('scoretpl', 'Separate Game'));
        testDb.tables.savedGames.rows.set('custom01', savedGame('custom01'));
        testDb.tables.savedGames.rows.set('builtin1', savedGame('builtin1', 'Built-in'));
        testDb.tables.savedGames.rows.set('deleted1', savedGame('deleted1', 'Disposable'));
        testDb.tables.savedGames.rows.set('saved004', savedGame('saved004', 'Separate Game'));
        testDb.tables.savedGames.rows.set('legacy01', savedGame('legacy01', 'Legacy'));
        const data: BgStatsExport = {
            games: [sourceGame(1, 'custom01', 40405), sourceGame(2, 'builtin1', 40406, 'Built-in'),
                sourceGame(3, 'deleted1', 40407, 'Disposable'), sourceGame(4, 'saved004', 40408, 'Separate Game'),
                sourceGame(5, 'legacy01', 40409, 'Legacy')],
            plays: records.map((record, index) => play(record.id, index + 1))
        };

        expect(await bgStatsImportService.importData(data, links())).toBe(0);

        for (const [index, record] of records.entries()) {
            const bggId = String(40405 + index);
            const expected = { ...record, bggId, updatedAt: 10000 };
            if (record.snapshotTemplate && !Array.isArray(record.snapshotTemplate)) {
                expected.snapshotTemplate = { ...record.snapshotTemplate, bggId };
            }
            expect(testDb.tables.history.rows.get(record.id)).toEqual(expected);
            expect(testDb.tables.savedGames.rows.get(data.games![index].uuid)).toEqual({
                ...savedGame(data.games![index].uuid, data.games![index].name), bggId
            });
            expect(testDb.tables.bggGames.rows.get(bggId)?.id).toBe(bggId);
        }
        expect(testDb.tables.templates.rows.get('custom01')?.bggId).toBe('40405');
        expect(testDb.tables.builtins.rows.get('builtin1')?.bggId).toBe('40406');
        expect(testDb.tables.templates.rows.get('scoretpl')?.bggId).toBe('40408');
        expect(testDb.tables.history.bulkAdd).not.toHaveBeenCalled();

        const expectedHistory = structuredClone([...testDb.tables.history.rows.values()]);
        vi.clearAllMocks();
        vi.mocked(Date.now).mockReturnValue(20000);
        expect(await bgStatsImportService.importData(data, links())).toBe(0);
        expect([...testDb.tables.history.rows.values()]).toEqual(expectedHistory);
        for (const table of Object.values(testDb.tables)) expect(table.writes).not.toHaveBeenCalled();
    });

    it('preserves known conflicting IDs and prefers existing snapshot or master IDs over incoming IDs', async () => {
        const complete = history('complete', 'local001', '900');
        complete.snapshotTemplate.bggId = '900';
        const snapshotOnly = history('snapshot', 'local002');
        snapshotOnly.snapshotTemplate.bggId = '901';
        const masterOnly = history('master', 'local003');
        masterOnly.snapshotTemplate = undefined as unknown as GameTemplate;
        const originals = [complete, snapshotOnly, masterOnly];
        for (const [index, record] of originals.entries()) {
            testDb.tables.history.rows.set(record.id, structuredClone(record));
            testDb.tables.savedGames.rows.set(record.templateId, savedGame(record.templateId, `Local ${index}`, String(900 + index)));
        }
        const beforeGames = structuredClone([...testDb.tables.savedGames.rows.values()]);
        const data = {
            games: originals.map((r, i) => sourceGame(i + 1, r.templateId, 40405 + i, `Incoming ${i}`)),
            plays: originals.map((r, i) => play(r.id, i + 1))
        };

        await bgStatsImportService.importData(data, links());

        expect(testDb.tables.history.rows.get('complete')).toEqual(complete);
        expect(testDb.tables.history.rows.get('snapshot')).toEqual({ ...snapshotOnly, bggId: '901', updatedAt: 10000 });
        expect(testDb.tables.history.rows.get('master')).toEqual({ ...masterOnly, bggId: '902', updatedAt: 10000 });
        expect([...testDb.tables.savedGames.rows.values()]).toEqual(beforeGames);
        expect(testDb.tables.bggGames.rows.get('40405')?.altNames ?? []).not.toContain('Local 0');
    });

    it('enriches the dictionary immediately on the UUID fast path, merges duplicate BGG IDs once and preserves known metadata', async () => {
        testDb.tables.savedGames.rows.set('local001', savedGame('local001', 'Local Title', '40405'));
        const existing: BggGame = {
            id: '40405', name: 'Official Title', altNames: ['Existing Alias'], year: 1999,
            designers: 'Known Designer', rating: 7.2, bestPlayers: [2], domains: ['Strategy'],
            cooperative: false, minAge: 0, updatedAt: 500
        };
        testDb.tables.bggGames.rows.set(existing.id, existing);
        const data = {
            games: [
                { ...sourceGame(1, 'local001', 40405, 'Imported Title'), bggYear: 2026, designers: 'New Designer', minPlayerCount: 2, minAge: 12, cooperative: true },
                { ...sourceGame(2, 'alias001', 40405, 'Second Alias'), maxPlayerCount: 5 },
                { ...sourceGame(3, 'newgame1', 40406, 'New Game'), bggName: 'New Official', bggYear: 2025 }
            ], plays: []
        };

        await bgStatsImportService.importData(data, links());

        expect(testDb.tables.bggGames.rows.get('40405')).toEqual({
            ...existing, altNames: ['Existing Alias', 'Imported Title', 'Local Title', 'Second Alias'],
            minPlayers: 2, maxPlayers: 5, updatedAt: 10000
        });
        expect(testDb.tables.bggGames.rows.get('40406')).toEqual({
            id: '40406', name: 'New Official', altNames: ['New Game'], year: 2025, updatedAt: 10000
        });
        expect(testDb.tables.bggGames.bulkGet).toHaveBeenCalledTimes(1);
        expect(testDb.tables.bggGames.bulkPut).toHaveBeenCalledTimes(1);
        expect(testDb.tables.savedGames.rows.size).toBe(2);
        const before = structuredClone([...testDb.tables.bggGames.rows.values()]);
        vi.clearAllMocks();
        vi.mocked(Date.now).mockReturnValue(20000);

        await bgStatsImportService.importData(data, links());

        expect([...testDb.tables.bggGames.rows.values()]).toEqual(before);
        expect(testDb.tables.bggGames.writes).not.toHaveBeenCalled();
    });

    it('exports record and snapshot BGG IDs even when the dictionary has no entry', async () => {
        const direct = history('direct', 'local001', '40405');
        const snapshot = history('snapshot', 'local002');
        snapshot.snapshotTemplate.bggId = '40406';
        testDb.tables.history.rows.set(direct.id, direct);
        testDb.tables.history.rows.set(snapshot.id, snapshot);

        const exported = await bgStatsExportService.exportData();

        expect(exported.games?.map(game => game.bggId)).toEqual([40405, 40406]);
        expect(exported.plays?.map(record => record.uuid)).toEqual(['direct', 'snapshot']);
        expect(testDb.tables.bggGames.rows.size).toBe(0);
    });

    it('does not duplicate plays or games when repeated UUIDs and BGG IDs appear in the same file', async () => {
        testDb.tables.savedGames.rows.set('local001', savedGame('local001'));
        const data = {
            games: [sourceGame(1, 'game0001', 40405), sourceGame(2, 'game0002', 40405, 'Alias')],
            plays: [play('sameplay', 1), play('sameplay', 2)]
        };

        expect(await bgStatsImportService.importData(data, links())).toBe(1);
        expect(testDb.tables.history.rows.size).toBe(1);
        expect(testDb.tables.savedGames.rows.size).toBe(1);
        expect(testDb.tables.history.rows.get('sameplay')).toMatchObject({ bggId: '40405', templateId: 'local001' });
        expect(await bgStatsImportService.importData(data, links())).toBe(0);
    });

    it('ignores invalid BGG IDs without creating dictionary entries or touching existing plays', async () => {
        const record = history('existing', 'local001');
        testDb.tables.history.rows.set(record.id, structuredClone(record));
        testDb.tables.savedGames.rows.set('local001', savedGame('local001'));
        for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '17x', '', '  ']) {
            await bgStatsImportService.importData({
                games: [{ ...sourceGame(1, 'local001'), bggId: id as number }], plays: [play('existing')]
            }, links());
        }
        expect(testDb.tables.history.rows.get(record.id)).toEqual(record);
        expect(testDb.tables.history.writes).not.toHaveBeenCalled();
        expect(testDb.tables.bggGames.rows.size).toBe(0);
    });

    it('uses identical preview/import matching for UUIDs, normalized names and dictionary aliases', async () => {
        testDb.tables.savedGames.rows.set('local001', savedGame('local001', 'Original', '40405'));
        testDb.tables.savedGames.rows.set('local002', savedGame('local002', ' Enchanted Ivy '));
        testDb.tables.savedGames.rows.set('local003', savedGame('local003', 'Other', '40406'));
        testDb.tables.bggGames.rows.set('40405', { id: '40405', name: 'Original', altNames: ['Sky Totems'], updatedAt: 1 });
        const data = {
            games: [sourceGame(1, 'local001', 40406, 'Renamed'), sourceGame(2, 'foreign2', 40407, 'enchanted IVY'),
                sourceGame(3, 'foreign3', undefined, 'Sky Totems')],
            plays: [play('uuid', 1), play('name', 2), play('alias', 3)]
        };

        const analysis = await bgStatsImportService.analyzeData(data);
        expect(analysis.games.matchedCount).toBe(3);
        expect(analysis.games.importUnmatched).toEqual([]);
        await bgStatsImportService.importData(data, links());

        expect(testDb.tables.savedGames.rows.size).toBe(3);
        expect(testDb.tables.history.rows.get('uuid')).toMatchObject({ templateId: 'local001', bggId: '40405' });
        expect(testDb.tables.history.rows.get('name')).toMatchObject({ templateId: 'local002', bggId: '40407' });
        expect(testDb.tables.history.rows.get('alias')).toMatchObject({ templateId: 'local001', bggId: '40405' });
    });

    it('does not guess between different BGG IDs that share a name or propagate that ambiguous name to templates', async () => {
        testDb.tables.savedGames.rows.set('local001', savedGame('local001', 'Same Name', '40405'));
        testDb.tables.savedGames.rows.set('local002', savedGame('local002', 'Same Name', '40406'));
        testDb.tables.templates.rows.set('template', template('template', 'Same Name'));
        const data = { games: [sourceGame(1, 'foreign1', undefined, 'same name')], plays: [] };

        const report = await bgStatsImportService.analyzeData(data);
        expect(report.games.matchedCount).toBe(0);
        expect(report.games.localUnmatched.map(game => game.id)).toEqual(['local001', 'local002']);
        await bgStatsImportService.importData(data, links());

        expect(testDb.tables.savedGames.rows.has('foreign1')).toBe(true);
        expect(testDb.tables.templates.rows.get('template')?.bggId).toBeUndefined();
        expect(testDb.tables.savedGames.rows.get('local001')?.bggId).toBe('40405');
        expect(testDb.tables.savedGames.rows.get('local002')?.bggId).toBe('40406');
    });

    it('patches large imports in bounded UUID batches without reading all historical records', async () => {
        testDb.tables.savedGames.rows.set('local001', savedGame('local001'));
        const plays = Array.from({ length: 501 }, (_, index) => play(`play-${index}`));
        for (const p of plays) {
            const record = history(p.uuid, 'local001');
            record.snapshotTemplate = undefined as unknown as GameTemplate;
            testDb.tables.history.rows.set(record.id, record);
        }
        const unrelated = history('unrelated', 'other001');
        testDb.tables.history.rows.set(unrelated.id, structuredClone(unrelated));

        await bgStatsImportService.importData({ games: [sourceGame(1, 'local001', 40405)], plays }, links());

        expect(testDb.tables.history.writes).toHaveBeenCalledTimes(501);
        expect(testDb.tables.history.toArray).not.toHaveBeenCalled();
        expect(testDb.tables.history.filter).not.toHaveBeenCalled();
        expect(testDb.tables.history.where.mock.calls.map(([key]) => key)).toEqual(['id', 'id', 'id']);
        expect(testDb.tables.history.rows.get('unrelated')).toEqual(unrelated);
        expect(testDb.tables.history.bulkAdd).not.toHaveBeenCalled();
    });

    it('skips ID enrichment when a single play UUID has conflicting game references in the file', async () => {
        const original = history('sameplay', 'deleted1');
        original.snapshotTemplate = undefined as unknown as GameTemplate;
        testDb.tables.history.rows.set(original.id, structuredClone(original));
        const data = {
            games: [sourceGame(1, 'game0001', 40405), sourceGame(2, 'game0002', 40406, 'Different')],
            plays: [play('sameplay', 1), play('sameplay', 2)]
        };

        expect(await bgStatsImportService.importData(data, links())).toBe(0);
        expect(testDb.tables.history.rows.get(original.id)).toEqual(original);
    });
});
