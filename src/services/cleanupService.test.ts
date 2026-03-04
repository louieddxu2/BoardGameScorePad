import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupService } from './cleanupService';
import { db } from '../db';
import { imageService } from './imageService';
import { googleDriveService } from './googleDrive';

// Mock DB
vi.mock('../db', () => ({
    db: {
        sessions: {
            where: vi.fn(() => ({
                equals: vi.fn(() => ({
                    toArray: vi.fn(async () => [
                        { id: 's1', cloudFolderId: 'c1' },
                        { id: 's2' }
                    ])
                }))
            })),
            bulkDelete: vi.fn()
        },
        templates: { delete: vi.fn() },
        templatePrefs: { delete: vi.fn() },
        templateShareCache: { delete: vi.fn() },
        history: { delete: vi.fn() }, // [NEW] Add history mock to verify it's NOT called
        templateRegistry: {
            templates: null,
            templatePrefs: null,
            templateShareCache: null,
            sessions: 'templateId',
        }
    }
}));

// Mock Services
vi.mock('./imageService', () => ({
    imageService: {
        deleteImagesByRelatedId: vi.fn()
    }
}));

vi.mock('./googleDrive', () => ({
    googleDriveService: {
        softDeleteFolder: vi.fn(async () => undefined)
    },
    getAutoConnectPreference: vi.fn(() => true)
}));

describe('cleanupService.fullTemplateCleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('orchestrates cleanup across sessions, tables, images, and cloud', async () => {
        const templateId = 'tpl_123';

        await cleanupService.fullTemplateCleanup(templateId);

        // 1. Verify Sessions
        expect(db.sessions.where).toHaveBeenCalledWith('templateId');
        expect(imageService.deleteImagesByRelatedId).toHaveBeenCalledWith('s1');
        expect(imageService.deleteImagesByRelatedId).toHaveBeenCalledWith('s2');
        expect(googleDriveService.softDeleteFolder).toHaveBeenCalledWith('c1', 'active');
        expect(db.sessions.bulkDelete).toHaveBeenCalledWith(['s1', 's2']);

        // 2. Verify Template Tables
        expect(db.templates.delete).toHaveBeenCalledWith(templateId);
        expect(db.templatePrefs.delete).toHaveBeenCalledWith(templateId);
        expect(db.templateShareCache.delete).toHaveBeenCalledWith(templateId);

        // 3. Verify Template Images
        expect(imageService.deleteImagesByRelatedId).toHaveBeenCalledWith(templateId);

        // 4. Verify Cloud Template Folder
        expect(googleDriveService.softDeleteFolder).toHaveBeenCalledWith(templateId, 'template');

        // 5. [Safety Check] Ensure History table is NEVER touched
        expect(db.history.delete).not.toHaveBeenCalled();

        // 6. [Safety Check] Ensure it only deleted the 2 related sessions found
        expect(db.sessions.bulkDelete).toHaveBeenCalledWith(['s1', 's2']);
        expect(db.sessions.bulkDelete).not.toHaveBeenCalledWith(expect.arrayContaining(['unrelated_s']));
    });
});
