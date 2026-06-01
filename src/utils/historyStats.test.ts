import { describe, expect, it } from 'vitest';
import { HistorySummary } from './extractDataSummaries';
import { buildHistoryGameEntries } from './historyGameEntries';
import { buildHistoryStats, selectHistoryPhotoGridItems } from './historyStats';

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
          { id: 'slot_1', name: '玩家 1', color: '#fff', totalScore: 0, scores: {} },
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
      record({ id: 'h1', templateId: 'tpl-a', gameName: 'Game A', endTime: 3000, firstPhotoId: 'photo-a-new' }),
      record({ id: 'h2', templateId: 'tpl-a', gameName: 'Game A', endTime: 2000, firstPhotoId: 'photo-a-old' }),
      record({ id: 'h3', templateId: 'tpl-a-copy', gameName: 'Game A', endTime: 1500, firstPhotoId: 'photo-a-copy' }),
      record({ id: 'h4', templateId: 'tpl-b', gameName: 'Game B', endTime: 1000, firstPhotoId: 'photo-b' }),
      record({ id: 'h5', templateId: 'tpl-c', gameName: 'Game C', endTime: 900 })
    ]);
    const items = selectHistoryPhotoGridItems(entries);

    expect(items.map(item => item.photoId)).toEqual(['photo-a-new', 'photo-b']);
  });
});
