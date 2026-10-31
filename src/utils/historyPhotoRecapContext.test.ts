import { describe, expect, it } from 'vitest';
import type { HistorySummary } from './extractDataSummaries';
import { buildHistoryGameEntries } from './historyGameEntries';
import { buildHistoryPhotoRecapContext } from './historyPhotoRecapContext';

const record = (id: string, endTime: number, extra: Partial<HistorySummary> = {}): HistorySummary => ({
  id, endTime, templateId: 'template', gameName: 'Game', players: [], winnerIds: [],
  _playerNames: '', _dateStr: '', _compactDate: '', _rocDate: '', ...extra,
});
const contextFor = (records: HistorySummary[]) => buildHistoryPhotoRecapContext(buildHistoryGameEntries(records), records);

describe('history photo recap context', () => {
  it('covers earlier plays without photos instead of using the latest play of each game', () => {
    const context = contextFor([
      record('older', new Date(2026, 9, 18).getTime()),
      record('photo', new Date(2026, 10, 1).getTime(), { firstPhotoId: 'photo' }),
    ]);
    expect(context).toEqual({
      isSingleGame: true, gameName: 'Game', dateLabel: '2026.10.18 — 11.01',
      isSingleDay: false, includePhotoYear: false,
    });
  });

  it('recognizes one local calendar day across different games and times', () => {
    const context = contextFor([
      record('morning', new Date(2026, 10, 1, 0, 5).getTime()),
      record('evening', new Date(2026, 10, 1, 23, 55).getTime(), { gameName: 'Other' }),
    ]);
    expect(context).toMatchObject({ isSingleGame: false, gameName: '', isSingleDay: true, dateLabel: '2026.11.01' });
  });

  it('distinguishes adjacent local days and labels both years across a year boundary', () => {
    expect(contextFor([
      record('december', new Date(2025, 11, 31, 23, 55).getTime()),
      record('january', new Date(2026, 0, 1, 0, 5).getTime()),
    ])).toMatchObject({ isSingleDay: false, dateLabel: '2025.12.31 — 2026.01.01', includePhotoYear: true });
  });

  it('uses scoped record IDs and ignores other dates outside the selected game', () => {
    const records = [
      record('selected', new Date(2026, 10, 1).getTime()),
      record('outside', new Date(2020, 0, 1).getTime(), { gameName: 'Other' }),
    ];
    const entries = buildHistoryGameEntries(records).filter(entry => entry.displayName === 'Game');
    expect(buildHistoryPhotoRecapContext(entries, records)).toMatchObject({ dateLabel: '2026.11.01', isSingleDay: true });
  });

  it('keeps distinct BGG identities even when their names match', () => {
    expect(contextFor([
      record('first', 1000, { bggId: '123' }),
      record('second', 2000, { bggId: '456' }),
    ])).toMatchObject({ isSingleGame: false, gameName: '' });
  });

  it.each([NaN, Infinity, 9e20])('does not fabricate a range for invalid date %s', timestamp => {
    expect(contextFor([record('valid', 1000), record('invalid', timestamp)])).toMatchObject({
      dateLabel: '', isSingleDay: false, includePhotoYear: true,
    });
  });

  it('does not infer the full date range from incomplete records or photo dates', () => {
    const records = [record('first', 1000), record('missing', 2000)];
    expect(buildHistoryPhotoRecapContext(buildHistoryGameEntries(records), records.slice(0, 1))).toMatchObject({
      dateLabel: '', isSingleDay: false, includePhotoYear: true,
    });
    expect(contextFor([])).toMatchObject({ isSingleGame: false, dateLabel: '', isSingleDay: false });
  });
});
