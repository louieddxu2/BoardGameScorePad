import type { LocalImage } from '../../types';
import { isAppTheme } from '../../theme';
import {
  MANIFEST, ROOT, DATA_TABLES, PREFERENCE_KEYS, BackupError, isObject, safePath,
  parseJson, digest, unpack, readBlob, type BackupTables, type Manifest, type Preferences,
  type Progress, type Row,
} from './format';

export interface ValidatedBackup {
  tables: BackupTables;
  images: LocalImage[];
  preferences: Preferences;
  databaseVersion: number;
}
function invalid(): never { throw new BackupError('invalid'); }
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !value.includes('\0');
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

function validateTemplate(value: unknown) {
  if (!isObject(value) || !text(value.id) || typeof value.name !== 'string' || !Array.isArray(value.columns)) invalid();
  const ids = new Set<string>();
  for (const col of value.columns as unknown[]) {
    // Legacy columns omit formula; migrateColumn supplies/converts it when opened.
    // Keep the stored snapshot intact, as the cloud restore does.
    if (!isObject(col) || !text(col.id) || ids.has(col.id) || typeof col.name !== 'string'
      || (col.formula !== undefined && typeof col.formula !== 'string')) invalid();
    ids.add(col.id as string);
  }
}

function validateRows(table: string, rows: unknown): asserts rows is Row[] {
  if (!Array.isArray(rows)) invalid();
  const key = table === 'templatePrefs' ? 'templateId' : table === 'analyticsLogs' ? 'historyId' : 'id';
  const ids = new Set<string>();
  for (const row of rows as unknown[]) {
    if (!isObject(row) || !text(row[key]) || ids.has(row[key] as string)) invalid();
    ids.add(row[key] as string);
    if (table === 'templates') validateTemplate(row);
    if (table === 'history' || table === 'sessions') {
      if (!text(row.templateId) || !number(row.startTime) || !Array.isArray(row.players)) invalid();
      const players = new Set<string>();
      for (const player of row.players as unknown[]) {
        if (!isObject(player) || !text(player.id) || players.has(player.id) || typeof player.name !== 'string'
          || typeof player.color !== 'string' || !isObject(player.scores) || !number(player.totalScore)) invalid();
        players.add(player.id as string);
      }
      if (row.photos !== undefined && (!Array.isArray(row.photos) || !row.photos.every(text))) invalid();
      if (row.photoContentIds !== undefined && (!isObject(row.photoContentIds) || !Object.values(row.photoContentIds).every(text))) invalid();
      if (table === 'history') {
        if (typeof row.gameName !== 'string' || !number(row.endTime) || !Array.isArray(row.winnerIds) || !row.winnerIds.every(text)) invalid();
        if (row.snapshotTemplate !== undefined && row.snapshotTemplate !== null) validateTemplate(row.snapshotTemplate);
      } else if (typeof row.name !== 'string' || !['active', 'completed'].includes(String(row.status))) invalid();
    }
    if (table.startsWith('saved') || table === 'bggGames') {
      if (typeof row.name !== 'string') invalid();
    }
    if (table === 'weights' && !isObject(row.weights)) invalid();
  }
}

