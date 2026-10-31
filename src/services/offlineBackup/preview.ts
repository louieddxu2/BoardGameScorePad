import { db } from '../../db';
import type { ValidatedBackup } from './validate';

/** The counts a user needs to judge whether a backup is the one to restore. */
export interface BackupSummary {
  templates: number;
  history: number;
  sessions: number;
  images: number;
}

export const summarizeBackup = (backup: ValidatedBackup): BackupSummary => ({
  templates: backup.tables.templates.length, history: backup.tables.history.length,
  sessions: backup.tables.sessions.length, images: backup.images.length,
});

/** Same scope as a backup: built-in scoreboards and their images are excluded. */
export async function summarizeDevice(): Promise<BackupSummary> {
  const builtinIds = new Set(await db.builtins.toCollection().primaryKeys());
  const [templates, history, sessions, images] = await Promise.all([
    db.templates.count(), db.history.count(), db.sessions.count(),
    db.images.filter(image => !(image.relatedType === 'template' && builtinIds.has(image.relatedId))).count(),
  ]);
  return { templates, history, sessions, images };
}
