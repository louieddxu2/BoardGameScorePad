import { strFromU8, strToU8, unzip, zip, Unzip, AsyncUnzipInflate, type Zippable, type FlateError } from 'fflate';
import { BackupError } from './errors';
export { BackupError } from './errors';

export const ROOT = 'BoardGameScorePad/';
export const MANIFEST = `${ROOT}_System/offline_manifest.json`;
export const MAX_BACKUP_FILES = 100000;
export const MAX_BACKUP_BYTES = 2 ** 31;
export const DATA_TABLES = [
  'templates', 'sessions', 'history', 'templatePrefs', 'savedPlayers', 'savedLocations',
  'savedGames', 'bggGames', 'savedWeekdays', 'savedTimeSlots', 'savedPlayerCounts',
  'savedGameModes', 'analyticsLogs', 'weights', 'savedGameLifecycleContexts',
] as const;
export type DataTable = typeof DATA_TABLES[number];
export type Row = Record<string, unknown>;
export type BackupTables = Record<DataTable, Row[]>;
export const PREFERENCE_KEYS = [
  'app_theme_mode', 'app_language', 'app_zoom_level', 'app_edit_mode', 'app_voice_enabled',
  'sm_pinned_ids', 'sm_new_badge_ids', 'sm_pref_standard_unit',
  'sm_pref_product_unit_a', 'sm_pref_product_unit_b', 'sm_pref_editor_adv',
] as const;
export type Preferences = Partial<Record<typeof PREFERENCE_KEYS[number], string>>;
export type Progress = (filename: string) => void;
export type ImageEntry = {
  id: string; relatedId: string; relatedType: 'template' | 'session'; mimeType: string;
  createdAt: number; contentId?: string; path: string;
  rotationSource?: { path: string; mimeType: string; quarterTurns: 1 | 2 | 3 };
};
export interface Manifest {
  format: 'BoardGameScorePad'; version: 1 | 2; databaseVersion: number; createdAt: number;
  tables: Record<DataTable, string[]>; images: ImageEntry[]; preferences: Preferences;
  files: Record<string, { size: number; sha256: string }>;
  missingImageIds?: string[]; // Pre-existing dangling references, not files omitted from this ZIP.
}

export const jsonBytes = (value: unknown) => strToU8(JSON.stringify(value, null, 2));
export const parseJson = (bytes: Uint8Array): unknown => JSON.parse(strFromU8(bytes));
export const isObject = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
export const safePath = (path: string) => path.startsWith(ROOT) && !/[\\\u0000]/.test(path)
  && path.split('/').every(part => !!part && part !== '.' && part !== '..');
// Underscores separate identity/revision components; escape literal underscores
// inside an ID so distinct records or photo revisions cannot share a ZIP path.
export const archiveComponent = (value: string) => encodeURIComponent(value).replace(/_/g, '%5F');
export const folderName = (name: string, id: string) =>
  `${Array.from(name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')).slice(0, 80).join('') || 'Game'}_${archiveComponent(id)}`;

export function readBlob(blob: Blob): Promise<Uint8Array> {
  if (blob.arrayBuffer) return blob.arrayBuffer().then(buffer => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

export async function digest(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new BackupError('unsupported');
  const result = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, '0')).join('');
}

// Photos are already compressed. Store them verbatim and compress only JSON.
export const pack = (files: Zippable) => new Promise<Uint8Array>((resolve, reject) => {
  zip(files, { level: 6 }, (error, bytes) => error ? reject(error) : resolve(bytes));
});

export function unpack(bytes: Uint8Array, onDamagedFile?: (path: string) => void): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let totalSize = 0;
    let invalid = false;
    let completed = false;
    const names = new Set<string>();
    unzip(bytes, { filter(file) {
      if (file.name.endsWith('/')) return false;
      totalSize += file.originalSize;
      if (!safePath(file.name) || names.has(file.name) || names.size >= MAX_BACKUP_FILES || totalSize > MAX_BACKUP_BYTES) invalid = true;
      names.add(file.name);
      return !invalid;
    } }, (error, files) => {
      if (completed) return;
      completed = true;
      if (invalid) reject(new BackupError('invalid'));
      else if (error && onDamagedFile) recoverZip(bytes, onDamagedFile).then(resolve, reject);
      else if (error) reject(new BackupError('invalid'));
      else resolve(files);
    });
  });
}

// Keep the normal unzip path fast. Only a damaged compressed entry needs this
// per-file decoder, so one bad DEFLATE stream does not hide healthy neighbours.
class RecoverableInflate extends AsyncUnzipInflate {
  push(chunk: Uint8Array, final: boolean) {
    try { super.push(chunk, final); }
    catch (error) { this.ondata(error as FlateError, new Uint8Array(), true); }
  }
}

function recoverZip(bytes: Uint8Array, onDamagedFile: (path: string) => void): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    const files: Record<string, Uint8Array> = Object.create(null);
    const names = new Set<string>();
    const terminations: (() => void)[] = [];
    let pending = 0;
    let scanned = false;
    let failed = false;
    let declaredBytes = 0;
    let actualBytes = 0;
    const finish = () => { if (scanned && !pending && !failed) resolve(files); };
    const fail = () => { failed = true; terminations.forEach(stop => stop()); reject(new BackupError('invalid')); };
    const stream = new Unzip(file => {
      if (file.name.endsWith('/')) return;
      if (!safePath(file.name) || names.has(file.name) || names.size >= MAX_BACKUP_FILES) { fail(); return; }
      names.add(file.name);
      declaredBytes += file.originalSize || 0;
      if (declaredBytes > MAX_BACKUP_BYTES) { fail(); return; }
      if (file.compression !== 0 && file.compression !== 8) { onDamagedFile(file.name); return; }
      pending++;
      let done = false;
      const chunks: Uint8Array[] = [];
      let size = 0;
      terminations.push(() => file.terminate());
      file.ondata = (error, data, final) => {
        if (failed || done) return;
        if (error) {
          done = true; pending--; onDamagedFile(file.name); file.terminate(); finish(); return;
        }
        actualBytes += data.length;
        if (actualBytes > MAX_BACKUP_BYTES) { fail(); return; }
        chunks.push(data); size += data.length;
        if (final) {
          const result = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
          files[file.name] = result;
          done = true; pending--; finish();
        }
      };
      file.start();
    });
    stream.register(RecoverableInflate);
    try {
      for (let offset = 0; offset < bytes.length && !failed; offset += 65536) {
        stream.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length);
      }
      scanned = true;
      finish();
    } catch { fail(); }
  });
}
