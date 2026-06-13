import { describe, expect, it } from 'vitest';
import { HistorySummary } from './extractDataSummaries';
import { buildHistoryGameEntries } from './historyGameEntries';
import { buildHistoryStats, filterHistoryEntriesByDateRange, filterHistoryEntriesByStatsFilters, getNextHistoryStatsDateRange, selectHistoryPhotoGridItems, buildSpecificGameStats } from './historyStats';

const record = (overrides: Partial<HistorySummary>): HistorySummary => ({
  id: overrides.id || 'h1',
  templateId: overrides.templateId || 'tpl-a',
  gameName: overrides.gameName || 'Game A',
  bggId: overrides.bggId,
  endTime: overrides.endTime || 1000,
  location: overrides.location,
  winnerIds: overrides.winnerIds || [],
  scoringRule: overrides.scoringRule,
  firstPhotoId: overrides.firstPhotoId,
  photoIds: overrides.photoIds,
  players: overrides.players || [],
  _playerNames: '',
  _dateStr: '',
  _compactDate: '',
  _rocDate: '',
  snapshotTemplate: undefined
});

describe('historyStats', () => {
  it('builds overview from deduplicated game entries', () => {
    const entries = buildHistoryGameEntries([
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Game A', endTime: 3000 }),
      record({ id: 'h2', templateId: 'tpl-b', gameName: 'Game B', endTime: 2000 }),
      record({ id: 'h3', templateId: 'tpl-a-copy', gameName: 'game a', endTime: 1000 })
    ]);
    const stats = buildHistoryStats(entries);

    expect(stats.playCount).toBe(3);
    expect(stats.gameCount).toBe(2);
    expect(stats.games.map(game => [game.name, game.playCount])).toEqual([
      ['Game A', 2],
      ['Game B', 1]
    ]);
  });

  it('counts only normalized valid players globally', () => {
    const entries = buildHistoryGameEntries([
      record({
        id: 'h1',
        players: [
          { id: 'slot_1', name: '\u73a9\u5bb6 1', color: '#fff', totalScore: 0, scores: {} },
          { id: 'slot-2', linkedPlayerId: 'p-a', name: 'Alice', color: '#fff', totalScore: 1, scores: {} },
          { id: 'slot_3', name: 'Bob', color: '#000', totalScore: 2, scores: {} }
        ]
      }),
      record({
        id: 'h2',
        players: [
          { id: 'player_1', name: 'Player 1', color: '#fff', totalScore: 0, scores: {} },
          { id: 'another-slot', linkedPlayerId: 'p-a', name: 'Alice A.', color: '#fff', totalScore: 3, scores: {} },
          { id: 'slot_4', name: 'bob', color: '#000', totalScore: 4, scores: {} }
        ]
      })
    ]);
    const stats = buildHistoryStats(entries);

    expect(stats.playerCount).toBe(2);
    expect(stats.games[0].players.map(player => [player.key, player.playCount])).toEqual([
      ['player:p-a', 2],
      ['name:bob', 2]
    ]);
  });

  it('selects recent first photos from deduplicated game entries only', () => {
    const entries = buildHistoryGameEntries([
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Game A', endTime: 3000, firstPhotoId: 'photo-a-new', photoIds: ['photo-a-new', 'photo-a-extra'] }),
      record({ id: 'h2', templateId: 'tpl-a', gameName: 'Game A', endTime: 2000, firstPhotoId: 'photo-a-old', photoIds: ['photo-a-old'] }),
      record({ id: 'h3', templateId: 'tpl-a-copy', gameName: 'Game A', endTime: 1500, firstPhotoId: 'photo-a-copy', photoIds: ['photo-a-copy'] }),
      record({ id: 'h4', templateId: 'tpl-b', gameName: 'Game B', endTime: 1000, firstPhotoId: 'photo-b', photoIds: ['photo-b'] }),
      record({ id: 'h5', templateId: 'tpl-c', gameName: 'Game C', endTime: 900 })
    ]);
    const items = selectHistoryPhotoGridItems(entries);

    expect(items.map(item => item.photoId)).toEqual(['photo-a-new', 'photo-b']);
    expect(items[0].candidatePhotos.map(photo => photo.photoId)).toEqual([
      'photo-a-new',
      'photo-a-extra',
      'photo-a-old',
      'photo-a-copy'
    ]);
  });

  it('cycles date ranges in display order', () => {
    expect(getNextHistoryStatsDateRange('all')).toBe('month');
    expect(getNextHistoryStatsDateRange('month')).toBe('quarter');
    expect(getNextHistoryStatsDateRange('quarter')).toBe('year');
    expect(getNextHistoryStatsDateRange('year')).toBe('all');
  });

  it('filters entries by recent date ranges', () => {
    const now = Date.UTC(2026, 5, 2);
    const entries = buildHistoryGameEntries([
      record({ id: 'recent', gameName: 'Recent', endTime: now - 10 * 24 * 60 * 60 * 1000 }),
      record({ id: 'quarter', gameName: 'Quarter', endTime: now - 60 * 24 * 60 * 60 * 1000 }),
      record({ id: 'year', gameName: 'Year', endTime: now - 200 * 24 * 60 * 60 * 1000 }),
      record({ id: 'old', gameName: 'Old', endTime: now - 500 * 24 * 60 * 60 * 1000 })
    ]);

    expect(filterHistoryEntriesByDateRange(entries, 'all', now).map(entry => entry.displayName)).toEqual([
      'Recent',
      'Quarter',
      'Year',
      'Old'
    ]);
    expect(filterHistoryEntriesByDateRange(entries, 'month', now).map(entry => entry.displayName)).toEqual(['Recent']);
    expect(filterHistoryEntriesByDateRange(entries, 'quarter', now).map(entry => entry.displayName)).toEqual(['Recent', 'Quarter']);
    expect(filterHistoryEntriesByDateRange(entries, 'year', now).map(entry => entry.displayName)).toEqual(['Recent', 'Quarter', 'Year']);
  });

  it('uses filtered entries as photo grid source', () => {
    const now = Date.UTC(2026, 5, 2);
    const entries = buildHistoryGameEntries([
      record({ id: 'recent', gameName: 'Recent', endTime: now - 10 * 24 * 60 * 60 * 1000, firstPhotoId: 'recent-photo' }),
      record({ id: 'old', gameName: 'Old', endTime: now - 500 * 24 * 60 * 60 * 1000, firstPhotoId: 'old-photo' })
    ]);

    const monthEntries = filterHistoryEntriesByDateRange(entries, 'month', now);
    expect(selectHistoryPhotoGridItems(monthEntries).map(item => item.photoId)).toEqual(['recent-photo']);
  });

  it('filters entries by stats metadata', () => {
    const entries = buildHistoryGameEntries([
      record({
        id: 'two-player-high-home',
        gameName: 'Game A',
        scoringRule: 'HIGHEST_WINS',
        location: 'Home',
        players: [
          { id: 'p1', name: 'Alice', color: '#fff', totalScore: 0, scores: {} },
          { id: 'p2', name: 'Bob', color: '#000', totalScore: 0, scores: {} }
        ]
      }),
      record({
        id: 'three-player-low-cafe',
        gameName: 'Game B',
        scoringRule: 'LOWEST_WINS',
        location: 'Cafe',
        players: [
          { id: 'p1', name: 'Alice', color: '#fff', totalScore: 0, scores: {} },
          { id: 'p2', name: 'Bob', color: '#000', totalScore: 0, scores: {} },
          { id: 'p3', name: 'Carol', color: '#333', totalScore: 0, scores: {} }
        ]
      })
    ]);

    expect(filterHistoryEntriesByStatsFilters(entries, { playerCount: 2 }).map(entry => entry.displayName)).toEqual(['Game A']);
    expect(filterHistoryEntriesByStatsFilters(entries, { scoringRule: 'LOWEST_WINS' }).map(entry => entry.displayName)).toEqual(['Game B']);
    expect(filterHistoryEntriesByStatsFilters(entries, { location: 'Home' }).map(entry => entry.displayName)).toEqual(['Game A']);
  });
});

