import type { LocalImage, OfflineBackupIssue } from '../../types';
import { validateBackupImage, text, number } from './contentValidation';
import { createIssueLog, recoverTableRows, recoverPreferences } from './recovery';
import {
  MANIFEST, ROOT, DATA_TABLES, BackupError, isObject, safePath,
  parseJson, digest, unpack, readBlob, type BackupTables, type Manifest,
  type Preferences, type Progress,
} from './format';

export interface ValidatedBackup {
  tables: BackupTables;
  images: LocalImage[];
  preferences: Preferences;
  databaseVersion: number;
  /** When the backup was exported (manifest time). */
  createdAt: number;
  issues: OfflineBackupIssue[];
}
function invalid(): never { throw new BackupError('invalid'); }

/** Read the index first, then isolate unreadable files before any database writes. */
export async function validateOfflineBackup(blob: Blob, onProgress: Progress = () => {}): Promise<ValidatedBackup> {
  let location = 'ZIP';
  try {
    const log = createIssueLog();
    const files = await unpack(await readBlob(blob), path => log.record(path.slice(ROOT.length), 'checksum'));
    location = MANIFEST.slice(ROOT.length);
    if (!files[MANIFEST]) invalid();
    const raw = parseJson(files[MANIFEST]);
    if (isObject(raw) && raw.format === 'BoardGameScorePad' && typeof raw.version === 'number' && raw.version > 2) {
      throw new BackupError('unsupported');
    }
    if (!isObject(raw) || raw.format !== 'BoardGameScorePad' || ![1, 2].includes(raw.version as number)
      || !number(raw.databaseVersion) || !number(raw.createdAt) || !isObject(raw.tables) || !isObject(raw.files)) invalid();
    const manifest = raw as unknown as Manifest;
    const preferences = recoverPreferences(raw.preferences, log.record);
    const usable = new Set<string>();
    const jsonDocuments = new Map<string, unknown>();
    for (const [path, meta] of Object.entries(manifest.files)) {
      location = path.slice(ROOT.length);
      if (!safePath(path) || path === MANIFEST) invalid();
      if (!isObject(meta) || !number(meta.size) || typeof meta.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(meta.sha256)) {
        log.record(location, 'invalid', 'file metadata'); continue;
      }
      const bytes = files[path];
      onProgress(location);
      if (!bytes) { log.record(location, 'missing'); continue; }
      if (bytes.length !== meta.size || await digest(bytes) !== meta.sha256) {
        log.record(location, 'checksum'); continue;
      }
      if (path.endsWith('.json')) {
        try { jsonDocuments.set(path, parseJson(bytes)); }
        catch { log.record(location, 'invalid', 'JSON'); continue; }
      }
      usable.add(path);
    }
    if (!usable.size) { location = 'ZIP (no recoverable files)'; invalid(); }
    const readJson = (path: string): unknown => {
      if (!usable.has(path)) return undefined;
      try { return jsonDocuments.has(path) ? jsonDocuments.get(path) : parseJson(files[path]); }
      catch { log.record(path.slice(ROOT.length), 'invalid', 'JSON'); return undefined; }
    };
    // export_report.json and missing_image_references.json describe the source
    // database. Their contents are not evidence of files lost during this import.
    const tables = {} as BackupTables;
    const usedPaths = new Set<string>();
    for (const table of DATA_TABLES) {
      const paths = manifest.tables[table];
      const documents: { path: string; value: unknown }[] = [];
      if (!Array.isArray(paths)) {
        log.record(`${MANIFEST.slice(ROOT.length)}#tables.${table}`, 'invalid');
        tables[table] = []; continue;
      }
      for (const path of paths) {
        const area = table === 'templates' ? '_Templates/' : table === 'history' ? '_History/' : table === 'sessions' ? '_Active/' : '_System/tables/';
        if (typeof path !== 'string' || !safePath(path) || !path.startsWith(ROOT + area) || usedPaths.has(path)) {
          log.record(`table:${table}`, 'invalid', 'file path'); continue;
        }
        usedPaths.add(path);
        const relative = path.slice(ROOT.length);
        if (!manifest.files[path]) log.record(relative, 'missing');
        const value = readJson(path);
        if (value !== undefined) documents.push({ path: relative, value });
      }
      tables[table] = recoverTableRows(table, documents, log.record);
    }
    const images: LocalImage[] = [];
    const imageIds = new Set<string>();
    const entries = Array.isArray(manifest.images) ? manifest.images : [];
    if (!Array.isArray(manifest.images)) log.record(`${MANIFEST.slice(ROOT.length)}#images`, 'invalid');
    for (const [index, entry] of entries.entries()) {
      const relative = isObject(entry) && text(entry.path) ? entry.path.slice(ROOT.length) : `images[${index}]`;
      // A lost rotation original must not discard a usable current photo.
      const current = isObject(entry) ? { ...entry, rotationSource: undefined } : entry;
      try {
        validateBackupImage(current, manifest.files);
        if (imageIds.has(current.id)) throw new BackupError('invalid', 'duplicate image ID');
      } catch (error) { log.record(relative, 'invalid', error instanceof Error ? error.message : 'image'); continue; }
      if (!usable.has(current.path)) { log.record(relative, 'missing'); continue; }
      imageIds.add(current.id);
      const image: LocalImage = {
        id: current.id, relatedId: current.relatedId, relatedType: current.relatedType, createdAt: current.createdAt,
        mimeType: current.mimeType, blob: new Blob([new Uint8Array(files[current.path]).buffer], { type: current.mimeType }),
        isSynced: false, ...(current.contentId ? { contentId: current.contentId } : {}),
      };
      if (entry.rotationSource != null) {
        try {
          validateBackupImage(entry, manifest.files);
          const source = entry.rotationSource;
          if (usable.has(source.path)) image.rotationSource = { quarterTurns: source.quarterTurns,
            blob: new Blob([new Uint8Array(files[source.path]).buffer], { type: source.mimeType }) };
          else log.record(source.path.slice(ROOT.length), 'missing');
        } catch { log.record(`${relative}#rotationSource`, 'invalid'); }
      }
      images.push(image);
    }
    // Image/file entries above define the archive's promised contents. Keep
    // dangling source references unchanged without inventing a missing ZIP file.
    return { tables, images, preferences, databaseVersion: manifest.databaseVersion, createdAt: manifest.createdAt, issues: log.all() };
  } catch (error) {
    if (error instanceof BackupError && error.code !== 'invalid') throw error;
    throw new BackupError('invalid', location.slice(0, 240));
  }
}
