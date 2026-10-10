import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backupSessionPhotos, restoreSessionPhotos } from './googleDrivePhotos';
import { googleDriveClient } from './googleDriveClient';
import { imageService } from '../imageService';

vi.mock('./googleDriveClient', () => ({
    googleDriveClient: {
        uploadFileToFolder: vi.fn(), fetchAllItems: vi.fn(),
        trashFile: vi.fn(), downloadBlob: vi.fn()
    }
}));
vi.mock('../imageService', () => ({
    imageService: { getImage: vi.fn(), saveImage: vi.fn() }
}));

describe('cloud photo transfer contracts', () => {
    beforeEach(() => vi.resetAllMocks());

    it('reuses known IDs, uploads missing photos and cleans only orphan photos before returning the map', async () => {
        const blob = new Blob(['photo'], { type: 'image/png' });
        vi.mocked(imageService.getImage).mockImplementation(async id => (
            id === 'new' ? { blob, mimeType: 'image/png' } as any : undefined
        ));
        vi.mocked(googleDriveClient.uploadFileToFolder).mockResolvedValue({ id: 'new-cloud' } as any);
        vi.mocked(googleDriveClient.fetchAllItems).mockResolvedValue([
            { id: 'known-cloud', name: 'known.jpg' },
            { id: 'new-cloud', name: 'new.jpg' },
            { id: 'healed-cloud', name: 'healed.jpg' },
            { id: 'orphan-cloud', name: 'orphan.jpg' },
            ...['session.json', 'data.json', 'background.jpg', 'notes.txt'].map(name => ({ id: name, name }))
        ] as any);
        const existing = { known: 'known-cloud', orphan: 'orphan-cloud' };
        const result = await backupSessionPhotos('folder', ['known', 'new', 'healed'], existing);
        expect(imageService.getImage).not.toHaveBeenCalledWith('known');
        expect(googleDriveClient.uploadFileToFolder).toHaveBeenCalledWith('folder', 'new.jpg', 'image/png', blob);
        expect(googleDriveClient.uploadFileToFolder).toHaveBeenCalledTimes(1);
        expect(googleDriveClient.fetchAllItems).toHaveBeenCalledTimes(1);
        expect(vi.mocked(googleDriveClient.trashFile).mock.calls).toEqual([['orphan-cloud']]);
        expect(result).toEqual({ known: 'known-cloud', new: 'new-cloud', healed: 'healed-cloud' });
        expect(existing).toEqual({ known: 'known-cloud', orphan: 'orphan-cloud' });
    });

    it('still removes stale photos when the saved photo list is empty', async () => {
        vi.mocked(googleDriveClient.fetchAllItems).mockResolvedValue([
            { id: 'old-cloud', name: 'old.jpg' }, { id: 'board', name: 'background.jpg' }
        ] as any);
        expect(await backupSessionPhotos('folder', [], { old: 'old-cloud' })).toEqual({});
        expect(imageService.getImage).not.toHaveBeenCalled();
        expect(googleDriveClient.uploadFileToFolder).not.toHaveBeenCalled();
        expect(vi.mocked(googleDriveClient.trashFile).mock.calls).toEqual([['old-cloud']]);
    });

    it('hydrates only absent photos by cloud ID and preserves local UUIDs without a folder search', async () => {
        vi.mocked(imageService.getImage).mockImplementation(async id => (
            id === 'local' ? { id } as any : undefined
        ));
        const blob = new Blob(['download']);
        vi.mocked(googleDriveClient.downloadBlob).mockResolvedValue(blob);
        await restoreSessionPhotos(['local', 'missing'], { local: 'local-cloud', missing: 'missing-cloud' }, 'session-id');
        expect(vi.mocked(googleDriveClient.downloadBlob).mock.calls).toEqual([['missing-cloud']]);
        expect(vi.mocked(imageService.saveImage).mock.calls).toEqual([[blob, 'session-id', 'session', 'missing']]);
        expect(googleDriveClient.fetchAllItems).not.toHaveBeenCalled();
        vi.clearAllMocks();
        await restoreSessionPhotos(['missing'], undefined, 'session-id');
        expect(imageService.getImage).not.toHaveBeenCalled();
        expect(googleDriveClient.downloadBlob).not.toHaveBeenCalled();
    });

    it('uploads an edited blob under a new version, then reuses that version without rereading any image', async () => {
        const blob = new Blob(['real rotated pixels'], { type: 'image/jpeg' });
        vi.mocked(imageService.getImage).mockResolvedValue({ blob, mimeType: blob.type, contentId: 'v2' } as any);
        vi.mocked(googleDriveClient.uploadFileToFolder).mockResolvedValue({ id: 'new-cloud' } as any);
        vi.mocked(googleDriveClient.fetchAllItems).mockResolvedValue([
            { id: 'old-cloud', name: 'photo.jpg' },
            { id: 'new-cloud', name: 'photo_v2.jpg' },
        ] as any);
        const map = await backupSessionPhotos('folder', ['photo'], { photo: 'old-cloud' }, { photo: 'v2' });
        expect(map).toEqual({ 'photo@v2': 'new-cloud' });
        expect(googleDriveClient.uploadFileToFolder).toHaveBeenCalledExactlyOnceWith('folder', 'photo_v2.jpg', blob.type, blob);
        expect(googleDriveClient.trashFile).not.toHaveBeenCalled(); // session.json has not confirmed v2 yet.
        vi.mocked(imageService.getImage).mockClear();
        vi.mocked(googleDriveClient.uploadFileToFolder).mockClear();
        expect(await backupSessionPhotos('folder', ['photo'], map, { photo: 'v2' })).toEqual(map);
        expect(imageService.getImage).not.toHaveBeenCalled();
        expect(googleDriveClient.uploadFileToFolder).not.toHaveBeenCalled();
        expect(googleDriveClient.trashFile).toHaveBeenCalledExactlyOnceWith('old-cloud');
    });

    it('keeps the last good cloud photo and aborts replacement if uploading an edited version fails', async () => {
        vi.mocked(imageService.getImage).mockResolvedValue({ blob: new Blob(['rotated']), contentId: 'v2' } as any);
        vi.mocked(googleDriveClient.uploadFileToFolder).mockRejectedValue(new Error('Offline'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(backupSessionPhotos('folder', ['photo'], { photo: 'old-cloud' }, { photo: 'v2' })).rejects.toThrow('Offline');
        expect(googleDriveClient.fetchAllItems).not.toHaveBeenCalled();
        expect(googleDriveClient.trashFile).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('replaces an older local blob when restoring an edited cloud version, without changing the photo ID', async () => {
        vi.mocked(imageService.getImage).mockResolvedValue({ id: 'photo', contentId: 'v1' } as any);
        const blob = new Blob(['rotated cloud image']);
        vi.mocked(googleDriveClient.downloadBlob).mockResolvedValue(blob);
        await restoreSessionPhotos(['photo'], { 'photo@v2': 'new-cloud' }, 'record', { photo: 'v2' });
        expect(googleDriveClient.downloadBlob).toHaveBeenCalledExactlyOnceWith('new-cloud');
        expect(imageService.saveImage).toHaveBeenCalledExactlyOnceWith(blob, 'record', 'session', 'photo', 'v2');
        vi.mocked(imageService.getImage).mockResolvedValue({ id: 'photo', contentId: 'v2' } as any);
        vi.mocked(googleDriveClient.downloadBlob).mockClear();
        await restoreSessionPhotos(['photo'], { 'photo@v2': 'new-cloud' }, 'record', { photo: 'v2' });
        expect(googleDriveClient.downloadBlob).not.toHaveBeenCalled();
    });
});