describe('buildSpecificGameStats', () => {
  it('returns null if no records match gameKey', () => {
    const records = [record({ id: 'h1', gameName: 'Game A' })];
    const stats = buildSpecificGameStats('name:game b', records);
    expect(stats).toBeNull();
  });

  it('aggregates stats for a specific game and lists players by win rate', () => {
    const records = [
      record({
        id: 'h1',
        gameName: 'Game A',
        endTime: 1000,
        winnerIds: ['slot_1'],
        players: [
          { id: 'slot_1', name: 'Alice', color: '#fff', totalScore: 10, scores: {} },
          { id: 'slot_2', name: 'Bob', color: '#000', totalScore: 5, scores: {} }
        ]
      }),
      record({
        id: 'h2',
        gameName: 'Game A',
        endTime: 2000,
        winnerIds: ['slot_2'],
        players: [
          { id: 'slot_1', name: 'Alice', color: '#fff', totalScore: 8, scores: {} },
          { id: 'slot_2', name: 'Bob', color: '#000', totalScore: 12, scores: {} }
        ]
      }),
      record({
        id: 'h3',
        gameName: 'Game A',
        endTime: 3000,
        winnerIds: ['slot_1'],
        scoringRule: 'COOP',
        players: [
          { id: 'slot_1', name: 'Alice', color: '#fff', totalScore: 15, scores: {} }
        ]
      }),
      record({
        id: 'h4',
        gameName: 'Game A',
        endTime: 4000,
        winnerIds: ['slot_2'],
        scoringRule: 'COMPETITIVE_NO_SCORE',
        players: [
          { id: 'slot_2', name: 'Bob', color: '#000', totalScore: 0, scores: {} }
        ]
      })
    ];

    const stats = buildSpecificGameStats('name:game a', records);
    expect(stats).not.toBeNull();
    expect(stats?.gameName).toBe('Game A');
    expect(stats?.playCount).toBe(4);
    expect(stats?.latestPlayedAt).toBe(4000);
    expect(stats?.coopPlayCount).toBe(1);
    expect(stats?.competitivePlayCount).toBe(3);

    expect(stats?.players).toEqual([
      { key: 'name:alice', name: 'Alice', playCount: 3, winCount: 2, winRate: 67 },
      { key: 'name:bob', name: 'Bob', playCount: 2, winCount: 1, winRate: 50 }
    ]);
  });



  it('resolves displayName through savedPlayers option if provided', () => {
    const records = [
      record({
        id: 'h1',
        gameName: 'Game A',
        endTime: 1000,
        winnerIds: ['slot_1'],
        players: [
          { id: 'slot_1', name: 'alice', color: '#fff', totalScore: 10, scores: {}, linkedPlayerId: 'p-alice' }
        ]
      })
    ];

    const savedPlayers = [{ id: 'p-alice', name: 'Alice Saved' }];
    const stats = buildSpecificGameStats('name:game a', records, { savedPlayers });
    expect(stats?.players[0].name).toBe('Alice Saved');
  });
});

