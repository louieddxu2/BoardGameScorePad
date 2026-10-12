import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession, HistoryRecord } from '../../types';
import { db } from '../../db';
import { googleDriveService } from '../googleDrive';
import { googleDriveClient } from './googleDriveClient';

vi.mock('../../db', () => ({ db: { sessions: { get: vi.fn() }, history: { get: vi.fn() } } }));
vi.mock('./googleAuth', () => ({ googleAuth: { isAuthorized: true } }));
vi.mock('./googleDriveClient', () => ({ googleDriveClient: {
    uploadFileToFolder: vi.fn(), fetchAllItems: vi.fn(), trashFile: vi.fn(), updateFileMetadata: vi.fn(),
} }));
vi.mock('../imageService', () => ({ imageService: { getImage: vi.fn() } }));

const session: GameSession = {
    id: 'play', templateId: 'template', name: 'Game', startTime: 1, lastUpdatedAt: 1,
    status: 'active', players: [], photos: ['photo'],
    photoContentIds: { photo: 'v1' }, photoCloudIds: { 'photo@v1': 'cloud-v1' },
};
const history: HistoryRecord = {
    ...session, gameName: 'Game', endTime: 1, updatedAt: 1,
    winnerIds: [],
    snapshotTemplate: { id: 'template', name: 'Game', columns: [], createdAt: 1, updatedAt: 1 },
};
const uploadedJson = () => vi.mocked(googleDriveClient.uploadFileToFolder).mock.calls
    .filter(call => call[1] === 'session.json').map(call => JSON.parse(call[3] as string));

describe('whole-record cloud backup ordering', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        googleDriveService.activeFolderId = 'active';
        googleDriveService.historyFolderId = 'history';
        vi.spyOn(googleDriveService, 'ensureAppStructure').mockResolvedValue();
        vi.mocked(googleDriveClient.fetchAllItems).mockResolvedValue([
            { id: 'cloud-v1', name: 'photo_v1.jpg' }, { id: 'cloud-v2', name: 'photo_v2.jpg' },
        ] as any);
    });
    afterEach(() => vi.restoreAllMocks());

    it.each(['active', 'history'] as const)('serializes %s JSON writes and refreshes a queued stale snapshot only when it starts', async kind => {
        const stale = kind === 'active' ? session : history;
        const latest = { ...stale, lastUpdatedAt: 2, updatedAt: 2,
            photoContentIds: { photo: 'v2' }, photoCloudIds: { 'photo@v2': 'cloud-v2' } };
        const get = vi.mocked(kind === 'active' ? db.sessions.get : db.history.get);
        get.mockResolvedValue(latest);
        let release!: () => void;
        let started!: () => void;
        const blocked = new Promise<void>(resolve => { release = resolve; });
        const uploading = new Promise<void>(resolve => { started = resolve; });
        vi.mocked(googleDriveClient.uploadFileToFolder).mockImplementationOnce(async () => {
            started(); await blocked; return { id: 'json' } as any;
        });
        const backup = (record: typeof stale) => kind === 'active'
            ? googleDriveService.backupActiveSession(record as GameSession, 'Game', 'folder')
            : googleDriveService.backupHistoryRecord(record as HistoryRecord, 'folder');
        const first = backup(latest);
        await uploading;
        const second = backup(stale);
        expect(get).toHaveBeenCalledTimes(1);
        expect(uploadedJson()).toHaveLength(1);
        release();
        await Promise.all([first, second]);
        expect(get).toHaveBeenCalledTimes(2);
        expect(uploadedJson().map(record => record.photoContentIds)).toEqual([{ photo: 'v2' }, { photo: 'v2' }]);
        expect(googleDriveClient.trashFile).not.toHaveBeenCalled();
    });

    it('allows the next backup after a failed JSON commit without deleting the old photos', async () => {
        vi.mocked(db.sessions.get).mockResolvedValue(session);
        vi.mocked(googleDriveClient.uploadFileToFolder).mockRejectedValueOnce(new Error('JSON failed'));
        const first = googleDriveService.backupActiveSession(session, 'Game', 'folder');
        const second = googleDriveService.backupActiveSession(session, 'Game', 'folder');
        await expect(first).rejects.toThrow('JSON failed');
        await second;
        expect(uploadedJson()).toHaveLength(2);
        expect(googleDriveClient.trashFile).not.toHaveBeenCalled();
    });

    it('does not replace a newer supplied record with an older database row', async () => {
        vi.mocked(db.sessions.get).mockResolvedValue(session);
        const latest = { ...session, lastUpdatedAt: 2, photoContentIds: { photo: 'v2' }, photoCloudIds: { 'photo@v2': 'cloud-v2' } };
        await googleDriveService.backupActiveSession(latest, 'Game', 'folder');
        expect(uploadedJson()[0].photoContentIds).toEqual({ photo: 'v2' });
    });
});
