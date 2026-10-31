import type { HistorySummary } from './extractDataSummaries';
import type { HistoryGameEntry } from './historyGameEntries';

export interface HistoryPhotoRecapContext {
  isSingleGame: boolean;
  gameName: string;
  dateLabel: string;
  isSingleDay: boolean;
  includePhotoYear: boolean;
}

export interface HistoryPhotoRecapSnapshot {
  entries: HistoryGameEntry[];
  context: HistoryPhotoRecapContext;
  filters: string[];
  playerName?: string;
  playerCountOverride?: number;
  playerLabelOverride?: string;
}

export const EMPTY_PHOTO_RECAP_CONTEXT: HistoryPhotoRecapContext = {
  isSingleGame: false, gameName: '', dateLabel: '', isSingleDay: false, includePhotoYear: true,
};

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date, includeYear = true) => (
  `${includeYear ? `${date.getFullYear()}.` : ''}${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
);

/** Use every scoped record, including plays without photos or outside the selected eight. */
export const buildHistoryPhotoRecapContext = (
  entries: readonly HistoryGameEntry[], records: readonly HistorySummary[],
): HistoryPhotoRecapContext => {
  const context = {
    ...EMPTY_PHOTO_RECAP_CONTEXT,
    isSingleGame: entries.length === 1,
    gameName: entries.length === 1 ? entries[0].displayName.trim() : '',
  };
  const expectedIds = new Set(entries.flatMap(entry => entry.recordIds));
  if (expectedIds.size === 0) return context;

  const seen = new Set<string>();
  let earliest = Infinity;
  let latest = -Infinity;
  for (const record of records) {
    if (!expectedIds.has(record.id)) continue;
    if (!Number.isFinite(record.endTime) || !Number.isFinite(new Date(record.endTime).getTime())) return context;
    seen.add(record.id);
    earliest = Math.min(earliest, record.endTime);
    latest = Math.max(latest, record.endTime);
  }
  // Incomplete source data cannot establish a shared day or a complete range.
  if (seen.size !== expectedIds.size) return context;

  const first = new Date(earliest);
  const last = new Date(latest);
  const isSingleDay = localDate(first) === localDate(last);
  const includePhotoYear = first.getFullYear() !== last.getFullYear();
  return {
    ...context,
    isSingleDay,
    includePhotoYear,
    dateLabel: isSingleDay ? localDate(first) : `${localDate(first)} — ${localDate(last, includePhotoYear)}`,
  };
};
