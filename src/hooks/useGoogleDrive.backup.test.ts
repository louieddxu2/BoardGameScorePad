import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession, GameTemplate, HistoryRecord } from '../types';
import { db } from '../db';
import { googleDriveService } from '../services/googleDrive';
import { googleDriveClient } from '../services/cloud/googleDriveClient';
import { googleAuth } from '../services/cloud/googleAuth';
import type { CloudFile } from '../services/cloud/types';
import { useGoogleDrive } from './useGoogleDrive';
import { systemSyncService } from '../services/systemSyncService';

const ui = vi.hoisted(() => ({ showToast: vi.fn(), t: vi.fn() }));
vi.mock('./useToast', () => ({ useToast: () => ({ showToast: ui.showToast }) }));
vi.mock('../i18n/cloud', () => ({ useCloudTranslation: () => ({ t: ui.t }) }));
vi.mock('../db', () => ({ db: {
    history: { get: vi.fn(), update: vi.fn() }, sessions: { get: vi.fn(), update: vi.fn() },
    templates: { update: vi.fn() },
} }));
vi.mock('../services/cloud/googleAuth', () => ({ googleAuth: { isAuthorized: true, fetchUserEmail: vi.fn() } }));
vi.mock('../services/cloud/googleDriveClient', () => ({ googleDriveClient: {
    fetchAllItems: vi.fn(), getFile: vi.fn(), uploadFileToFolder: vi.fn(), updateFileMetadata: vi.fn(),
    findFileByProperty: vi.fn(), moveFile: vi.fn(), trashFile: vi.fn(),
} }));
vi.mock('../services/imageService', () => ({ imageService: { getImage: vi.fn() } }));
vi.mock('../services/systemSyncService', () => ({ systemSyncService: { mergeAndBackupSystemSettings: vi.fn() } }));

const record: HistoryRecord = { id: 'abc12345', templateId: 'template', gameName: 'Game', startTime: 1, endTime: 20,
    updatedAt: 20, players: [], winnerIds: [], photos: [],
    snapshotTemplate: { id: 'template', name: 'Game', createdAt: 1, columns: [] } };
const session: GameSession = { id: record.id, templateId: 'template', name: 'Game', startTime: 1,
    lastUpdatedAt: 20, players: [], status: 'active' };
const makeFolder = (id: string): CloudFile => ({ id, name: `Game_${record.id}`, createdTime: '2026-10-12T00:00:00Z',
    appProperties: { originalUpdatedAt: '10', localUuid: record.id } });

