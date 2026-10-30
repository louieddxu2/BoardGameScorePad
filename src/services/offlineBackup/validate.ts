import type { LocalImage } from '../../types';
import { validateBackupRows, validateBackupPreferences, validateBackupImage, text, number } from './contentValidation';
import {
  MANIFEST, ROOT, DATA_TABLES, BackupError, isObject, safePath,
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
    validateBackupPreferences(raw.preferences);
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
      validateBackupRows(table, rows, index => { location = `table: ${table} / row: ${index + 1}`; });
      tables[table] = rows;
    }
    const images: LocalImage[] = [];
    const imageIds = new Set<string>();
    for (const entry of manifest.images) {
      location = 'images';
      validateBackupImage(entry, manifest.files);
      if (imageIds.has(entry.id)) invalid();
      imageIds.add(entry.id);
      const image: LocalImage = {
        id: entry.id, relatedId: entry.relatedId, relatedType: entry.relatedType, createdAt: entry.createdAt,
        mimeType: entry.mimeType, blob: new Blob([new Uint8Array(files[entry.path]).buffer], { type: entry.mimeType }),
        isSynced: false, ...(entry.contentId ? { contentId: entry.contentId } : {}),
      };
      if (entry.rotationSource != null) {
        location = entry.path.slice(ROOT.length);
        const source = entry.rotationSource;
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
    const field = error instanceof BackupError && error.message !== 'invalid' ? ` / ${error.message}` : '';
    throw new BackupError('invalid', (location + field).slice(0, 240));
  }
}
