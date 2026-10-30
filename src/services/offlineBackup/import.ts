import { db } from '../../db';
import { DATA_TABLES, PREFERENCE_KEYS, BackupError, type Preferences, type Row, type Progress } from './format';
import { validateOfflineBackup } from './validate';
import type { OfflineBackupReport } from '../../types';

// Device/room identities, cached links and pending network deliveries are never portable.
const TRANSIENT_TABLES = [
  'savedCurrentSession', 'templateShareCache', 'multiplayerRooms', 'multiplayerDevices',
  'multiplayerSequences', 'multiplayerOutbox', 'multiplayerPatchReceipts', 'multiplayerParticipantBindings',
];

function detachCloud(row: Row): Row {
  const { cloudFolderId: _folder, photoCloudIds: _photos, cloudImageId: _image, lastSyncedAt: _synced, ...rest } = row;
  if (rest.snapshotTemplate && typeof rest.snapshotTemplate === 'object' && !Array.isArray(rest.snapshotTemplate)) {
    rest.snapshotTemplate = detachCloud(rest.snapshotTemplate as Row);
  }
  return rest;
}

/** Full replacement, deliberately separate from the cloud restore/merge operation. */
export async function importOfflineBackup(blob: Blob, onProgress: Progress = () => {}): Promise<OfflineBackupReport> {
  const backup = await validateOfflineBackup(blob, onProgress);
  const report: OfflineBackupReport = { id: 'latest', createdAt: Date.now(), issues: backup.issues };
  if (backup.databaseVersion > db.verno) throw new BackupError('unsupported');
  const previous: Preferences = {};
  for (const key of PREFERENCE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) previous[key] = value;
  }
  let preferencesTouched = false;
  try {
    onProgress('');
    await db.transaction('rw', [
      ...DATA_TABLES.map(name => db.table(name)), ...TRANSIENT_TABLES.map(name => db.table(name)), db.images, db.builtins, db.backupReports,
    ], async () => {
      if (await db.multiplayerRooms.filter(room => room.status !== 'completed').count()) throw new BackupError('busy');
      const builtinIds = new Set(await db.builtins.toCollection().primaryKeys());
      backup.tables.templates = backup.tables.templates.filter(row => {
        if (!builtinIds.has(row.id as string)) return true;
        report.issues.push({ path: `templates:${row.id}`, reason: 'invalid', detail: 'built-in ID collision' });
        return false;
      });
      const builtinImages = await db.images.filter(image => image.relatedType === 'template' && builtinIds.has(image.relatedId)).toArray();
      const builtinImageIds = new Set(builtinImages.map(image => image.id));
      // Preserve sessions whose original template was removed too: activation
      // already supplies a virtual template for them (loadSessionActivation).
      // An exception (including quota, unique-index or preference-storage failures)
      // aborts all table clears and puts together, preserving the previous database.
      for (const name of [...DATA_TABLES, ...TRANSIENT_TABLES, 'images']) {
        await db.table(name).clear();
        if (DATA_TABLES.includes(name as typeof DATA_TABLES[number])) {
          await db.table(name).bulkAdd(backup.tables[name as typeof DATA_TABLES[number]].map(detachCloud));
        } else if (name === 'images') await db.images.bulkAdd([
          ...backup.images.filter(image => !builtinImageIds.has(image.id)), ...builtinImages,
        ]);
      }
      preferencesTouched = true;
      for (const key of PREFERENCE_KEYS) {
        const value = backup.preferences[key];
        if (value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      await db.backupReports.put(report);
    });
  } catch (error) {
    if (preferencesTouched) {
      for (const key of PREFERENCE_KEYS) {
        try {
          const value = previous[key];
          if (value === undefined) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch { /* IndexedDB still rolls back when preference storage is unavailable. */ }
      }
    }
    throw error;
  }
  return report;
}
