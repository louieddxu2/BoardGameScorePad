import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import type { GameSession, HistoryRecord } from '../types';
import { googleDriveService } from '../services/googleDrive';
import { backupActiveSessionToCloud, backupHistoryRecordToCloud } from './sessionCloudBackup';

vi.mock('../db', () => ({ db: {
    sessions: { get: vi.fn(), update: vi.fn() }, history: { get: vi.fn(), update: vi.fn() },
} }));
vi.mock('../services/googleDrive', () => ({ googleDriveService: {
    createActiveSessionFolder: vi.fn(), backupActiveSession: vi.fn(), backupHistoryRecord: vi.fn(), moveSessionToHistory: vi.fn(),
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
