import { db } from '../../db';
import type { ValidatedBackup } from './validate';

/** Recent game records let a user recognise which backup this is and whether it is older than the device. */
export interface RecordPreview {
  total: number;
  recent: { name: string; endTime: number }[];
}

export function previewBackupRecords(backup: ValidatedBackup, limit = 3): RecordPreview {
  const recent = backup.tables.history
    .filter(row => typeof row.gameName === 'string' && typeof row.endTime === 'number')
    .map(row => ({ name: row.gameName as string, endTime: row.endTime as number }))
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, limit);
  return { total: backup.tables.history.length, recent };
}

export async function previewDeviceRecords(limit = 1): Promise<RecordPreview> {
  const [total, rows] = await Promise.all([
    db.history.count(), db.history.orderBy('endTime').reverse().limit(limit).toArray(),
  ]);
  return { total, recent: rows.map(row => ({ name: row.gameName, endTime: row.endTime })) };
}
