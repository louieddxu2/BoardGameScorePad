import { describe, expect, it } from 'vitest';
import {
  ALL_HISTORY_DATES, applyHistoryDateDraft, changeHistoryDatePrecision, createHistoryDateDraft,
  formatHistoryDateSelection, matchesHistoryDate, resolveHistoryDateFilter,
  type HistoryDateFilter, type HistoryDatePrecision
} from './historyDateFilter';

const custom = (precision: HistoryDatePrecision, start = { year: 2026, month: 11, day: 2 }, end = start): HistoryDateFilter =>
  ({ kind: 'custom', precision, start, end, range: start !== end, startOpen: false, endOpen: false });

describe('calendar history date filters', () => {
  it.each([
    ['day', new Date(2026, 10, 2), new Date(2026, 10, 3)],
    ['month', new Date(2026, 10, 1), new Date(2026, 11, 1)],
    ['year', new Date(2026, 0, 1), new Date(2027, 0, 1)]
  ] as const)('includes the complete %s and excludes the next period', (precision, first, next) => {
    const bounds = resolveHistoryDateFilter(custom(precision));
    expect(bounds).toEqual({ valid: true, start: first.getTime(), end: next.getTime() });
    expect(matchesHistoryDate(first.getTime() - 1, bounds)).toBe(false);
    expect(matchesHistoryDate(first.getTime(), bounds)).toBe(true);
    expect(matchesHistoryDate(next.getTime() - 1, bounds)).toBe(true);
    expect(matchesHistoryDate(next.getTime(), bounds)).toBe(false);
  });

  it('uses calendar months including leap February, not a rolling number of days', () => {
    const bounds = resolveHistoryDateFilter({ kind: 'month' }, new Date(2024, 1, 15));
    expect(matchesHistoryDate(new Date(2024, 1, 1).getTime(), bounds)).toBe(true);
    expect(matchesHistoryDate(new Date(2024, 1, 29, 23, 59).getTime(), bounds)).toBe(true);
    expect(matchesHistoryDate(new Date(2024, 0, 31, 23, 59).getTime(), bounds)).toBe(false);
    expect(resolveHistoryDateFilter({ kind: 'month' }, new Date(2024, 2, 1)).start).toBe(new Date(2024, 2, 1).getTime());
  });

  it('includes both ends of cross-year ranges and accepts the same day twice', () => {
    const start = { year: 2025, month: 12, day: 31 }, end = { year: 2026, month: 1, day: 2 };
    const bounds = resolveHistoryDateFilter(custom('day', start, end));
    expect(matchesHistoryDate(new Date(2026, 0, 2, 23, 59, 59, 999).getTime(), bounds)).toBe(true);
    expect(matchesHistoryDate(new Date(2026, 0, 3).getTime(), bounds)).toBe(false);
    expect(resolveHistoryDateFilter(custom('day', start, { ...start })).valid).toBe(true);
    expect(resolveHistoryDateFilter(custom('day', end, start)).valid).toBe(false);
  });

  it('expands month/year ranges through their final day and refines their full boundaries', () => {
    const filter = custom('year', { year: 2024, month: 2, day: 12 }, { year: 2025, month: 8, day: 25 });
    const draft = createHistoryDateDraft(filter);
    const months = changeHistoryDatePrecision(draft, 'month');
    expect(months.start).toEqual({ year: 2024, month: 1, day: 1 });
    expect(months.end).toEqual({ year: 2025, month: 12, day: 31 });
    expect(resolveHistoryDateFilter(applyHistoryDateDraft(months))).toEqual(resolveHistoryDateFilter(filter));
    const feb = createHistoryDateDraft(custom('month', { year: 2024, month: 2, day: 12 }, { year: 2024, month: 2, day: 25 }));
    const day = changeHistoryDatePrecision(feb, 'day');
    expect(day.start.day).toBe(1);
    expect(day.end.day).toBe(29);
    expect(resolveHistoryDateFilter(applyHistoryDateDraft(day))).toEqual(resolveHistoryDateFilter(applyHistoryDateDraft(feb)));
  });

  it('keeps single-period values and drafts isolated from the applied filter', () => {
    const filter = custom('month');
    const draft = createHistoryDateDraft(filter);
    const finer = changeHistoryDatePrecision(draft, 'day');
    expect(finer.range).toBe(false);
    expect(finer.start).toEqual(draft.start);
    draft.start.year = 2030;
    expect(filter.kind === 'custom' && filter.start.year).toBe(2026);
  });

  it('supports either open end, canonicalizes both open ends, and rejects invalid dates', () => {
    const draft = { ...createHistoryDateDraft(custom('day')), range: true, endOpen: true };
    const bounds = resolveHistoryDateFilter(applyHistoryDateDraft(draft));
    expect(bounds.end).toBeUndefined();
    expect(matchesHistoryDate(new Date(2030, 0, 1).getTime(), bounds)).toBe(true);
    const until = resolveHistoryDateFilter(applyHistoryDateDraft({ ...draft, startOpen: true, endOpen: false }));
    expect(until.start).toBeUndefined();
    expect(matchesHistoryDate(new Date(2020, 0, 1).getTime(), until)).toBe(true);
    expect(applyHistoryDateDraft({ ...draft, startOpen: true })).toEqual(ALL_HISTORY_DATES);
    expect(matchesHistoryDate(NaN, bounds)).toBe(false);
    expect(matchesHistoryDate(Infinity, bounds)).toBe(false);
    expect(matchesHistoryDate(NaN, resolveHistoryDateFilter(ALL_HISTORY_DATES))).toBe(true);
    expect(resolveHistoryDateFilter(custom('day', { year: 2025, month: 2, day: 29 })).valid).toBe(false);
  });

  it('preserves years 1 through 9999 and labels the selected precision', () => {
    const first = resolveHistoryDateFilter(custom('year', { year: 1, month: 1, day: 1 }));
    expect(new Date(first.start!).getFullYear()).toBe(1);
    const last = resolveHistoryDateFilter(custom('year', { year: 9999, month: 12, day: 31 }));
    expect(new Date(last.end!).getFullYear()).toBe(10000);
    for (const [precision, label] of [['year', '2026'], ['month', '2026/11'], ['day', '2026/11/02']] as const) {
      const filter = custom(precision);
      if (filter.kind === 'custom') expect(formatHistoryDateSelection(filter)).toBe(label);
    }
  });

});
