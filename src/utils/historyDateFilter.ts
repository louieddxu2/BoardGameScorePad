export type HistoryDatePrecision = 'year' | 'month' | 'day';
export interface HistoryDateParts { year: number; month: number; day: number }
export interface HistoryDateDraft {
  precision: HistoryDatePrecision;
  range: boolean;
  start: HistoryDateParts;
  end: HistoryDateParts;
  startOpen: boolean;
  endOpen: boolean;
}
export type HistoryDateFilter = { kind: 'all' } | { kind: 'month' } |
  ({ kind: 'custom' } & HistoryDateDraft);
export const ALL_HISTORY_DATES: HistoryDateFilter = { kind: 'all' };

export const historyDateDaysInMonth = (year: number, month: number): number => {
  const date = new Date(0);
  date.setFullYear(year, month, 0);
  return date.getDate();
};
export const historyDateParts = (date = new Date()): HistoryDateParts => ({
  year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate()
});
export const validHistoryDate = (parts: HistoryDateParts): boolean =>
  Number.isInteger(parts.year) && parts.year >= 1 && parts.year <= 9999 &&
  Number.isInteger(parts.month) && parts.month >= 1 && parts.month <= 12 &&
  Number.isInteger(parts.day) && parts.day >= 1 && parts.day <= historyDateDaysInMonth(parts.year, parts.month);

export const createHistoryDateDraft = (filter: HistoryDateFilter, now = new Date()): HistoryDateDraft => {
  if (filter.kind === 'custom') return { ...filter, start: { ...filter.start }, end: { ...filter.end } };
  const today = historyDateParts(now);
  return { precision: filter.kind === 'month' ? 'month' : 'day', range: false,
    start: { ...today }, end: { ...today }, startOpen: false, endOpen: false };
};

// Calendar construction deliberately avoids Date's special interpretation of years 1–99.
const localBoundary = (parts: HistoryDateParts, precision: HistoryDatePrecision, end: boolean): number => {
  const month = precision === 'year' ? (end ? 12 : 1) : parts.month;
  const day = precision === 'day' ? parts.day : end ? historyDateDaysInMonth(parts.year, month) : 1;
  const date = new Date(0);
  date.setFullYear(parts.year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (end) date.setDate(date.getDate() + 1);
  return date.getTime();
};

export const resolveHistoryDateFilter = (filter: HistoryDateFilter, now = new Date()) => {
  if (filter.kind === 'all') return { valid: true, start: undefined, end: undefined };
  const draft = filter.kind === 'month' ? createHistoryDateDraft(filter, now) : filter;
  const startParts = draft.range && draft.startOpen ? undefined : draft.start;
  const endParts = draft.range ? (draft.endOpen ? undefined : draft.end) : draft.start;
  if ((startParts && !validHistoryDate(startParts)) || (endParts && !validHistoryDate(endParts))) {
    return { valid: false, start: undefined, end: undefined };
  }
  const start = startParts ? localBoundary(startParts, draft.precision, false) : undefined;
  const end = endParts ? localBoundary(endParts, draft.precision, true) : undefined;
  return { valid: start === undefined || end === undefined || start < end, start, end };
};

export const applyHistoryDateDraft = (draft: HistoryDateDraft): HistoryDateFilter =>
  draft.range && draft.startOpen && draft.endOpen ? ALL_HISTORY_DATES :
    { kind: 'custom', ...draft, start: { ...draft.start }, end: { ...draft.end } };

export const matchesHistoryDate = (timestamp: number, bounds: ReturnType<typeof resolveHistoryDateFilter>): boolean => {
  if (!bounds.valid) return false;
  if (bounds.start === undefined && bounds.end === undefined) return true;
  return Number.isFinite(timestamp) && Number.isFinite(new Date(timestamp).getTime()) &&
    (bounds.start === undefined || timestamp >= bounds.start) &&
    (bounds.end === undefined || timestamp < bounds.end);
};

export const changeHistoryDatePrecision = (draft: HistoryDateDraft, precision: HistoryDatePrecision): HistoryDateDraft => {
  const start = { ...draft.start }, end = { ...draft.end };
  if (draft.range && draft.precision === 'year' && precision !== 'year') {
    start.month = 1; start.day = 1; end.month = 12; end.day = 31;
  } else if (draft.range && draft.precision === 'month' && precision === 'day') {
    start.day = 1; end.day = historyDateDaysInMonth(end.year, end.month);
  }
  return { ...draft, precision, start, end };
};

export const formatHistoryDateSelection = (filter: Extract<HistoryDateFilter, { kind: 'custom' }>): string => {
  const format = (p: HistoryDateParts) => {
    const year = String(p.year).padStart(4, '0'), month = String(p.month).padStart(2, '0');
    return filter.precision === 'year' ? year : filter.precision === 'month' ? `${year}/${month}` :
      `${year}/${month}/${String(p.day).padStart(2, '0')}`;
  };
  if (!filter.range) return format(filter.start);
  if (filter.startOpen && filter.endOpen) return '';
  if (filter.startOpen) return `≤ ${format(filter.end)}`;
  if (filter.endOpen) return `≥ ${format(filter.start)}`;
  const start = format(filter.start), end = format(filter.end);
  return start === end ? start : `${start} — ${end}`;
};