function validatePreferences(value: unknown): asserts value is Preferences {
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

/** Validate every document and asset before a caller may replace local data. */
export async function validateOfflineBackup(blob: Blob, onProgress: Progress = () => {}): Promise<ValidatedBackup> {
  let location = 'ZIP';
  try {
    const files = await unpack(await readBlob(blob));
    location = MANIFEST.slice(ROOT.length);
    if (!files[MANIFEST]) invalid();
    const raw = parseJson(files[MANIFEST]);
    if (isObject(raw) && raw.format === 'BoardGameScorePad' && typeof raw.version === 'number' && raw.version > 2) {
      throw new BackupError('unsupported');
    }
    if (!isObject(raw) || raw.format !== 'BoardGameScorePad' || ![1, 2].includes(raw.version as number) || !number(raw.databaseVersion)
      || !number(raw.createdAt) || !isObject(raw.tables) || !isObject(raw.files) || !Array.isArray(raw.images)) invalid();
    location = '_System/settings_backup.json (preferences)';
    validatePreferences(raw.preferences);
    location = MANIFEST.slice(ROOT.length);
    const manifest = raw as unknown as Manifest;
    if (Object.keys(files).length !== Object.keys(manifest.files).length + 1) invalid();
    for (const [path, meta] of Object.entries(manifest.files)) {
      location = path.slice(ROOT.length);
      if (!safePath(path) || path === MANIFEST || !isObject(meta) || !number(meta.size)
        || typeof meta.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(meta.sha256)) invalid();
      const bytes = files[path];
      if (!bytes || bytes.length !== meta.size) invalid();
      onProgress(path.slice(ROOT.length));
      if (await digest(bytes) !== meta.sha256) invalid();
    }
    const tables = {} as BackupTables;
    if (Object.keys(manifest.tables).length !== DATA_TABLES.length) invalid();
    const usedPaths = new Set<string>();
    for (const table of DATA_TABLES) {
      location = `table: ${table}`;
      const paths = manifest.tables[table];
      if (!Array.isArray(paths) || (!['templates', 'sessions', 'history'].includes(table) && paths.length !== 1)) invalid();
      const rows: unknown[] = [];
      for (const path of paths) {
        const area = table === 'templates' ? '_Templates/' : table === 'history' ? '_History/' : table === 'sessions' ? '_Active/' : '_System/tables/';
        if (typeof path !== 'string' || !path.startsWith(ROOT + area) || usedPaths.has(path) || !manifest.files[path]) invalid();
        usedPaths.add(path);
        location = path.slice(ROOT.length);
        const data = parseJson(files[path]);
        if (['templates', 'sessions', 'history'].includes(table)) rows.push(data);
        else if (Array.isArray(data)) rows.push(...data);
        else invalid();
      }
      location = `table: ${table}`;
      validateRows(table, rows);
      tables[table] = rows;
    }
    const images: LocalImage[] = [];
    const imageIds = new Set<string>();
    for (const entry of manifest.images) {
      location = 'images';
      if (!isObject(entry) || !text(entry.id) || imageIds.has(entry.id) || !text(entry.relatedId)
        || !['template', 'session'].includes(entry.relatedType) || !number(entry.createdAt)
        || typeof entry.mimeType !== 'string' || !entry.mimeType.startsWith('image/')
        || !text(entry.path) || !manifest.files[entry.path]
        || (entry.contentId !== undefined && !text(entry.contentId))) invalid();
      imageIds.add(entry.id);
      const image: LocalImage = {
        id: entry.id, relatedId: entry.relatedId, relatedType: entry.relatedType, createdAt: entry.createdAt,
        mimeType: entry.mimeType, blob: new Blob([new Uint8Array(files[entry.path]).buffer], { type: entry.mimeType }),
        isSynced: false, ...(entry.contentId ? { contentId: entry.contentId } : {}),
      };
      if (entry.rotationSource !== undefined) {
        location = entry.path.slice(ROOT.length);
        const source = entry.rotationSource;
        if (!isObject(source) || ![1, 2, 3].includes(source.quarterTurns as number)
          || typeof source.mimeType !== 'string' || !source.mimeType.startsWith('image/')
          || !text(source.path) || !manifest.files[source.path]) invalid();
        image.rotationSource = { quarterTurns: source.quarterTurns,
          blob: new Blob([new Uint8Array(files[source.path]).buffer], { type: source.mimeType }) };
      }
      images.push(image);
    }
    const imageById = new Map(images.map(image => [image.id, image]));
    location = '_System/missing_image_references.json';
    const missing = manifest.missingImageIds ?? [];
    if (manifest.version === 1 && missing.length > 0) invalid();
    if (missing.length > 0 && !manifest.files[`${ROOT}_System/missing_image_references.json`]) invalid();
    if (!Array.isArray(missing) || !missing.every(text) || new Set(missing).size !== missing.length
      || missing.some(id => imageById.has(id))) invalid();
    const missingIds = new Set(missing);
    const usedMissingIds = new Set<string>();
    const checkImage = (id: string) => {
      if (imageById.has(id)) return;
      if (!missingIds.has(id)) invalid();
      usedMissingIds.add(id);
    };
    const checkTemplate = (template: Row) => {
      if (template.imageId === undefined || template.imageId === null || template.imageId === '') return;
      if (!text(template.imageId)) invalid();
      checkImage(template.imageId);
    };
    location = 'table: templates (images)';
    tables.templates.forEach(checkTemplate);
    for (const row of [...tables.history, ...tables.sessions]) {
      location = `record: ${row.id} (images)`;
      for (const id of row.photos as string[] || []) {
        checkImage(id);
      }
      if (row.snapshotTemplate) checkTemplate(row.snapshotTemplate as Row);
    }
    if (usedMissingIds.size !== missingIds.size) invalid();
    return { tables, images, preferences: manifest.preferences, databaseVersion: manifest.databaseVersion };
  } catch (error) {
    if (error instanceof BackupError && error.code !== 'invalid') throw error;
    throw new BackupError('invalid', location.slice(0, 240));
  }
}
