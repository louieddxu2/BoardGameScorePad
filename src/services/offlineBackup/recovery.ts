import type { OfflineBackupIssue } from '../../types';
import { BackupError, DATA_TABLES, PREFERENCE_KEYS, isObject, type Preferences, type Row } from './format';
import { validateBackupRows, validateBackupPreferences } from './contentValidation';

export type RecordIssue = (path: string, reason: OfflineBackupIssue['reason'], detail?: string) => void;

/** One report entry per affected file/reference; retain the first underlying cause. */
export function createIssueLog() {
  const entries = new Map<string, OfflineBackupIssue>();
  const record: RecordIssue = (path, reason, detail) => {
    if (!entries.has(path)) entries.set(path, { path, reason, ...(detail ? { detail } : {}) });
  };
  return { record, has: (path: string) => entries.has(path), all: () => [...entries.values()] };
}

const UNIQUE_NAMES = new Set([
  'savedPlayers', 'savedLocations', 'savedGames', 'savedWeekdays', 'savedTimeSlots', 'savedPlayerCounts', 'savedGameModes',
]);

/** Isolate malformed rows; a bad record must not hide the next usable one. */
export function recoverTableRows(table: typeof DATA_TABLES[number], documents: { path: string; value: unknown }[], record: RecordIssue): Row[] {
  const rows: Row[] = [];
  const ids = new Set<unknown>();
  const names = new Set<unknown>();
  const single = ['templates', 'history', 'sessions'].includes(table);
  const key = table === 'templatePrefs' ? 'templateId' : table === 'analyticsLogs' ? 'historyId' : 'id';
  for (const { path, value } of documents) {
    if (!single && !Array.isArray(value)) { record(path, 'invalid', 'rows'); continue; }
    const candidates = single ? [value] : value as unknown[];
    for (const [index, row] of candidates.entries()) {
      const at = single ? path : `${path}#row=${index + 1}`;
      try {
        const checked = [row];
        validateBackupRows(table, checked, () => {});
        const item = checked[0];
        if (ids.has(item[key]) || (UNIQUE_NAMES.has(table) && names.has(item.name))) throw new BackupError('invalid', 'duplicate key');
        ids.add(item[key]);
        if (UNIQUE_NAMES.has(table)) names.add(item.name);
        rows.push(item);
      } catch (error) {
        record(at, 'invalid', error instanceof Error ? error.message : 'record');
      }
    }
  }
  return rows;
}

export function recoverPreferences(value: unknown, record: RecordIssue): Preferences {
  const preferences: Preferences = {};
  if (!isObject(value)) { record('_System/settings_backup.json#preferences', 'invalid'); return preferences; }
  for (const [key, entry] of Object.entries(value)) {
    // Retired direction preferences in older ZIPs are ignored, not restored.
    if (key === 'sm_pref_advance_direction') continue;
    try {
      validateBackupPreferences({ [key]: entry });
      preferences[key as typeof PREFERENCE_KEYS[number]] = entry as string;
    } catch { record(`_System/settings_backup.json#${key}`, 'invalid'); }
  }
  return preferences;
}
