import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db';
import { gameCatalogImportService } from './gameCatalogImportService';

const noLinks = () => ({ games: new Map(), players: new Map(), locations: new Map() });

const importCsv = async (csv: string) => {
  const report = await gameCatalogImportService.analyzeData(csv);
  await gameCatalogImportService.importData(report.sourceData, noLinks());
};

beforeEach(async () => {
  await Promise.all([db.bggGames.clear(), db.savedGames.clear(), db.templates.clear(), db.builtins.clear()]);
});

describe('expansions in an imported game list', () => {
  it('marks the rows the BGG collection export lists as expansions', async () => {
    await importCsv([
      'Game ID,Name,Expansion,altnames',
      '163068,Trickerion: Legends of Illusion,-,魔幻傳奇',
      '244358,Trickerion: Dahlgaard\'s Academy,Y,魔幻傳奇：學院擴',
    ].join('\n'));
    expect((await db.bggGames.get('163068'))?.isExpansion).toBe(false);
    expect((await db.bggGames.get('244358'))?.isExpansion).toBe(true);
  });

  it('reads the itemtype column of BGG\'s other export', async () => {
    await importCsv('objectname,objectid,itemtype\nTrickerion: Dahlgaard\'s Academy,244358,expansion\nTrickerion: Legends of Illusion,163068,standalone');
    expect((await db.bggGames.get('244358'))?.isExpansion).toBe(true);
    expect((await db.bggGames.get('163068'))?.isExpansion).toBe(false);
  });

  it('marks a game already in the dictionary on the next import, and keeps the mark when a later file has no such column', async () => {
    await db.bggGames.put({ id: '244358', name: 'Trickerion: Dahlgaard\'s Academy', altNames: ['魔幻傳奇：學院擴'], updatedAt: 1 });
    await importCsv('Game ID,Name,Expansion\n244358,Trickerion: Dahlgaard\'s Academy,Y');
    expect(await db.bggGames.get('244358')).toMatchObject({ isExpansion: true, altNames: ['魔幻傳奇：學院擴'] });

    await importCsv('Game ID,Name\n244358,Trickerion: Dahlgaard\'s Academy');
    expect((await db.bggGames.get('244358'))?.isExpansion).toBe(true);
  });
});
