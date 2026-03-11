/**
 * Test script to debug the Skip Logic in useGoogleDrive's performFullBackup
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoogleDrive } from './useGoogleDrive';
import { googleDriveService } from '../services/googleDrive';
import { db } from '../db';

// Mock dependencies
vi.mock('../db', () => ({
    db: {
        history: { update: vi.fn() },
        sessions: { update: vi.fn() }
    }
}));

vi.mock('../services/googleDrive', () => ({
    getAutoConnectPreference: vi.fn(() => true),
    setAutoConnectPreference: vi.fn(),
    googleDriveService: {
        isAuthorized: true,
        ensureAppStructure: vi.fn().mockResolvedValue(undefined),
        templatesFolderId: 'templatesFolderId',
        historyFolderId: 'historyFolderId',
        activeFolderId: 'activeFolderId',
        systemFolderId: 'systemFolderId',
        
        listFoldersInParent: vi.fn(),
        backupTemplate: vi.fn(),
        backupHistoryRecord: vi.fn(),
        backupActiveSession: vi.fn(),
        softDeleteFolder: vi.fn()
    }
}));

vi.mock('../services/systemSyncService', () => ({
    systemSyncService: {
        mergeAndBackupSystemSettings: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('./useToast', () => ({
    useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('../i18n/cloud', () => ({
    useCloudTranslation: () => ({ t: (key: string) => key })
}));

describe('useGoogleDrive Skip Logic Debug', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should UPLOAD if local has missing timestamp, treating it as new/untracked (idempotency fix)', async () => {
        const { result } = renderHook(() => useGoogleDrive());
        
        // Mock a cloud item that exists and has a timestamp
        (googleDriveService.listFoldersInParent as any).mockImplementation((parentId: string) => {
             if (parentId === 'templatesFolderId') {
                 return Promise.resolve([ { id: 'cloud_t1', name: 'Test_t1', appProperties: { originalUpdatedAt: '2000' } } ]);
             }
             return Promise.resolve([]);
        });
        
        (googleDriveService.backupTemplate as any).mockResolvedValue({ id: 't1' });

        // Local item has NO updatedAt defined
        const localTemplates = [{ id: 't1', name: 'Test', updatedAt: undefined, structureHash: 'x', columns: [{ id: 'c1' }], options: [] }] as any;
        
        const onErrorSpy = vi.fn();
        const onProgressSpy = vi.fn();
        
        await act(async () => {
            const res = await result.current.performFullBackup(
                async () => ({ data: { templates: localTemplates, history: [], sessions: [], overrides: [] } }),
                onProgressSpy, onErrorSpy
            );
        });

        if (onErrorSpy.mock.calls.length > 0) {
            console.error("onError called with:", onErrorSpy.mock.calls[0]);
        }
        console.error("onProgress called times:", onProgressSpy.mock.calls.length);

        // It should NOT skip uploading this template because local lacks a timestamp
        expect(googleDriveService.backupTemplate).toHaveBeenCalled();
    });

    it('should SKIP upload if template is disposable (has no columns/images)', async () => {
        const { result } = renderHook(() => useGoogleDrive());
        
        (googleDriveService.listFoldersInParent as any).mockResolvedValue([]);
        (googleDriveService.backupTemplate as any).mockResolvedValue({ id: 't1' });

        // Local item is disposable (no columns)
        const localTemplates = [{ id: 't1', name: 'Test', updatedAt: undefined, structureHash: 'x', columns: [], options: [] }] as any;
        
        await act(async () => {
            await result.current.performFullBackup(
                async () => ({ data: { templates: localTemplates, history: [], sessions: [], overrides: [] } }),
                () => {}, () => {}
            );
        });

        // The disposable protection should directly skip it
        expect(googleDriveService.backupTemplate).not.toHaveBeenCalled();
    });

    it('should SKIP upload if local timestamp is <= cloud timestamp', async () => {
         const { result } = renderHook(() => useGoogleDrive());
        
        (googleDriveService.listFoldersInParent as any).mockImplementation((parentId: string) => {
             if (parentId === 'historyFolderId') {
                 return Promise.resolve([ { id: 'cloud_h1', name: 'Hist_h1', appProperties: { originalUpdatedAt: '5000' } } ]);
             }
             return Promise.resolve([]);
        });
        
        // Mock returning photoCloudIds
        (googleDriveService.backupHistoryRecord as any).mockResolvedValue({
             folderId: 'f1', updatedRecord: { id: 'h1', photoCloudIds: { 'p1': 'cloud_p1' } }
        });

        const localHistory = [{ id: 'h1', gameName: 'Hist', updatedAt: 5000, endTime: 4000 }] as any;
        
        let processedCount = 0;
        await act(async () => {
            await result.current.performFullBackup(
                async () => ({ data: { templates: [], history: localHistory, sessions: [], overrides: [] } }),
                (c: number, total: number) => { processedCount++; }, 
                () => {}
            );
        });

        // Wait... processItem is always called, but it passes `isUpToDate` as true to it, which causes processItem to instantly return.
        // So the actual googleDriveService method should NOT be called.
        expect(googleDriveService.backupHistoryRecord).not.toHaveBeenCalled();
    });

    it('should upload and then update local DB with photo IDs if successful', async () => {
         const { result } = renderHook(() => useGoogleDrive());
        
        (googleDriveService.listFoldersInParent as any).mockResolvedValue([]);
        
        (googleDriveService.backupHistoryRecord as any).mockResolvedValue({
             folderId: 'f1', updatedRecord: { id: 'h1', photoCloudIds: { 'p1': 'cloud_p1' } }
        });

        // Local timestamp is newer than nothing
        const localHistory = [{ id: 'h1', gameName: 'Hist', updatedAt: 6000, endTime: 4000 }] as any;
        
        await act(async () => {
            await result.current.performFullBackup(
                async () => ({ data: { templates: [], history: localHistory, sessions: [], overrides: [] } }),
                () => {}, () => {}
            );
        });

        expect(googleDriveService.backupHistoryRecord).toHaveBeenCalled();
        expect(db.history.update).toHaveBeenCalledWith('h1', { photoCloudIds: { 'p1': 'cloud_p1' }});
    });
});
