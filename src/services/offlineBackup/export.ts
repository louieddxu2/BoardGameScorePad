import type { Zippable } from 'fflate';
import { db } from '../../db';
import { extractSessionContextWeights } from '../systemBackupMerge';
import { validateBackupRows, validateBackupPreferences, validateBackupImage } from './contentValidation';
import { createIssueLog } from './recovery';
import {
  ROOT, MANIFEST, DATA_TABLES, PREFERENCE_KEYS, BackupError, jsonBytes, folderName, archiveComponent, digest,
  readBlob, pack, MAX_BACKUP_FILES, MAX_BACKUP_BYTES, type Manifest, type Progress, type BackupTables, type Preferences, type Row,
} from './format';

export async function exportOfflineBackup(
  onProgress: Progress = () => {}, onMissingImages: (ids: readonly string[]) => void = () => {},
): Promise<Blob> {
  onProgress('_System/settings_backup.json');
  // One consistent snapshot; compression and Blob reads happen after the read transaction.
  const snapshot = await db.transaction('r', [...DATA_TABLES.map(name => db.table(name)), db.images, db.builtins], async () => {
    const tables = {} as BackupTables;
    for (const name of DATA_TABLES) tables[name] = await db.table(name).toArray();
    const builtinIds = new Set(await db.builtins.toCollection().primaryKeys());
    tables.templates = tables.templates.filter(row => !builtinIds.has(row.id as string));
    const images = await db.images.toArray();
    return { tables, builtinIds, images };
  });
  const preferences: Preferences = {};
  for (const key of PREFERENCE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) preferences[key] = value;
  }
  const exportLog = createIssueLog();
  try { validateBackupPreferences(preferences); }
  catch { exportLog.record('_System/settings_backup.json#preferences', 'invalid'); }
  const manifest: Manifest = {
    format: 'BoardGameScorePad', version: 2, databaseVersion: db.verno, createdAt: Date.now(),
    tables: {} as Manifest['tables'], images: [], preferences, files: {},
  };
  const archive: Zippable = Object.create(null);
  for (const folder of ['_Templates', '_History', '_Active', '_System']) {
    archive[`${ROOT}${folder}/`] = new Uint8Array();
  }
  const imageById = new Map(snapshot.images.map(image => [image.id, image]));
  const imagePaths = new Map<string, string>();
  const imageBytes = new Map<string, Uint8Array>();
  const missingPaths = new Map<string, Set<string>>();
  let totalBytes = 0;
  let fileCount = 1; // Reserve one entry for the manifest.
  const add = async (path: string, bytes: Uint8Array, photo = false) => {
    if (Object.prototype.hasOwnProperty.call(archive, path)) {
      const existing = (archive[path] as [Uint8Array, unknown])[0];
      if (existing !== bytes && (existing.length !== bytes.length || manifest.files[path].sha256 !== await digest(bytes))) {
        throw new BackupError('invalid', path.slice(ROOT.length));
      }
      return;
    }
    totalBytes += bytes.length;
    if (++fileCount > MAX_BACKUP_FILES || totalBytes > MAX_BACKUP_BYTES) throw new BackupError('unsupported');
    onProgress(path.slice(ROOT.length));
    archive[path] = [bytes, { level: photo ? 0 : 6 }];
    manifest.files[path] = { size: bytes.length, sha256: await digest(bytes) };
  };
  const addImage = async (id: string, path: string) => {
    const image = imageById.get(id);
    if (!image?.blob) {
      const paths = missingPaths.get(id) || new Set<string>();
      paths.add(path.slice(ROOT.length));
      missingPaths.set(id, paths);
      return;
    }
    let bytes = imageBytes.get(id);
    if (!bytes) {
      try { bytes = await readBlob(image.blob); }
      catch { exportLog.record(path.slice(ROOT.length), 'invalid', 'unreadable image'); return; }
      imageBytes.set(id, bytes);
    }
    await add(path, bytes, true);
    if (!imagePaths.has(id)) imagePaths.set(id, path);
  };
  const addTemplateImage = async (template: Row, folder: string) => {
    if (typeof template.imageId === 'string' && template.imageId && !imagePaths.has(template.imageId)) {
      await addImage(template.imageId, `${folder}/${archiveComponent(template.imageId)}.jpg`);
    }
  };
  for (const table of DATA_TABLES) {
    manifest.tables[table] = [];
    if (!['templates', 'sessions', 'history'].includes(table)) {
      const path = `${ROOT}_System/tables/${table}.json`;
      try { validateBackupRows(table, snapshot.tables[table], () => {}); }
      catch (error) { exportLog.record(path.slice(ROOT.length), 'invalid', error instanceof Error ? error.message : 'rows'); }
      await add(path, jsonBytes(snapshot.tables[table]));
      manifest.tables[table].push(path);
      continue;
    }
    for (const row of snapshot.tables[table]) {
      const area = table === 'templates' ? '_Templates' : table === 'sessions' ? '_Active' : '_History';
      const name = String((table === 'history' ? row.gameName : row.name) ?? 'Game');
      const folder = `${ROOT}${area}/${folderName(name, String(row.id))}`;
      const path = `${folder}/${table === 'templates' ? 'data.json' : 'session.json'}`;
      try { validateBackupRows(table, [row], () => {}); }
      catch (error) { exportLog.record(path.slice(ROOT.length), 'invalid', error instanceof Error ? error.message : 'record'); }
      await add(path, jsonBytes(row));
      manifest.tables[table].push(path);
      if (table === 'templates') await addTemplateImage(row, folder);
      else {
        for (const id of Array.isArray(row.photos) ? row.photos.filter((value): value is string => typeof value === 'string') : []) {
          const revision = imageById.get(id)?.contentId ?? (row.photoContentIds as Record<string, string> | undefined)?.[id];
          const filename = archiveComponent(id) + (revision ? `_${archiveComponent(revision)}` : '');
          await addImage(id, `${folder}/${filename}.jpg`);
        }
        if (table === 'history' && row.snapshotTemplate) await addTemplateImage(row.snapshotTemplate as Row, folder);
      }
    }
  }
  for (const image of snapshot.images) {
    if (image.relatedType === 'template' && snapshot.builtinIds.has(image.relatedId) && !imagePaths.has(image.id)) continue;
    if (!image.blob) {
      if (!missingPaths.has(image.id)) missingPaths.set(image.id, new Set([`_System/Images/${archiveComponent(image.id)}.jpg`]));
      continue;
    }
    if (!imagePaths.has(image.id)) await addImage(image.id, `${ROOT}_System/Images/${archiveComponent(image.id)}.jpg`);
    if (!imagePaths.has(image.id)) continue;
    const { blob: _blob, cloudId: _cloudId, isSynced: _synced, rotationSource, ...meta } = image;
    let source: Manifest['images'][number]['rotationSource'];
    if (rotationSource) {
      const path = `${ROOT}_System/Images/${archiveComponent(image.id)}_original.jpg`;
      let bytes: Uint8Array | undefined;
      try { bytes = await readBlob(rotationSource.blob); }
      catch { exportLog.record(path.slice(ROOT.length), 'invalid', 'unreadable original'); }
      if (bytes) {
        await add(path, bytes, true);
        source = { path, mimeType: rotationSource.blob.type || image.mimeType, quarterTurns: rotationSource.quarterTurns };
      }
    }
    const entry = { ...meta, path: imagePaths.get(image.id)!, ...(source ? { rotationSource: source } : {}) };
    try { validateBackupImage(entry, manifest.files); }
    catch { exportLog.record(entry.path.slice(ROOT.length), 'invalid', 'image metadata'); }
    manifest.images.push(entry);
  }
  // Same settings document shape as Google Drive; additional local tables remain readable beside it.
  const { tables } = snapshot;
  const preferenceIds = (value: string | undefined) => {
    try { const ids: unknown = JSON.parse(value || '[]'); return Array.isArray(ids) ? ids : []; }
    catch { return []; }
  };
  await add(`${ROOT}_System/settings_backup.json`, jsonBytes({
    preferences: {
      theme: preferences.app_theme_mode, pinnedIds: preferenceIds(preferences.sm_pinned_ids),
      newBadgeIds: preferenceIds(preferences.sm_new_badge_ids),
      zoomLevel: Number(preferences.app_zoom_level || 1), isEditMode: preferences.app_edit_mode !== 'false',
    },
    library: { players: tables.savedPlayers, locations: tables.savedLocations },
    system: { bggGames: tables.bggGames, templatePrefs: tables.templatePrefs,
      sessionContextWeights: extractSessionContextWeights(tables.weights as unknown as Parameters<typeof extractSessionContextWeights>[0]) },
    timestamp: manifest.createdAt,
  }));
  if (missingPaths.size > 0) {
    manifest.missingImageIds = [...missingPaths.keys()];
    await add(`${ROOT}_System/missing_image_references.json`, jsonBytes({
      description: 'These references have no corresponding file in the local snapshot. Records and existing files are preserved unchanged. No cloud comparison was performed.',
      images: [...missingPaths].map(([id, paths]) => ({ id, references: [...paths] })),
    }));
  }
  if (exportLog.all().length) await add(`${ROOT}_System/export_report.json`, jsonBytes({ issues: exportLog.all() }));
  const manifestBytes = jsonBytes(manifest);
  if (totalBytes + manifestBytes.length > MAX_BACKUP_BYTES) throw new BackupError('unsupported');
  archive[MANIFEST] = manifestBytes;
  onProgress('ZIP');
  const bytes = await pack(archive);
  onMissingImages([...(manifest.missingImageIds || []), ...exportLog.all().map(issue => issue.path)]);
  return new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' });
}
