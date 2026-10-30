import { isAppTheme } from '../../theme';
import { DATA_TABLES, PREFERENCE_KEYS, BackupError, isObject, type Row, type Preferences, type ImageEntry, type Manifest, type BackupTables } from './format';

function invalid(detail = ''): never { throw new BackupError('invalid', detail); }
export const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !value.includes('\0');
export const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

function validateImageReference(value: Row, prefix: string) {
  if (value.imageId != null && value.imageId !== '' && !text(value.imageId)) invalid(`${prefix}imageId`);
}

function validateTemplate(value: unknown, prefix = '') {
  if (!isObject(value)) invalid(prefix || 'template');
  if (!text(value.id)) invalid(`${prefix}id`);
  if (typeof value.name !== 'string') invalid(`${prefix}name`);
  if (!Array.isArray(value.columns)) invalid(`${prefix}columns`);
  validateImageReference(value, prefix);
  const ids = new Set<string>();
  for (const [index, col] of (value.columns as unknown[]).entries()) {
    const field = `${prefix}columns[${index}]`;
    // Legacy columns omit formula; migrateColumn supplies/converts it when opened.
    // Keep the stored snapshot intact, as the cloud restore does.
    if (!isObject(col)) invalid(field);
    if (!text(col.id) || ids.has(col.id)) invalid(`${field}.id`);
    if (typeof col.name !== 'string') invalid(`${field}.name`);
    if (col.formula != null && typeof col.formula !== 'string') invalid(`${field}.formula`);
    ids.add(col.id as string);
  }
}

function validateHistorySnapshot(value: unknown) {
  // getRecordTemplate already renders these legacy simple-board markers using a
  // virtual template. Preserve them instead of treating them as full templates.
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) return;
  if (!isObject(value)) invalid('snapshotTemplate');
  if (value.columns === undefined || value.columns === null) {
    validateImageReference(value, 'snapshotTemplate.');
    return;
  }
  validateTemplate(value, 'snapshotTemplate.');
}

export function validateBackupRows(table: string, rows: unknown, onRow: (index: number) => void): asserts rows is Row[] {
  if (!Array.isArray(rows)) invalid();
  const key = table === 'templatePrefs' ? 'templateId' : table === 'analyticsLogs' ? 'historyId' : 'id';
  const ids = new Set<string>();
  for (const [index, row] of (rows as unknown[]).entries()) {
    onRow(index);
    if (!isObject(row)) invalid('record');
    if (!text(row[key]) || ids.has(row[key] as string)) invalid(key);
    ids.add(row[key] as string);
    if (table === 'templates') validateTemplate(row);
    if (table === 'history' || table === 'sessions') {
      if (!text(row.templateId)) invalid('templateId');
      if (!number(row.startTime)) invalid('startTime');
      if (!Array.isArray(row.players)) invalid('players');
      const players = new Set<string>();
      for (const [playerIndex, player] of (row.players as unknown[]).entries()) {
        const field = `players[${playerIndex}]`;
        if (!isObject(player)) invalid(field);
        if (!text(player.id) || players.has(player.id)) invalid(`${field}.id`);
        if (typeof player.name !== 'string') invalid(`${field}.name`);
        if (typeof player.color !== 'string') invalid(`${field}.color`);
        if (!isObject(player.scores)) invalid(`${field}.scores`);
        if (!number(player.totalScore)) invalid(`${field}.totalScore`);
        players.add(player.id as string);
      }
      if (row.photos != null && (!Array.isArray(row.photos) || !row.photos.every(text))) invalid('photos');
      if (row.photoContentIds != null && (!isObject(row.photoContentIds) || !Object.values(row.photoContentIds).every(text))) invalid('photoContentIds');
      if (table === 'history') {
        if (typeof row.gameName !== 'string') invalid('gameName');
        if (!number(row.endTime)) invalid('endTime');
        if (!Array.isArray(row.winnerIds) || !row.winnerIds.every(text)) invalid('winnerIds');
        validateHistorySnapshot(row.snapshotTemplate);
      } else {
        // Sessions created before names were stored use the template name on resume.
        if (row.name != null && typeof row.name !== 'string') invalid('name');
        if (row.status !== 'active' && row.status !== 'completed') invalid('status');
      }
    }
    if (table.startsWith('saved') || table === 'bggGames') {
      if (typeof row.name !== 'string') invalid();
    }
    if (table === 'weights' && !isObject(row.weights)) invalid();
  }
}

// Blob.type may be empty (e.g. old cloud downloads); preserve the original bytes
// and metadata instead of inventing an image format or rejecting a valid Blob.
const imageMime = (value: unknown) => typeof value === 'string'
  && (value === '' || value === 'application/octet-stream' || value.startsWith('image/'));

export function validateBackupImage(entry: unknown, files: Manifest['files']): asserts entry is ImageEntry {
  if (!isObject(entry) || !text(entry.id) || !text(entry.relatedId)
    || (entry.relatedType !== 'template' && entry.relatedType !== 'session') || !number(entry.createdAt)
    || !imageMime(entry.mimeType) || !text(entry.path) || !files[entry.path]
    || (entry.contentId != null && !text(entry.contentId))) invalid('image metadata');
  if (entry.rotationSource != null) {
    const source = entry.rotationSource;
    if (!isObject(source) || ![1, 2, 3].includes(source.quarterTurns as number)
      || !imageMime(source.mimeType) || !text(source.path) || !files[source.path]) invalid('rotationSource');
  }
}

export function validateBackupPreferences(value: unknown): asserts value is Preferences {
  if (!isObject(value) || Object.keys(value).some(key => !PREFERENCE_KEYS.includes(key as typeof PREFERENCE_KEYS[number]))) invalid();
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' || entry.length > 1024 * 1024) invalid();
    if (key === 'app_theme_mode' && !isAppTheme(entry)) invalid();
    if (key === 'app_language' && !['en', 'zh-TW'].includes(entry as string)) invalid();
    if (['app_edit_mode', 'app_voice_enabled', 'sm_pref_editor_adv'].includes(key) && !['true', 'false'].includes(entry as string)) invalid();
    if (key === 'app_zoom_level' && (!(Number(entry) > 0) || !Number.isFinite(Number(entry)))) invalid();
    if (key === 'sm_pref_advance_direction' && !['vertical', 'horizontal'].includes(entry as string)) invalid();
    if (key === 'sm_pinned_ids' || key === 'sm_new_badge_ids') {
      const ids: unknown = JSON.parse(entry as string);
      if (!Array.isArray(ids) || !ids.every(text)) invalid();
    }
  }
}

/** Preflight the same data contract before export, without re-reading/unzipping it. */
export function validateBackupContent(tables: BackupTables, preferences: Preferences) {
  let location = '_System/settings_backup.json (preferences)';
  try {
    validateBackupPreferences(preferences);
    for (const table of DATA_TABLES) {
      validateBackupRows(table, tables[table], index => { location = `table: ${table} / row: ${index + 1}`; });
    }
  } catch (error) {
    const detail = error instanceof BackupError && error.message !== 'invalid' ? ` / ${error.message}` : '';
    throw new BackupError('invalid', location + detail);
  }
}

