import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db';
import { bgStatsImportService } from './bgStatsImportService';
import { bgStatsExportService } from './bgStatsExportService';
import sourceFile from '../mocks/BGStatsExport.json';

// A real BG Stats export (924 plays); importing it twice takes several seconds under a full test run.
const TIMEOUT = 60000;
const SOURCE = structuredClone(sourceFile) as any;
const links = () => ({ games: new Map(), players: new Map(), locations: new Map() }) as any;
const withoutRefs = ({ gameRefId, locationRefId, playerScores, ...rest }: any) =>
  ({ ...rest, playerScores: playerScores.map(({ playerRefId, ...score }: any) => score) });

describe('BG Stats play round trip', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it('exports imported plays with their original fields', async () => {
    await bgStatsImportService.importData(SOURCE, links());
    const out = await bgStatsExportService.exportData();
    const exported = new Map((out.plays || []).map((p: any) => [p.uuid, p]));
    expect(exported.size).toBe(SOURCE.plays.length);
    for (const play of SOURCE.plays) expect(withoutRefs(exported.get(play.uuid))).toEqual(withoutRefs(play));
  }, TIMEOUT);

  it('gives earlier imports their original fields on re-import, unless edited in ScorePad', async () => {
    await bgStatsImportService.importData(SOURCE, links());
    const [kept, edited] = SOURCE.plays.slice(0, 2).map((p: any) => p.uuid);
    await db.history.toCollection().modify(record => { delete record.bgStatsSource; });
    await db.history.update(edited, { note: 'edited in ScorePad' });

    expect(await bgStatsImportService.importData(SOURCE, links())).toBe(0);
    expect((await db.history.get(kept))?.bgStatsSource).toBeDefined();
    expect((await db.history.get(edited))?.bgStatsSource).toBeUndefined();
  }, TIMEOUT);
});
