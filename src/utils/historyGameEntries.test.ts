import { describe, expect, it } from 'vitest';
import { HistorySummary } from './extractDataSummaries';
import { buildHistoryGameEntries } from './historyGameEntries';

const record = (overrides: Partial<HistorySummary>): HistorySummary => ({
  id: overrides.id || 'h1',
  templateId: overrides.templateId || 'tpl-a',
  gameName: overrides.gameName || 'Game A',
  bggId: overrides.bggId,
  endTime: overrides.endTime || 1000,
  location: overrides.location,
  winnerIds: [],
  scoringRule: overrides.scoringRule,
  firstPhotoId: overrides.firstPhotoId,
  players: overrides.players || [],
  _playerNames: '',
  _dateStr: '',
  _compactDate: '',
  _rocDate: '',
  snapshotTemplate: undefined
});

describe('historyGameEntries', () => {
  it('merges records by bgg id before display name', () => {
    const entries = buildHistoryGameEntries([
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Local Name', bggId: '123', endTime: 3000 }),
      record({ id: 'h2', templateId: 'tpl-b', gameName: 'BGG Name', bggId: '123', endTime: 2000 })
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      gameKey: 'bgg:123',
      playCount: 2,
      bggId: '123'
    });
    expect(entries[0].templateIds).toEqual(['tpl-a', 'tpl-b']);
  });

  it('merges same-name records across copied templates when bgg id is missing', () => {
    const entries = buildHistoryGameEntries([
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Game A', endTime: 3000 }),
      record({ id: 'h2', templateId: 'tpl-a-copy', gameName: 'game a', endTime: 2000 })
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].gameKey).toBe('name:game a');
    expect(entries[0].playCount).toBe(2);
  });

  it('deduplicates linked players, falls back to names, and excludes default placeholders', () => {
    const entries = buildHistoryGameEntries([
      record({
        id: 'h1',
        players: [
          { id: 'slot_1', name: '\u73a9\u5bb6 1', color: '#fff', totalScore: 0, scores: {} },
          { id: 'slot_2', linkedPlayerId: 'p-a', name: 'Alice', color: '#000', totalScore: 1, scores: {} },
          { id: 'session-bob-a', name: 'Bob', color: '#333', totalScore: 2, scores: {} }
        ]
      }),
      record({
        id: 'h2',
        players: [
          { id: 'player_1', name: 'Player 1', color: '#fff', totalScore: 0, scores: {} },
          { id: 'another-slot', linkedPlayerId: 'p-a', name: 'Alice A.', color: '#000', totalScore: 3, scores: {} },
          { id: 'session-bob-b', name: 'Bob', color: '#333', totalScore: 4, scores: {} }
        ]
      })
    ]);

    expect(entries[0].players.map(player => [player.key, player.playCount])).toEqual([
      ['player:p-a', 2],
      ['name:bob', 2]
    ]);
  });

  it('uses saved players as the canonical player universe when provided', () => {
    const entries = buildHistoryGameEntries([
      record({
        id: 'h1',
        players: [
          { id: 'slot_1', linkedPlayerId: 'p-a', name: 'Alice old', color: '#fff', totalScore: 1, scores: {} },
          { id: 'slot_2', linkedPlayerId: 'stale-bob', name: 'Bob', color: '#000', totalScore: 2, scores: {} },
          { id: 'slot_3', linkedPlayerId: 'orphan', name: 'Orphan', color: '#333', totalScore: 3, scores: {} }
        ]
      }),
      record({
        id: 'h2',
        players: [
          { id: 'slot_4', linkedPlayerId: 'p-a', name: 'Alice', color: '#fff', totalScore: 4, scores: {} },
          { id: 'slot_5', name: 'bob', color: '#000', totalScore: 5, scores: {} }
        ]
      })
    ], {
      savedPlayers: [
        { id: 'p-a', name: 'Alice' },
        { id: 'p-b', name: 'Bob' }
      ]
    });

    expect(entries[0].players.map(player => [player.key, player.name, player.playCount])).toEqual([
      ['player:p-a', 'Alice', 2],
      ['player:p-b', 'Bob', 2]
    ]);
  });

  it('keeps the most recent first photo for each merged game', () => {
    const entries = buildHistoryGameEntries([
      record({ id: 'h1', gameName: 'Game A', endTime: 1000, firstPhotoId: 'old-photo' }),
      record({ id: 'h2', gameName: 'Game A', endTime: 3000, firstPhotoId: 'new-photo' }),
      record({ id: 'h3', gameName: 'Game A', endTime: 2000 })
    ]);

    expect(entries[0].photoCount).toBe(2);
    expect(entries[0].firstRecentPhotoId).toBe('new-photo');
    expect(entries[0].firstRecentPhotoRecordId).toBe('h2');
  });

  it('collects filter metadata from merged history records', () => {
    const entries = buildHistoryGameEntries([
      record({
        id: 'h1',
        gameName: 'Game A',
        location: 'Home',
        scoringRule: 'HIGHEST_WINS',
        players: [
          { id: 'p1', name: 'Alice', color: '#fff', totalScore: 0, scores: {} },
          { id: 'p2', name: 'Bob', color: '#000', totalScore: 0, scores: {} }
        ]
      }),
      record({
        id: 'h2',
        gameName: 'Game A',
        location: 'Cafe',
        scoringRule: 'LOWEST_WINS',
        players: [
          { id: 'p1', name: 'Alice', color: '#fff', totalScore: 0, scores: {} },
          { id: 'p2', name: 'Bob', color: '#000', totalScore: 0, scores: {} },
          { id: 'p3', name: 'Carol', color: '#333', totalScore: 0, scores: {} }
        ]
      })
    ]);

    expect(entries[0].playerCounts).toEqual([2, 3]);
    expect(entries[0].scoringRules).toEqual(['HIGHEST_WINS', 'LOWEST_WINS']);
    expect(entries[0].locations).toEqual(['Cafe', 'Home']);
  });
});
