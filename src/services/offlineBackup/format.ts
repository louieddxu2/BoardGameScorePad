import { strFromU8, strToU8, unzip, zip, type Zippable } from 'fflate';
import { BackupError } from './errors';
export { BackupError } from './errors';

export const ROOT = 'BoardGameScorePad/';
export const MANIFEST = `${ROOT}_System/offline_manifest.json`;
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
  'sm_pinned_ids', 'sm_new_badge_ids', 'sm_pref_advance_direction', 'sm_pref_standard_unit',
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
  format: 'BoardGameScorePad'; version: 1; databaseVersion: number; createdAt: number;
  tables: Record<DataTable, string[]>; images: ImageEntry[]; preferences: Preferences;
  files: Record<string, { size: number; sha256: string }>;
}

export const jsonBytes = (value: unknown) => strToU8(JSON.stringify(value, null, 2));
export const parseJson = (bytes: Uint8Array): unknown => JSON.parse(strFromU8(bytes));
export const isObject = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
export const safePath = (path: string) => path.startsWith(ROOT) && !/[\\\u0000]/.test(path)
  && path.split('/').every(part => !!part && part !== '.' && part !== '..');
export const folderName = (name: string, id: string) =>
  `${Array.from(name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')).slice(0, 80).join('') || 'Game'}_${encodeURIComponent(id)}`;

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

export function unpack(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let totalSize = 0;
    let invalid = false;
    const names = new Set<string>();
    unzip(bytes, { filter(file) {
      if (file.name.endsWith('/')) return false;
      totalSize += file.originalSize;
      if (!safePath(file.name) || names.has(file.name) || names.size >= 100000 || totalSize > 2 ** 31) invalid = true;
      names.add(file.name);
      return !invalid;
    } }, (error, files) => error || invalid ? reject(new BackupError('invalid')) : resolve(files));
  });
}
