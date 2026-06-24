import { describe, expect, it } from 'vitest';
import { HistorySummary } from './extractDataSummaries';
import { buildHistoryPlayerEntries, buildSpecificPlayerStats } from './historyPlayerEntries';

const record = (overrides: Partial<HistorySummary>): HistorySummary => ({
  id: overrides.id || 'h1',
  templateId: overrides.templateId || 'tpl-a',
  gameName: overrides.gameName || 'Game A',
  bggId: overrides.bggId,
  endTime: overrides.endTime || 1000,
  location: overrides.location,
  winnerIds: overrides.winnerIds || [],
  scoringRule: overrides.scoringRule,
  players: overrides.players || [],
  _playerNames: '',
  _dateStr: '',
  _compactDate: '',
  _rocDate: '',
  snapshotTemplate: undefined
});

describe('historyPlayerEntries', () => {
  it('aggregates one saved player across games by linked id', () => {
    const records = [
      record({
        id: 'h1',
        gameName: 'Game A',
        endTime: 2000,
        winnerIds: ['slot-a'],
        players: [{ id: 'slot-a', linkedPlayerId: 'p1', name: 'Old name', color: '#fff', totalScore: 10 }]
      }),
      record({
        id: 'h2',
        gameName: 'Game B',
        endTime: 3000,
        players: [{ id: 'slot-b', linkedPlayerId: 'p1', name: 'Alias', color: '#fff', totalScore: 5 }]
      })
    ];

    const players = buildHistoryPlayerEntries(records, {
      savedPlayers: [{ id: 'p1', name: 'Alice' }]
    });

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      key: 'player:p1',
      name: 'Alice',
      playCount: 2,
      gameCount: 2,
      latestPlayedAt: 3000
    });
    expect(players[0].games.map(game => [game.name, game.playCount, game.winCount])).toEqual([
      ['Game B', 1, 0],
      ['Game A', 1, 1]
    ]);
    expect(players[0].recentGames.map(game => game.name)).toEqual(['Game B', 'Game A']);
  });

  it('orders overview recent games by latest play rather than play count', () => {
    const records = [
      record({
        id: 'a1',
        gameName: 'Frequently Played',
        endTime: 1000,
        players: [{ id: 'slot-a1', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 1 }]
      }),
      record({
        id: 'a2',
        gameName: 'Frequently Played',
        endTime: 2000,
        players: [{ id: 'slot-a2', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 2 }]
      }),
      record({
        id: 'b1',
        gameName: 'Recently Played',
        endTime: 3000,
        players: [{ id: 'slot-b1', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 3 }]
      })
    ];

    const [player] = buildHistoryPlayerEntries(records, {
      savedPlayers: [{ id: 'p1', name: 'Alice' }]
    });

    expect(player.games.map(game => game.name)).toEqual(['Frequently Played', 'Recently Played']);
    expect(player.recentGames.map(game => game.name)).toEqual(['Recently Played', 'Frequently Played']);
  });

  it('collects per-game companions by resolved player id', () => {
    const records = [
      record({
        id: 'h1',
        gameName: 'Game A',
        endTime: 1000,
        players: [
          { id: 'slot-a1', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 1 },
          { id: 'slot-b1', linkedPlayerId: 'p2', name: 'Bob', color: '#000', totalScore: 2 }
        ]
      }),
      record({
        id: 'h2',
        gameName: 'Game A',
        endTime: 2000,
        players: [
          { id: 'slot-a2', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 3 },
          { id: 'slot-b2', linkedPlayerId: 'p2', name: 'Bobby', color: '#000', totalScore: 4 },
          { id: 'slot-c2', linkedPlayerId: 'p3', name: 'Carol', color: '#333', totalScore: 5 }
        ]
      })
    ];

    const players = buildHistoryPlayerEntries(records, {
      savedPlayers: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Carol' }
      ]
    });
    const alice = players.find(player => player.key === 'player:p1');

    expect(alice?.games[0].companions.map(companion => [companion.key, companion.name, companion.playCount])).toEqual([
      ['player:p2', 'Bob', 2],
      ['player:p3', 'Carol', 1]
    ]);
  });

  it('uses saved-player name matching and excludes unresolved temporary players', () => {
    const players = buildHistoryPlayerEntries([
      record({
        players: [
          { id: 'slot-a', name: 'alice', color: '#fff', totalScore: 1 },
          { id: 'slot-b', name: 'Guest', color: '#000', totalScore: 2 },
          { id: 'slot-c', name: '玩家 1', color: '#333', totalScore: 3 }
        ]
      })
    ], {
      savedPlayers: [{ id: 'p1', name: 'Alice' }]
    });

    expect(players.map(player => player.key)).toEqual(['player:p1']);
  });

  it('returns a specific player with recent records first', () => {
    const records = [
      record({
        id: 'old',
        endTime: 1000,
        players: [{ id: 'slot-a', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 1 }]
      }),
      record({
        id: 'new',
        endTime: 3000,
        players: [{ id: 'slot-b', linkedPlayerId: 'p1', name: 'Alice', color: '#fff', totalScore: 2 }]
      })
    ];

    const stats = buildSpecificPlayerStats('player:p1', records, {
      savedPlayers: [{ id: 'p1', name: 'Alice' }]
    });

    expect(stats?.records.map(entry => entry.id)).toEqual(['new', 'old']);
  });
});
