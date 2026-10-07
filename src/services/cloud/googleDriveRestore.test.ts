import { beforeEach, describe, expect, it, vi } from 'vitest';
import { googleDriveService } from '../googleDrive';
import { runGoogleDriveRestore, type GoogleDriveRestoreOptions } from './googleDriveRestore';
import type { CloudFile } from './types';

vi.mock('../googleDrive', () => ({
    googleDriveService: {
        templatesFolderId: 'templates', historyFolderId: 'history', activeFolderId: 'active',
        systemFolderId: 'system', ensureAppStructure: vi.fn(), listFoldersInParent: vi.fn(),
        restoreTemplate: vi.fn(), getFileContent: vi.fn()
    }
}));

const file = (id: string): CloudFile => ({
    id, name: `Game_name_${id}`, createdTime: '2026-01-01',
    appProperties: { originalUpdatedAt: '100' }
});
const options = (): GoogleDriveRestoreOptions => ({
    localMeta: { templates: new Map(), history: new Map(), sessions: new Map() },
    ensureConnection: vi.fn().mockResolvedValue(undefined),
    handleError: vi.fn(), setIsSyncing: vi.fn(), onProgress: vi.fn(),
    onError: vi.fn(), onItemRestored: vi.fn().mockResolvedValue(undefined)
});

describe('full cloud restore workflow', () => {
    beforeEach(() => vi.resetAllMocks());

    it('awaits restored-item saves in three-item batches, skips newer local data and never touches active sessions', async () => {
        const pending: Array<() => void> = [];
        const order: string[] = [];
        vi.mocked(googleDriveService.listFoldersInParent).mockImplementation(async parent => (
            parent === 'templates' ? ['t1', 't2', 't3', 't4', 't5'].map(file) : ['h1', 'h2'].map(file)
        ));
        vi.mocked(googleDriveService.restoreTemplate).mockImplementation(async id => ({ id } as any));
        vi.mocked(googleDriveService.getFileContent).mockImplementation(async (id, filename) => {
            order.push(`${id}/${filename}`);
            return { id };
        });
        const args = options();
        args.localMeta.templates.set('t1', 100);
        args.localMeta.history.set('h1', 101);
        args.localMeta.sessions.set('active-local', 1);
        args.onSettingsRestored = vi.fn();
        args.onItemRestored = vi.fn((type, item) => {
            order.push(`${type}/${item.id}`);
            return type === 'template' ? new Promise<void>(resolve => pending.push(resolve)) : Promise.resolve();
        });
        const restore = runGoogleDriveRestore(args);
        await vi.waitFor(() => expect(googleDriveService.restoreTemplate).toHaveBeenCalledTimes(2));
        expect(args.setIsSyncing).toHaveBeenCalledWith(true);
        expect(order).toEqual(['system/settings_backup.json', 'template/t2', 'template/t3']);
        pending.splice(0).forEach(resolve => resolve());
        await vi.waitFor(() => expect(googleDriveService.restoreTemplate).toHaveBeenCalledTimes(4));
        expect(order).not.toContain('h2/session.json');
        pending.splice(0).forEach(resolve => resolve());
        expect(await restore).toEqual({ success: 6, skipped: 2, failed: 0 });
        expect(vi.mocked(googleDriveService.listFoldersInParent).mock.calls).toEqual([['templates'], ['history']]);
        expect(order.slice(-2)).toEqual(['h2/session.json', 'history/h2']);
        expect(args.onSettingsRestored).toHaveBeenCalledWith({ id: 'system' });
        expect(args.onProgress).toHaveBeenLastCalledWith(8, 8);
        expect(args.onError).not.toHaveBeenCalled();
        expect(vi.mocked(args.setIsSyncing).mock.calls).toEqual([[true], [false]]);
    });

    it('returns control to the existing error handler and clears syncing if authorization fails', async () => {
        const args = options();
        const error = new Error('not authorized');
        vi.mocked(args.ensureConnection).mockRejectedValue(error);
        expect(await runGoogleDriveRestore(args)).toEqual({ success: 0, skipped: 0, failed: 0 });
        expect(args.handleError).toHaveBeenCalledWith(error, 'cloud_action_full_restore_init');
        expect(vi.mocked(args.setIsSyncing).mock.calls).toEqual([[true], [false]]);
        expect(googleDriveService.ensureAppStructure).not.toHaveBeenCalled();
        expect(googleDriveService.listFoldersInParent).not.toHaveBeenCalled();
    });
});
