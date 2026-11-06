import { db } from '../db';
import type { GameSession, GameTemplate, HistoryRecord } from '../types';
import { googleDriveService } from '../services/googleDrive';
import { BackupInProgressError, withBackupAccess } from '../services/backupAccess';

async function runBackgroundBackup(task: () => Promise<boolean>): Promise<boolean> {
    try {
        return await withBackupAccess('drive', task);
    } catch (error) {
        if (error instanceof BackupInProgressError) return false;
        throw error;
    }
}

export const backupTemplateToCloud = (template: GameTemplate): Promise<boolean> => runBackgroundBackup(async () => {
    const updated = await googleDriveService.backupTemplate(template);
    if (!updated) return false;
    await db.templates.update(updated.id, { lastSyncedAt: updated.updatedAt || Date.now() });
    return true;
});

/** Background backup only; a cancelled record must not receive cloud IDs. */
export const backupActiveSessionToCloud = (session: GameSession, name: string): Promise<boolean> => runBackgroundBackup(async () => {
    let folderId = session.cloudFolderId;
    if (!folderId) {
        if ((await db.sessions.get(session.id))?.status !== 'active') return false;
        folderId = await googleDriveService.createActiveSessionFolder(name, session.id);
        await db.sessions.update(session.id, { cloudFolderId: folderId });
    }
    const backup = await googleDriveService.backupActiveSession(session, name, folderId);
    if (!backup) return false;
    if (backup.updatedSession.photoCloudIds && Object.keys(backup.updatedSession.photoCloudIds).length > 0) {
        await db.sessions.update(session.id, { photoCloudIds: backup.updatedSession.photoCloudIds });
    }
    return true;
});

/** Retains the existing Active-to-History folder move for automatic backups. */
export const backupHistoryRecordToCloud = (
    record: HistoryRecord,
    options: { moveFromActive?: boolean } = {},
): Promise<boolean> => runBackgroundBackup(async () => {
    let folderId = record.cloudFolderId;
    const isNewFolder = !folderId;
    if (!folderId) {
        if (!await db.history.get(record.id)) return false;
        folderId = await googleDriveService.createActiveSessionFolder(record.gameName, record.id);
        await db.history.update(record.id, { cloudFolderId: folderId });
    }
    const backup = await googleDriveService.backupHistoryRecord(record, folderId);
    if (!backup) return false;
    if (backup.updatedRecord.photoCloudIds && Object.keys(backup.updatedRecord.photoCloudIds).length > 0) {
        await db.history.update(record.id, { photoCloudIds: backup.updatedRecord.photoCloudIds });
    }
    if ((isNewFolder || options.moveFromActive) && await db.history.get(record.id)) {
        await googleDriveService.moveSessionToHistory(folderId);
    }
    return true;
});
