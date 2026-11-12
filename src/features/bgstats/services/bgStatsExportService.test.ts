import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryRecord } from '../../../types';

const tables = vi.hoisted(() => {
  const table = () => {
    const rows: any[] = [];
    return { rows, toArray: async () => rows.map(row => structuredClone(row)) };
  };
  return { history: table(), savedPlayers: table(), savedLocations: table(), savedGames: table(), bggGames: table() };
});
vi.mock('../../../db', () => ({ db: tables }));

import { bgStatsExportService } from './bgStatsExportService';

const play = (id: string, scoringRule: HistoryRecord['scoringRule'], totals: number[], winners: number[]): HistoryRecord => ({
  id,
  templateId: `template-${id}`,
  gameName: `Game ${id}`,
  startTime: new Date(2026, 10, 7, 20, 0).getTime(),
  endTime: new Date(2026, 10, 7, 21, 0).getTime(),
  players: totals.map((totalScore, index) => ({
    id: `p${index + 1}`, name: `Name ${index + 1}`, color: '#000', scores: {}, totalScore,
  })),
  winnerIds: winners.map(index => `p${index + 1}`),
  scoringRule,
} as unknown as HistoryRecord);

const ranksOf = async (id: string) => {
  const data = await bgStatsExportService.exportData();
  const exported = (data.plays || []).find((p: any) => p.uuid === id);
  return exported.playerScores.map((score: any) => ({ score: score.score, rank: score.rank, winner: score.winner }));
};

describe('bgStatsExportService ranks', () => {
  beforeEach(() => { tables.history.rows.length = 0; });

  it('ranks the highest score first when the highest score wins', async () => {
    tables.history.rows.push(play('high', 'HIGHEST_WINS', [30, 50, 50, 10], [1, 2]));
    expect(await ranksOf('high')).toEqual([
      { score: '30', rank: 3, winner: false },
      { score: '50', rank: 1, winner: true },
      { score: '50', rank: 1, winner: true },
      { score: '10', rank: 4, winner: false },
    ]);
  });

  it('puts a tie-break winner ahead of a tied loser', async () => {
    tables.history.rows.push(play('tie', 'HIGHEST_WINS', [40, 40, 20], [1]));
    expect((await ranksOf('tie')).map((s: any) => s.rank)).toEqual([2, 1, 3]);
  });

  it('ranks no-points plays by winners only and leaves their scores blank', async () => {
    tables.history.rows.push(play('nopts', 'COMPETITIVE_NO_SCORE', [0, 0, 0], [2]));
    expect(await ranksOf('nopts')).toEqual([
      { score: '', rank: 2, winner: false },
      { score: '', rank: 2, winner: false },
      { score: '', rank: 1, winner: true },
    ]);
  });

  it('ranks the lowest score first when the lowest score wins', async () => {
    tables.history.rows.push(play('low', 'LOWEST_WINS', [12, 30, 21], [0]));
    expect(await ranksOf('low')).toEqual([
      { score: '12', rank: 1, winner: true },
      { score: '30', rank: 3, winner: false },
      { score: '21', rank: 2, winner: false },
    ]);
  });
});

describe('bgStatsExportService game and player flags', () => {
  beforeEach(() => { tables.history.rows.length = 0; });

  it('marks only lowest-wins games as not highest-wins', async () => {
    tables.history.rows.push(
      play('coop', 'COOP_NO_SCORE', [0, 0], [0, 1]),
      play('none', 'COMPETITIVE_NO_SCORE', [0, 0], [0]),
      play('low', 'LOWEST_WINS', [1, 2], [0]),
    );
    const data = await bgStatsExportService.exportData();
    expect(Object.fromEntries((data.games || []).map(g => [g.name, g.highestWins])))
      .toEqual({ 'Game coop': true, 'Game none': true, 'Game low': false });
  });

  it('marks a linked player new only in their earliest play of a game', async () => {
    const linked = (record: HistoryRecord, startTime: number) => ({
      ...record, gameName: 'Same game', startTime,
      players: record.players.map((p, i) => ({ ...p, linkedPlayerId: i === 0 ? 'ann' : undefined })),
    }) as HistoryRecord;
    tables.history.rows.push(
      linked(play('later', 'HIGHEST_WINS', [1, 2], [1]), 2000),
      linked(play('first', 'HIGHEST_WINS', [1, 2], [1]), 1000),
    );
    const data = await bgStatsExportService.exportData();
    const flags = (id: string) => (data.plays || []).find((p: any) => p.uuid === id).playerScores.map((s: any) => s.newPlayer);
    expect(flags('first')).toEqual([true, false]);
    expect(flags('later')).toEqual([false, false]);
  });
});

describe('bgStatsExportService players', () => {
  beforeEach(() => { tables.history.rows.length = 0; });

  const withPlayers = (record: HistoryRecord, players: { name: string; linkedPlayerId?: string }[]) => ({
    ...record,
    players: record.players.map((player, index) => ({ ...player, ...players[index] })),
  }) as HistoryRecord;

  it('exports unlinked default-named players as one anonymous player with a uuid', async () => {
    tables.history.rows.push(
      withPlayers(play('a', 'HIGHEST_WINS', [1, 2, 3], [2]), [
        { name: '玩家 1' }, { name: 'Player 2' }, { name: 'Claudia', linkedPlayerId: 'claudia-uuid' },
      ]),
      withPlayers(play('b', 'HIGHEST_WINS', [1, 2], [1]), [{ name: '玩家 3' }, { name: 'Claudia', linkedPlayerId: 'claudia-uuid' }]),
    );
    const data = await bgStatsExportService.exportData();

    const anonymous = (data.players || []).filter(p => p.isAnonymous);
    expect(anonymous).toHaveLength(1);
    expect(anonymous[0].uuid).not.toBe('');
    expect(data.players).toHaveLength(2);

    const refsOf = (id: string) => (data.plays || []).find((p: any) => p.uuid === id).playerScores.map((s: any) => s.playerRefId);
    expect(refsOf('a').slice(0, 2)).toEqual([anonymous[0].id, anonymous[0].id]);
    expect(refsOf('b')[0]).toBe(anonymous[0].id);
  });

  it('keeps an unlinked player with a custom name as its own player', async () => {
    tables.history.rows.push(withPlayers(play('c', 'HIGHEST_WINS', [1, 2], [1]), [{ name: '玩家 1' }, { name: 'Guest Bob' }]));
    const data = await bgStatsExportService.exportData();
    expect((data.players || []).map(p => p.name).sort()).toEqual(['Anonymous player', 'Guest Bob']);
  });
});