describe('full backup cleanup and result reporting', () => {
    let historyFolder: CloudFile;
    let activeFolders: CloudFile[];
    let pendingCleanup: Promise<unknown>[];

    beforeEach(() => {
        vi.resetAllMocks();
        localStorage.clear();
        localStorage.setItem('google_drive_auto_connect', 'true');
        ui.t.mockImplementation(key => key);
        vi.mocked(googleAuth.fetchUserEmail).mockResolvedValue(null);
        Object.assign(googleDriveService, { systemFolderId: 'system', templatesFolderId: 'templates',
            activeFolderId: 'active', historyFolderId: 'history' });
        historyFolder = makeFolder('history-folder');
        activeFolders = [];
        pendingCleanup = [];
        vi.mocked(db.history.get).mockResolvedValue(record);
        vi.mocked(db.sessions.get).mockResolvedValue(session);
        vi.mocked(googleDriveClient.uploadFileToFolder).mockResolvedValue({ id: 'json' } as any);
        vi.mocked(googleDriveClient.findFileByProperty).mockResolvedValue(null);
        vi.mocked(googleDriveClient.fetchAllItems).mockImplementation(async query => {
            if (query.includes(' or ')) return [
                { ...historyFolder, parents: ['history'] },
                ...activeFolders.map(folder => ({ ...folder, parents: ['active'] })),
            ];
            if (query.includes("'history' in parents")) return [historyFolder];
            if (query.includes("'active' in parents") && !query.includes('name contains')) return activeFolders;
            return [];
        });
        vi.spyOn(googleDriveService as any, 'getTrashFolder').mockResolvedValue('trash');
        // Also drain the old fire-and-forget implementation when reproducing the bug.
        const softDelete = googleDriveService.softDeleteFolder.bind(googleDriveService);
        vi.spyOn(googleDriveService, 'softDeleteFolder').mockImplementation((...args) => {
            const task = softDelete(...args);
            pendingCleanup.push(task);
            return task;
        });
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); });

    const backup = async (records: HistoryRecord[] = [record], sessions: GameSession[] = [], templates: GameTemplate[] = []) => {
        const { result } = renderHook(() => useGoogleDrive());
        const onProgress = vi.fn();
        const onError = vi.fn();
        const onItemSuccess = vi.fn();
        let summary!: { success: number; skipped: number; failed: number };
        await act(async () => {
            summary = await result.current.performFullBackup(async () => ({ data: {
                templates, overrides: [], history: records, sessions,
            } }), onProgress, onError, onItemSuccess);
            await Promise.all(pendingCleanup);
        });
        return { summary, onProgress, onError, onItemSuccess };
    };

    it('protects the newly saved history folder even when a stale Active list contains the same ID, without an extra lookup', async () => {
        activeFolders = [historyFolder];
        const { summary } = await backup();
        expect(googleDriveClient.uploadFileToFolder).toHaveBeenCalledWith(historyFolder.id, 'session.json', 'application/json', expect.any(String), null);
        expect(googleDriveClient.moveFile).not.toHaveBeenCalled();
        expect(googleDriveClient.getFile).not.toHaveBeenCalled();
        expect(vi.mocked(googleDriveClient.fetchAllItems).mock.calls.filter(([query]) => query.includes(' or '))).toHaveLength(1);
        expect(summary).toEqual({ success: 2, skipped: 0, failed: 0 });
    });

    it.each(['history', 'trashed'] as const)('keeps a different stale Active folder if it is now %s', async state => {
        activeFolders = [makeFolder('old-folder')];
        vi.mocked(googleDriveClient.getFile).mockResolvedValue({ id: 'old-folder',
            parents: state === 'history' ? ['history'] : ['active'], trashed: state === 'trashed' } as any);
        await backup();
        expect(googleDriveClient.getFile).toHaveBeenCalledExactlyOnceWith('old-folder', expect.stringContaining('parents'));
        expect(googleDriveClient.moveFile).not.toHaveBeenCalled();
    });

    it('still cleans a genuinely distinct Active folder, explicitly removing only its Active parent', async () => {
        activeFolders = [makeFolder('old-folder')];
        vi.mocked(googleDriveClient.getFile).mockResolvedValue({ id: 'old-folder', parents: ['active'] } as any);
        const { summary } = await backup();
        expect(googleDriveClient.moveFile).toHaveBeenCalledExactlyOnceWith('old-folder', 'active', 'trash');
        expect(summary).toEqual({ success: 2, skipped: 0, failed: 0 });
    });

    it('does not clean a folder if its current location cannot be verified', async () => {
        activeFolders = [makeFolder('old-folder')];
        vi.mocked(googleDriveClient.getFile).mockRejectedValue(new Error('Cannot verify location'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { summary } = await backup();
        expect(googleDriveClient.moveFile).not.toHaveBeenCalled();
        expect(summary).toEqual({ success: 2, skipped: 0, failed: 0 });
    });

    it.each(['history', 'session', 'up-to-date'] as const)('counts %s work skipped before or during backup correctly, with completed progress', async kind => {
        if (kind === 'history') vi.mocked(db.history.get).mockResolvedValue(undefined);
        if (kind === 'session') vi.mocked(db.sessions.get).mockResolvedValue(undefined);
        if (kind === 'up-to-date') historyFolder.appProperties!.originalUpdatedAt = String(record.updatedAt);
        const { summary, onProgress, onError } = await backup(kind === 'session' ? [] : [record], kind === 'session' ? [session] : []);
        expect(summary).toEqual({ success: 1, skipped: 1, failed: 0 }); // Only system settings were written.
        expect(onProgress).toHaveBeenLastCalledWith(2, 2);
        expect(onError).not.toHaveBeenCalled();
        expect(googleDriveClient.uploadFileToFolder).not.toHaveBeenCalled();
        expect(googleDriveClient.moveFile).not.toHaveBeenCalled();
    });

    it('continues to count real write errors as failures rather than skips', async () => {
        vi.mocked(googleDriveClient.uploadFileToFolder).mockRejectedValue(new Error('Upload failed'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { summary, onProgress, onError } = await backup();
        expect(summary).toEqual({ success: 1, skipped: 0, failed: 1 });
        expect(onError).toHaveBeenCalledExactlyOnceWith([expect.any(String)]);
        expect(onProgress).toHaveBeenLastCalledWith(2, 2);
        expect(googleDriveClient.moveFile).not.toHaveBeenCalled();
    });

    it('counts a cancelled template as skipped without marking it synced or invoking success', async () => {
        const template: GameTemplate = { ...record.snapshotTemplate, hasImage: true };
        vi.spyOn(googleDriveService, 'backupTemplate').mockResolvedValue(null);
        const { summary, onProgress, onError, onItemSuccess } = await backup([], [], [template]);
        expect(googleDriveService.backupTemplate).toHaveBeenCalledTimes(1);
        expect(summary).toEqual({ success: 1, skipped: 1, failed: 0 });
        expect(db.templates.update).not.toHaveBeenCalled();
        expect(onItemSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onProgress).toHaveBeenLastCalledWith(2, 2);
    });

    it('does not show a success toast when a single template backup is cancelled', async () => {
        vi.spyOn(googleDriveService, 'backupTemplate').mockResolvedValue(null);
        const { result } = renderHook(() => useGoogleDrive());
        await act(async () => {
            expect(await result.current.handleBackup(record.snapshotTemplate)).toBeNull();
        });
        expect(ui.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
        expect(result.current.isSyncing).toBe(false);
    });

    it('counts unchanged system settings as skipped without losing completed progress', async () => {
        vi.mocked(systemSyncService.mergeAndBackupSystemSettings).mockResolvedValue(false);
        const { summary, onProgress, onError } = await backup([], []);
        expect(summary).toEqual({ success: 0, skipped: 1, failed: 0 });
        expect(onProgress).toHaveBeenLastCalledWith(1, 1);
        expect(onError).not.toHaveBeenCalled();
    });
});
