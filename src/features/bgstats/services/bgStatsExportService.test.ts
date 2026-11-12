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
      { score: '30', rank: 2, winner: false },
      { score: '50', rank: 1, winner: true },
      { score: '50', rank: 1, winner: true },
      { score: '10', rank: 3, winner: false },
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
