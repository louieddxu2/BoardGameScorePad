import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../db';
import type { SavedListItem } from '../../../types';
import type { BgStatsExport, ImportManualLinks } from '../types';
import { bgStatsImportService } from './bgStatsImportService';

const item = (id: string, name: string): SavedListItem => ({ id, name, lastUsed: 0, usageCount: 0, meta: { relations: {}, confidence: {} } });

const source = (playIds: string[]): BgStatsExport => ({
  games: [{ id: 1, uuid: 'SRC-GAME', name: 'Source game name' }],
  players: [{ id: 1, uuid: 'SRC-PLAYER', name: 'Ann from BG Stats', isAnonymous: false }],
  locations: [{ id: 1, uuid: 'SRC-LOCATION', name: 'Cafe from BG Stats' }],
  plays: playIds.map(uuid => ({
    uuid, gameRefId: 1, locationRefId: 1, playDate: '2026-11-07 20:00:00', durationMin: 30,
    playerScores: [{ playerRefId: 1, score: '10', winner: true }],
  })),
});

const noLinks = (): ImportManualLinks => ({ games: new Map(), players: new Map(), locations: new Map() });
const linkedTo = (game: string, player: string, location: string): ImportManualLinks => ({
  games: new Map([[1, { targetId: game, type: 'game' }]]),
  players: new Map([[1, { targetId: player, type: 'player' }]]),
  locations: new Map([[1, { targetId: location, type: 'location' }]]),
});

describe('BG Stats manual links', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(table => table.clear()));
    await db.savedGames.bulkPut([item('local-game', 'My game'), item('other-game', 'Other game')]);
    await db.savedPlayers.bulkPut([item('local-ann', 'Ann'), item('local-bob', 'Bob')]);
    await db.savedLocations.put(item('local-cafe', 'Cafe'));
  });

  it('reuses a manual link on the next import instead of creating duplicates', async () => {
    await bgStatsImportService.importData(source(['play-1']), linkedTo('local-game', 'local-ann', 'local-cafe'));

    const report = await bgStatsImportService.analyzeData(source(['play-1', 'play-2']));
    expect(report.players.importUnmatched).toEqual([]);
    expect(report.locations.importUnmatched).toEqual([]);
    expect(report.games.importUnmatched).toEqual([]);

    expect(await bgStatsImportService.importData(source(['play-1', 'play-2']), noLinks())).toBe(1);
    expect((await db.savedPlayers.toArray()).map(p => p.id).sort()).toEqual(['local-ann', 'local-bob']);
    expect(await db.savedLocations.count()).toBe(1);
    expect((await db.savedGames.toArray()).map(g => g.id).sort()).toEqual(['local-game', 'other-game']);

    const play = await db.history.get('play-2');
    expect(play?.templateId).toBe('local-game');
    expect(play?.locationId).toBe('local-cafe');
    expect(play?.players[0].linkedPlayerId).toBe('local-ann');
  });

  it('moves a remembered link when the source is linked to a different item', async () => {
    await bgStatsImportService.importData(source(['play-1']), linkedTo('local-game', 'local-ann', 'local-cafe'));
    await bgStatsImportService.importData(source(['play-2']), linkedTo('other-game', 'local-bob', 'local-cafe'));
    await bgStatsImportService.importData(source(['play-3']), noLinks());

    expect((await db.history.get('play-3'))?.players[0].linkedPlayerId).toBe('local-bob');
    expect((await db.history.get('play-3'))?.templateId).toBe('other-game');
    expect((await db.savedPlayers.get('local-ann'))?.meta?.bgStatsUuids).toEqual([]);
    expect((await db.savedPlayers.get('local-bob'))?.meta?.bgStatsUuids).toEqual(['SRC-PLAYER']);
  });
});
