import { describe, expect, it } from 'vitest';
import type { HistoryRecord } from '../../../types';
import { captureBgStatsSource, restoreBgStatsPlay } from './bgStatsPlaySource';

const sourcePlay = {
  uuid: 'play-1', gameRefId: 7, locationRefId: 3, playDate: '2026-11-07 20:00:00', durationMin: 60,
  entryDate: '2026-11-07 23:10:00', modificationDate: '2026-11-08 09:00:00', manualWinner: true,
  rounds: 9, board: 'Variant B', metaData: '{"x":1}', comments: '',
  playerScores: [
    { playerRefId: 1, score: '', rank: 2, winner: false, newPlayer: true, seatOrder: 0, team: '1', role: 'Spy' },
    { playerRefId: 2, score: '12', rank: 1, winner: true, newPlayer: false, seatOrder: 0, team: '2' },
  ],
};

const record = (): HistoryRecord => ({
  id: 'play-1', templateId: 'game', gameName: 'Game', startTime: 1000, endTime: 3601000, note: '',
  players: [
    { id: 'player_1', name: '玩家 1', color: 'transparent', scores: {}, totalScore: 0 },
    { id: 'player_2', name: 'Claudia', color: 'transparent', scores: {}, totalScore: 12, linkedPlayerId: 'claudia' },
  ],
  winnerIds: ['player_2'], scoringRule: 'HIGHEST_WINS', snapshotTemplate: {} as HistoryRecord['snapshotTemplate'],
} as HistoryRecord);

const imported = (): HistoryRecord => {
  const r = record();
  r.bgStatsSource = captureBgStatsSource(sourcePlay, r);
  return r;
};

const exportOf = (r: HistoryRecord) => {
  const managedScores = r.players.map((p, i) => ({
    playerRefId: 100 + i, score: String(p.totalScore), winner: r.winnerIds.includes(p.id), startPlayer: false, rank: 9,
  }));
  return restoreBgStatsPlay(
    r,
    { uuid: r.id, gameRefId: 70, locationRefId: 30, playDate: 'managed', modificationDate: 'now', comments: r.note || '' },
    { rounds: 0, manualWinner: false, entryDate: 'placeholder' },
    managedScores,
    r.players.map((_, i) => ({ newPlayer: false, seatOrder: i })),
  ) as any;
};

describe('restoreBgStatsPlay', () => {
  it('returns the original play unchanged apart from this file\'s references', () => {
    const out = exportOf(imported());
    const { playerScores, gameRefId, locationRefId, ...rest } = out;
    const { playerScores: srcScores, gameRefId: _g, locationRefId: _l, ...srcRest } = sourcePlay;
    expect(rest).toEqual(srcRest);
    expect([gameRefId, locationRefId]).toEqual([70, 30]);
    expect(playerScores).toEqual(srcScores.map((s, i) => ({ ...s, playerRefId: 100 + i })));
  });

  it('applies ScorePad edits and keeps the original fields it does not track', () => {
    const r = imported();
    r.players[1].totalScore = 15;
    const out = exportOf(r);
    expect(out).toMatchObject({ rounds: 9, board: 'Variant B', entryDate: '2026-11-07 23:10:00', modificationDate: 'now', playDate: 'managed' });
    expect(out.playerScores[0]).toMatchObject({ score: '', team: '1', role: 'Spy', newPlayer: true, rank: 9 });
    expect(out.playerScores[1]).toMatchObject({ score: '15', team: '2', playerRefId: 101 });
  });

  it('drops a seat\'s original fields once a different player sits there', () => {
    const r = imported();
    r.players[0] = { ...r.players[0], name: 'Bob', linkedPlayerId: 'bob' };
    const out = exportOf(r);
    expect(out.playerScores[0]).toEqual({ newPlayer: false, seatOrder: 0, playerRefId: 100, score: '0', winner: false, startPlayer: false, rank: 9 });
  });

  it('uses placeholders for plays that were not imported from BG Stats', () => {
    const out = exportOf(record());
    expect(out).toMatchObject({ rounds: 0, manualWinner: false, entryDate: 'placeholder', playDate: 'managed' });
    expect(out.playerScores[0]).toMatchObject({ newPlayer: false, seatOrder: 0, score: '0' });
  });
});
