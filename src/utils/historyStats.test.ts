import { describe, expect, it } from 'vitest';
import { HistorySummary } from './extractDataSummaries';
import { buildHistoryStats, selectHistoryPhotoGridItems } from './historyStats';

const record = (overrides: Partial<HistorySummary>): HistorySummary => ({
  id: overrides.id || 'h1',
  templateId: overrides.templateId || 'tpl-a',
  gameName: overrides.gameName || 'Game A',
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

describe('historyStats', () => {
  it('groups records by game and sorts by play count first', () => {
    const stats = buildHistoryStats([
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Game A', endTime: 3000 }),
      record({ id: 'h2', templateId: 'tpl-b', gameName: 'Game B', endTime: 2000 }),
      record({ id: 'h3', templateId: 'tpl-a', gameName: 'Game A', endTime: 1000 })
    ]);

    expect(stats.playCount).toBe(3);
    expect(stats.gameCount).toBe(2);
    expect(stats.games.map(game => [game.name, game.playCount])).toEqual([
      ['Game A', 2],
      ['Game B', 1]
    ]);
  });

  it('deduplicates players by linked id before name fallback', () => {
    const stats = buildHistoryStats([
      record({
        id: 'h1',
        players: [
          { id: 'slot-1', linkedPlayerId: 'p-a', name: 'Alice', color: '#fff', totalScore: 1, scores: {} },
          { id: 'slot-2', name: 'Bob', color: '#000', totalScore: 2, scores: {} }
        ]
      }),
      record({
        id: 'h2',
        players: [
          { id: 'another-slot', linkedPlayerId: 'p-a', name: 'Alice A.', color: '#fff', totalScore: 3, scores: {} },
          { id: 'slot-3', name: 'bob', color: '#000', totalScore: 4, scores: {} }
        ]
      })
    ]);

    expect(stats.playerCount).toBe(2);
    expect(stats.games[0].players.map(player => [player.key, player.playCount])).toEqual([
      ['p-a', 2],
      ['name:bob', 2]
    ]);
  });

  it('selects recent first photos from different games only', () => {
    const items = selectHistoryPhotoGridItems([
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Game A', endTime: 3000, firstPhotoId: 'photo-a-new' }),
      record({ id: 'h2', templateId: 'tpl-a', gameName: 'Game A', endTime: 2000, firstPhotoId: 'photo-a-old' }),
      record({ id: 'h3', templateId: 'tpl-b', gameName: 'Game B', endTime: 1000, firstPhotoId: 'photo-b' }),
      record({ id: 'h4', templateId: 'tpl-c', gameName: 'Game C', endTime: 900 })
    ]);

    expect(items.map(item => item.photoId)).toEqual(['photo-a-new', 'photo-b']);
  });
});
