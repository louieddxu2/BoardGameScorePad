import type { Zippable } from 'fflate';
import { db } from '../../db';
import { extractSessionContextWeights } from '../systemBackupMerge';
import {
  ROOT, MANIFEST, DATA_TABLES, PREFERENCE_KEYS, BackupError, jsonBytes, folderName, digest,
  readBlob, pack, type Manifest, type Progress, type BackupTables, type Preferences, type Row,
} from './format';

export async function exportOfflineBackup(onProgress: Progress = () => {}): Promise<Blob> {
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
  const manifest: Manifest = {
    format: 'BoardGameScorePad', version: 1, databaseVersion: db.verno, createdAt: Date.now(),
    tables: {} as Manifest['tables'], images: [], preferences, files: {},
  };
  const archive: Zippable = Object.create(null);
  for (const folder of ['_Templates', '_History', '_Active', '_System']) {
    archive[`${ROOT}${folder}/`] = new Uint8Array();
  }
  const imageById = new Map(snapshot.images.map(image => [image.id, image]));
  const imagePaths = new Map<string, string>();
  const imageBytes = new Map<string, Uint8Array>();
  const add = async (path: string, bytes: Uint8Array, photo = false) => {
    if (Object.prototype.hasOwnProperty.call(archive, path)) return;
    onProgress(path.slice(ROOT.length));
    archive[path] = [bytes, { level: photo ? 0 : 6 }];
    manifest.files[path] = { size: bytes.length, sha256: await digest(bytes) };
  };
  const addImage = async (id: string, path: string, contentId?: string) => {
    const image = imageById.get(id);
    if (!image?.blob || (contentId && image.contentId !== contentId)) throw new BackupError('missing_image', id);
    let bytes = imageBytes.get(id);
    if (!bytes) {
      bytes = await readBlob(image.blob);
      imageBytes.set(id, bytes);
    }
    await add(path, bytes, true);
    if (!imagePaths.has(id)) imagePaths.set(id, path);
  };
  const addTemplateImage = async (template: Row, folder: string) => {
    if (typeof template.imageId === 'string' && !imagePaths.has(template.imageId)) {
      await addImage(template.imageId, `${folder}/${encodeURIComponent(template.imageId)}.jpg`);
    }
  };
  for (const table of DATA_TABLES) {
    manifest.tables[table] = [];
    if (!['templates', 'sessions', 'history'].includes(table)) {
      const path = `${ROOT}_System/tables/${table}.json`;
      await add(path, jsonBytes(snapshot.tables[table]));
      manifest.tables[table].push(path);
      continue;
    }
    for (const row of snapshot.tables[table]) {
      const area = table === 'templates' ? '_Templates' : table === 'sessions' ? '_Active' : '_History';
      const name = String(table === 'history' ? row.gameName : row.name);
      const folder = `${ROOT}${area}/${folderName(name, String(row.id))}`;
      const path = `${folder}/${table === 'templates' ? 'data.json' : 'session.json'}`;
      await add(path, jsonBytes(row));
      manifest.tables[table].push(path);
      if (table === 'templates') await addTemplateImage(row, folder);
      else {
        for (const id of row.photos as string[] || []) {
          const revision = (row.photoContentIds as Record<string, string> | undefined)?.[id];
          await addImage(id, `${folder}/${encodeURIComponent(revision ? `${id}_${revision}` : id)}.jpg`, revision);
        }
        if (table === 'history' && row.snapshotTemplate) await addTemplateImage(row.snapshotTemplate as Row, folder);
      }
    }
  }
  for (const image of snapshot.images) {
    if (image.relatedType === 'template' && snapshot.builtinIds.has(image.relatedId) && !imagePaths.has(image.id)) continue;
    if (!imagePaths.has(image.id)) await addImage(image.id, `${ROOT}_System/Images/${encodeURIComponent(image.id)}.jpg`);
    const { blob: _blob, cloudId: _cloudId, isSynced: _synced, rotationSource, ...meta } = image;
    let source: Manifest['images'][number]['rotationSource'];
    if (rotationSource) {
      const path = `${ROOT}_System/Images/${encodeURIComponent(image.id)}_original.jpg`;
      await add(path, await readBlob(rotationSource.blob), true);
      source = { path, mimeType: rotationSource.blob.type || image.mimeType, quarterTurns: rotationSource.quarterTurns };
    }
    manifest.images.push({ ...meta, path: imagePaths.get(image.id)!, ...(source ? { rotationSource: source } : {}) });
  }
  // Same settings document shape as Google Drive; additional local tables remain readable beside it.
  const { tables } = snapshot;
  await add(`${ROOT}_System/settings_backup.json`, jsonBytes({
    preferences: {
      theme: preferences.app_theme_mode, pinnedIds: JSON.parse(preferences.sm_pinned_ids || '[]'),
      newBadgeIds: JSON.parse(preferences.sm_new_badge_ids || '[]'),
      zoomLevel: Number(preferences.app_zoom_level || 1), isEditMode: preferences.app_edit_mode !== 'false',
    },
    library: { players: tables.savedPlayers, locations: tables.savedLocations },
    system: { bggGames: tables.bggGames, templatePrefs: tables.templatePrefs,
      sessionContextWeights: extractSessionContextWeights(tables.weights as unknown as Parameters<typeof extractSessionContextWeights>[0]) },
    timestamp: manifest.createdAt,
  }));
  archive[MANIFEST] = jsonBytes(manifest);
  onProgress('ZIP');
  const bytes = await pack(archive);
  return new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' });
}
