import { db } from '../db';
import type { GameSession, HistoryRecord } from '../types';
import { googleDriveService } from '../services/googleDrive';

/** Background backup only; a cancelled record must not receive cloud IDs. */
export const backupActiveSessionToCloud = async (session: GameSession, name: string): Promise<boolean> => {
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
};

/** Retains the existing Active-to-History folder move for automatic backups. */
export const backupHistoryRecordToCloud = async (
    record: HistoryRecord,
    options: { moveFromActive?: boolean } = {},
): Promise<boolean> => {
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
};
