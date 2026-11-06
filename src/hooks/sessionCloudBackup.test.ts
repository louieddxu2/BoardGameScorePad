import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { db } from '../db';
import type { GameSession, HistoryRecord } from '../types';
import { googleDriveService } from '../services/googleDrive';
import { backupActiveSessionToCloud, backupHistoryRecordToCloud, backupTemplateToCloud } from './sessionCloudBackup';
import { BackupInProgressError, withBackupAccess } from '../services/backupAccess';

vi.mock('../db', () => ({ db: {
    sessions: { get: vi.fn(), update: vi.fn() }, history: { get: vi.fn(), update: vi.fn() },
} }));
vi.mock('../services/googleDrive', () => ({ googleDriveService: {
    createActiveSessionFolder: vi.fn(), backupActiveSession: vi.fn(), backupHistoryRecord: vi.fn(), moveSessionToHistory: vi.fn(),
    backupTemplate: vi.fn(),
} }));

const session: GameSession = { id: 'play', templateId: 'template', name: 'Game', startTime: 1, status: 'active', players: [] };
const record: HistoryRecord = { id: 'play', templateId: 'template', gameName: 'Game', startTime: 1, endTime: 2,
    players: [], winnerIds: [], snapshotTemplate: { id: 'template', name: 'Game', createdAt: 1, columns: [] } };

describe('automatic backup cancellation', () => {
    beforeEach(() => vi.resetAllMocks());

    it('still saves photo IDs and moves a successfully backed-up new history folder', async () => {
        vi.mocked(db.history.get).mockResolvedValue(record);
        vi.mocked(googleDriveService.createActiveSessionFolder).mockResolvedValue('new-folder');
        const photoCloudIds = { photo: 'cloud-photo' };
        vi.mocked(googleDriveService.backupHistoryRecord).mockResolvedValue({
            folderId: 'new-folder', updatedRecord: { ...record, photoCloudIds },
        });
        expect(await backupHistoryRecordToCloud(record)).toBe(true);
        expect(googleDriveService.backupHistoryRecord).toHaveBeenCalledExactlyOnceWith(record, 'new-folder');
        expect(db.history.update).toHaveBeenNthCalledWith(1, record.id, { cloudFolderId: 'new-folder' });
        expect(db.history.update).toHaveBeenNthCalledWith(2, record.id, { photoCloudIds });
        expect(googleDriveService.moveSessionToHistory).toHaveBeenCalledExactlyOnceWith('new-folder');
    });

    it('keeps ZIP blocked until a Drive response has finished writing photo IDs', async () => {
        const existing = { ...record, cloudFolderId: 'folder' };
        const zip = vi.fn(async () => {});
        let finishWrite!: (count: number) => void;
        vi.mocked(db.history.update).mockReturnValueOnce(new Dexie.Promise<number>(resolve => { finishWrite = resolve; }));
        vi.mocked(googleDriveService.backupHistoryRecord).mockResolvedValue({
            folderId: 'folder', updatedRecord: { ...existing, photoCloudIds: { photo: 'cloud-photo' } },
        });
        const drive = backupHistoryRecordToCloud(existing);
        try {
            await vi.waitFor(() => expect(db.history.update).toHaveBeenCalled());
            await expect(withBackupAccess('zip', zip)).rejects.toBeInstanceOf(BackupInProgressError);
            expect(zip).not.toHaveBeenCalled();
        } finally {
            finishWrite(1);
            await drive;
        }
        await withBackupAccess('zip', zip);
        expect(zip).toHaveBeenCalledTimes(1);
    });

    it('skips automatic Drive backups during ZIP without queuing them', async () => {
        await withBackupAccess('zip', async () => {
            expect(await backupActiveSessionToCloud(session, 'Game')).toBe(false);
            expect(await backupHistoryRecordToCloud(record)).toBe(false);
            expect(await backupTemplateToCloud(record.snapshotTemplate!)).toBe(false);
        });
        expect(db.sessions.get).not.toHaveBeenCalled();
        expect(db.history.get).not.toHaveBeenCalled();
        expect(googleDriveService.backupTemplate).not.toHaveBeenCalled();
    });

    it.each(['active', 'history'] as const)('does not create folders or apply returned cloud metadata for a retired %s record', async kind => {
        const backup = (folderId?: string) => kind === 'active'
            ? backupActiveSessionToCloud({ ...session, cloudFolderId: folderId }, 'Game')
            : backupHistoryRecordToCloud({ ...record, cloudFolderId: folderId }, { moveFromActive: true });
        // A retired record is skipped before any new folder can be created.
        expect(await backup()).toBe(false);
        expect(googleDriveService.createActiveSessionFolder).not.toHaveBeenCalled();
        // The service can also cancel an existing-folder job while it is running.
        vi.mocked(googleDriveService.backupActiveSession).mockResolvedValue(null);
        vi.mocked(googleDriveService.backupHistoryRecord).mockResolvedValue(null);
        expect(await backup('folder')).toBe(false);
        expect(db.sessions.update).not.toHaveBeenCalled();
        expect(db.history.update).not.toHaveBeenCalled();
        expect(googleDriveService.moveSessionToHistory).not.toHaveBeenCalled();
    });
});
