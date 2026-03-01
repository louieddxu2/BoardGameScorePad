
import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import { migrateFromLocalStorage } from '../utils/dbMigration';
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { googleDriveService, getAutoConnectPreference } from '../services/googleDrive';
import { imageService } from '../services/imageService';
import { cleanupService } from '../services/cleanupService';
import { bgStatsImportService } from '../features/bgstats/services/bgStatsImportService';
import { BgStatsExport, ImportManualLinks } from '../features/bgstats/types';
import { useToast } from './useToast';
import { generateId } from '../utils/idGenerator';
import { useAppTranslation } from '../i18n/app';
import { prepareTemplateForSave, isDisposableTemplate } from '../utils/templateUtils';

// Sub-hooks
import { useAppQueries } from './useAppQueries';
import { useSessionManager } from './useSessionManager';
import { useLibrary } from './useLibrary';
import { useDebounce } from './useDebounce';

export const useAppData = () => {
    const { showToast } = useToast();
    const { t: tApp } = useAppTranslation();
    const [isDbReady, setIsDbReady] = useState(false);

    // [State Moved Up] Pinned IDs must be initialized before queries
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('sm_pinned_ids') || '[]'); } catch { return []; }
    });

    // [Search State]
    const [searchQuery, setSearchQuery] = useState('');

    // [Performance] Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // [System Dirty Tracking]
    const [systemDirtyTime, setSystemDirtyTime] = useState<number>(0);
    const markSystemDirty = useCallback(() => setSystemDirtyTime(Date.now()), []);

    // --- 1. Initialization & Migration ---
    useEffect(() => {
        const init = async () => {
            await migrateFromLocalStorage();
            setIsDbReady(true);
        };
        init();
    }, []);

    // --- 2. Queries, Library & Session Management ---
    // Pass pinnedIds so queries can correctly filter simple templates
    const queries = useAppQueries(debouncedSearchQuery, pinnedIds);

    // Library Hook for Global Access
    const { updatePlayer, updateLocation, commitPlayerStats, commitLocationStats } = useLibrary(markSystemDirty);

    // [Standardized] Use shared helper
    const isCloudEnabled = getAutoConnectPreference;

    const sessionManager = useSessionManager({
        getTemplate: queries.getTemplate,
        activeSessions: queries.activeSessions,
        isCloudEnabled
    });

    // --- 3. LocalStorage Settings & Global Actions ---
    const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
        (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark'
    );

    const [newBadgeIds, setNewBadgeIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('sm_new_badge_ids') || '[]'); } catch { return []; }
    });

    const [viewingHistoryRecord, setViewingHistoryRecord] = useState<HistoryRecord | null>(null);

    useEffect(() => { localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds)); }, [newBadgeIds]);
    useEffect(() => {
        localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
    }, [pinnedIds]);

    useEffect(() => {
        localStorage.setItem('app_theme', themeMode);
        document.documentElement.setAttribute('data-theme', themeMode);
    }, [themeMode]);

    const toggleTheme = () => {
        setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
        markSystemDirty();
    };

    const clearNewBadges = () => {
        setNewBadgeIds([]);
        markSystemDirty();
    };

    // --- CRUD Actions ---

    const saveTemplate = async (template: GameTemplate, options: { skipCloud?: boolean, preserveTimestamps?: boolean } = {}) => {
        const finalUpdatedAt = options.preserveTimestamps ? (template.updatedAt || Date.now()) : Date.now();

        const finalTemplate = await prepareTemplateForSave(
            { ...template, updatedAt: finalUpdatedAt },
            async (id) => !!(await db.builtins.get(id))
        );

        await db.templates.put(finalTemplate);

        // [Filter Logic] Do not backup disposable templates to cloud
        // Pass pinnedIds to isDisposableTemplate to avoid backing up pinned simple templates (which are technically disposable structure-wise)
        if (!options.skipCloud && isCloudEnabled() && !isDisposableTemplate(finalTemplate, pinnedIds)) {
            googleDriveService.backupTemplate(finalTemplate).then((updated) => {
                if (updated) {
                    db.templates.update(updated.id, { lastSyncedAt: updated.updatedAt || Date.now() });
                }
            }).catch(console.error);
        }
    };

    const deleteTemplate = async (id: string) => {
        try {
            const templateToDelete = await queries.getTemplate(id);

            const relatedSessions = await db.sessions.where('templateId').equals(id).toArray();
            if (relatedSessions.length > 0) {
                for (const s of relatedSessions) {
                    await cleanupService.cleanSessionArtifacts(s.id, s.cloudFolderId);
                }
                await db.sessions.bulkDelete(relatedSessions.map(s => s.id));
            }

            await db.templates.delete(id);
            await db.templatePrefs.delete(id);
            await imageService.deleteImagesByRelatedId(id);

            if (isCloudEnabled() && templateToDelete) {
                googleDriveService.softDeleteFolder(id, 'template').then(() => {
                    showToast({ message: tApp('app_toast_sync_trash'), type: 'info' });
                }).catch(console.error);
            }
        } catch (error) {
            console.error("Delete failed", error);
            showToast({ message: tApp('app_toast_delete_failed'), type: 'error' });
        }
    };

    // [Moved & Enhanced] Toggle Pin with Auto-Cleanup Logic
    const togglePin = async (id: string) => {
        const isUnpinning = pinnedIds.includes(id);
        const nextPinnedIds = isUnpinning ? pinnedIds.filter(pid => pid !== id) : [id, ...pinnedIds];

        setPinnedIds(nextPinnedIds);
        markSystemDirty();

        // [Auto Cleanup] If unpinning a "Simple Template" (Disposable), delete it.
        if (isUnpinning) {
            const template = await queries.getTemplate(id);
            if (template) {
                // Check if it qualifies as disposable based on the NEW pinned state (unpinned)
                if (isDisposableTemplate(template, nextPinnedIds)) {
                    await deleteTemplate(id);
                    showToast({ message: tApp('app_toast_disposable_removed'), type: 'info' });
                }
            }
        }
    };

    const restoreSystemTemplate = async (templateId: string) => {
        try {
            let shadowTemplate = await db.templates.get(templateId);
            if (!shadowTemplate) {
                shadowTemplate = await db.templates.where('sourceTemplateId').equals(templateId).first();
            }

            if (!shadowTemplate || !shadowTemplate.sourceTemplateId) return;

            const backupId = generateId();
            const backupTemplate: GameTemplate = {
                ...shadowTemplate,
                id: backupId,
                name: shadowTemplate.name,
                sourceTemplateId: undefined,
                updatedAt: Date.now(),
                cloudImageId: undefined,
                lastSyncedAt: undefined
            };

            const relatedSessions = await db.sessions.where('templateId').equals(shadowTemplate.id).toArray();
            const relatedImages = await db.images.where('relatedId').equals(shadowTemplate.id).toArray();

            await (db as any).transaction('rw', db.templates, db.sessions, db.images, db.templatePrefs, async () => {
                await db.templates.add(backupTemplate);
                for (const session of relatedSessions) {
                    await db.sessions.update(session.id, { templateId: backupId });
                }
                for (const img of relatedImages) {
                    await db.images.update(img.id, { relatedId: backupId });
                }
                const prefs = await db.templatePrefs.get(shadowTemplate!.id);
                if (prefs) {
                    await db.templatePrefs.put({ ...prefs, templateId: backupId });
                    await db.templatePrefs.delete(shadowTemplate!.id);
                }
                await db.templates.delete(shadowTemplate!.id);
            });

            if (isCloudEnabled()) {
                googleDriveService.softDeleteFolder(shadowTemplate.id, 'template').catch(console.error);
            }

            showToast({ message: tApp('app_toast_restore_builtin'), type: 'success' });

        } catch (error) {
            console.error("Restore failed", error);
            showToast({ message: tApp('app_toast_restore_failed'), type: 'error' });
        }
    };

    const deleteHistoryRecord = async (id: string) => {
        try {
            const record = await db.history.get(id);
            await db.history.delete(id);
            await imageService.deleteImagesByRelatedId(id);

            if (isCloudEnabled() && record?.cloudFolderId) {
                googleDriveService.softDeleteFolder(record.cloudFolderId, 'history').catch(console.error);
            }

            showToast({ message: tApp('app_toast_history_deleted'), type: 'info' });
        } catch (error) {
            console.error("Failed to delete history:", error);
            showToast({ message: tApp('app_toast_delete_failed'), type: 'error' });
        }
    };

    const viewHistory = async (id: string | null) => {
        if (!id) {
            setViewingHistoryRecord(null);
            return;
        }
        const fullRecord = await db.history.get(id);
        if (fullRecord) {
            setViewingHistoryRecord(fullRecord);
        }
    };

    const getSystemExportData = async () => {
        const players = await db.savedPlayers.toArray();
        const locations = await db.savedLocations.toArray();
        const customTemplates = await db.templates.toArray();
        const overrides: GameTemplate[] = [];
        const history = await db.history.toArray();
        const activeSessions = await db.sessions.toArray();

        return {
            preferences: {
                theme: themeMode,
                pinnedIds,
                newBadgeIds,
                zoomLevel: parseFloat(localStorage.getItem('app_zoom_level') || '1.0'),
                isEditMode: localStorage.getItem('app_edit_mode') !== 'false'
            },
            library: {
                players,
                locations
            },
            data: {
                templates: customTemplates,
                overrides: overrides,
                history: history,
                sessions: activeSessions
            },
            timestamp: Date.now()
        };
    };

    const importSystemSettings = async (settings: any) => {
        try {
            if (settings.preferences) {
                const { theme, pinnedIds, newBadgeIds, zoomLevel, isEditMode } = settings.preferences;
                if (theme) {
                    setThemeMode(theme);
                    localStorage.setItem('app_theme', theme);
                }
                if (pinnedIds) {
                    setPinnedIds(pinnedIds);
                    localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
                }
                if (newBadgeIds) {
                    setNewBadgeIds(newBadgeIds);
                    localStorage.setItem('sm_new_badge_ids', JSON.stringify(newBadgeIds));
                }
                if (zoomLevel) localStorage.setItem('app_zoom_level', String(zoomLevel));
                if (isEditMode !== undefined) localStorage.setItem('app_edit_mode', String(isEditMode));
            }

            if (settings.library) {
                if (Array.isArray(settings.library.players)) {
                    await db.savedPlayers.bulkPut(settings.library.players);
                }
                if (Array.isArray(settings.library.locations)) {
                    await db.savedLocations.bulkPut(settings.library.locations);
                }
            }
            console.log("System settings restored successfully");
        } catch (e) {
            console.error("Failed to restore settings", e);
        }
    };

    const importSession = async (session: GameSession) => {
        try {
            await db.sessions.put(session);
            showToast({ message: tApp('app_toast_import_session'), type: 'success' });
        } catch (e) {
            console.error("Failed to import session", e);
            showToast({ message: tApp('app_toast_import_failed'), type: 'error' });
        }
    };

    const importHistoryRecord = async (record: HistoryRecord) => {
        try {
            await db.history.put(record);
            const activeConflict = await db.sessions.get(record.id);
            if (activeConflict) {
                await db.sessions.delete(record.id);
                console.log("Cleaned up conflicting active session during history restore");
            }

            showToast({ message: tApp('app_toast_history_restored'), type: 'success' });
        } catch (e) {
            console.error("Failed to import history", e);
            showToast({ message: tApp('app_toast_restore_failed'), type: 'error' });
        }
    };

    const importBgStatsData = async (data: BgStatsExport, links: ImportManualLinks): Promise<boolean> => {
        try {
            const count = await bgStatsImportService.importData(data, links, (msgKey) => {
            });
            showToast({ message: tApp('msg_import_success', { count }), type: 'success' });
            markSystemDirty();
            return true;
        } catch (e) {
            console.error("BG Stats Import Failed", e);
            showToast({ message: tApp('msg_import_failed'), type: 'error' });
            return false;
        }
    };

    const saveImage = async (blob: Blob, relatedId: string, type: 'template' | 'session') => {
        return await imageService.saveImage(blob, relatedId, type);
    };

    const loadImage = async (id: string) => {
        return await imageService.getImage(id);
    };

    return {
        searchQuery,
        setSearchQuery,

        // Data from Queries
        templates: queries.templates,
        userTemplatesCount: queries.userTemplatesCount,
        systemTemplates: queries.systemTemplates,
        systemTemplatesCount: queries.systemTemplatesCount,
        systemOverrides: queries.systemOverrides,

        // [NEW] Merged Options (renamed from Candidates)
        gameOptions: queries.gameOptions,

        activeSessionIds: queries.activeSessionIds,
        activeSessions: queries.activeSessions, // [Update] Expose this!
        historyRecords: queries.historyRecords,
        historyCount: queries.historyCount,

        savedPlayers: queries.savedPlayers,
        savedLocations: queries.savedLocations,

        savedGames: queries.savedGames,
        getTemplate: queries.getTemplate,
        getBuiltinTemplateByShortId: queries.getBuiltinTemplateByShortId,
        getSessionPreview: queries.getSessionPreview,

        // Session Manager State
        currentSession: sessionManager.currentSession,
        activeTemplate: sessionManager.activeTemplate,
        sessionImage: sessionManager.sessionImage,
        sessionPlayerCount: sessionManager.sessionPlayerCount,

        // Global State
        newBadgeIds,
        pinnedIds,
        themeMode,
        viewingHistoryRecord,
        systemDirtyTime,
        isDbReady,

        // Actions
        startSession: sessionManager.startSession,
        resumeSession: sessionManager.resumeSession,
        discardSession: sessionManager.discardSession,
        clearAllActiveSessions: sessionManager.clearAllActiveSessions,
        updateSession: sessionManager.updateSession,
        resetSessionScores: sessionManager.resetSessionScores,
        exitSession: sessionManager.exitSession,
        saveToHistory: sessionManager.saveToHistory,
        updateActiveTemplate: sessionManager.updateActiveTemplate,
        setSessionImage: sessionManager.setSessionImage,
        updateSavedPlayer: sessionManager.updateSavedPlayer,

        setTemplates: () => { },
        toggleTheme,
        togglePin,
        clearNewBadges,
        updateSavedLocation: updateLocation,
        commitLocationStats,
        saveTemplate,
        deleteTemplate,
        restoreSystemTemplate,
        deleteHistoryRecord,
        viewHistory,
        saveImage,
        loadImage,
        getSystemExportData,
        importSystemSettings,
        importSession,
        importHistoryRecord,
        importBgStatsData
    };
};
