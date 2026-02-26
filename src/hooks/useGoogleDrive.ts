
import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile, CloudResourceType, getAutoConnectPreference, setAutoConnectPreference } from '../services/googleDrive';
import { systemSyncService } from '../services/systemSyncService';
import { useToast } from './useToast';
import { useCloudTranslation } from '../i18n/cloud';
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { isDisposableTemplate } from '../utils/templateUtils';

export const useGoogleDrive = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConnected, setIsConnected] = useState(googleDriveService.isAuthorized);

    // [Standardized] Initialize from shared helper
    const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(getAutoConnectPreference);

    const { showToast } = useToast();
    const { t: tCloud } = useCloudTranslation();

    useEffect(() => {
        setIsConnected(googleDriveService.isAuthorized);
    }, []);

    // [Modified] Explicit Connect Function
    const connectToCloud = useCallback(async () => {
        try {
            await googleDriveService.signIn();
            setIsConnected(true);
            // Only enable auto-connect preference AFTER successful sign-in
            setIsAutoConnectEnabled(true);
            // [Fix] Sync state using shared helper
            setAutoConnectPreference(true);

            showToast({ message: tCloud('cloud_toast_connect_success'), type: 'success' });
            return true;
        } catch (e: any) {
            console.error("Manual connection failed:", e);

            setIsAutoConnectEnabled(false);
            setAutoConnectPreference(false);
            setIsConnected(false);

            if (e.error === 'popup_closed_by_user') {
                showToast({ message: tCloud('cloud_toast_cancel_login'), type: 'info' });
            } else {
                showToast({ message: tCloud('cloud_toast_connect_failed'), type: 'error' });
            }
            return false;
        }
    }, [showToast, tCloud]);

    // [Modified] Explicit Disconnect Function
    const disconnectFromCloud = useCallback(async () => {
        setIsAutoConnectEnabled(false);
        setAutoConnectPreference(false);
        await googleDriveService.signOut();
        setIsConnected(false);
        showToast({ message: tCloud('cloud_toast_disconnect_success'), type: 'info' });
    }, [showToast, tCloud]);

    const ensureConnection = async () => {
        // [Fix] Read directly from storage to avoid stale state in multiple hook instances
        const enabled = getAutoConnectPreference();
        if (!enabled) {
            throw new Error(tCloud('cloud_err_not_enabled'));
        }
        if (!googleDriveService.isAuthorized) {
            await googleDriveService.signIn();
            setIsConnected(true);
        }
    };

    const handleError = (error: any, actionKey: string) => {
        console.error(`${tCloud(actionKey as any)} Error:`, error);
        const errMsg = error.message || '';
        if (error.error === 'popup_closed_by_user') {
            showToast({ message: tCloud('cloud_toast_cancel_login'), type: 'info' });
        } else if (errMsg.includes('API has not been used') || errMsg.includes('is disabled')) {
            showToast({ message: tCloud('cloud_toast_api_disabled'), type: 'error' });
        } else if (error.status === 403 || error.status === 401) {
            setIsConnected(false);
            showToast({ message: tCloud('cloud_toast_auth_failed'), type: 'error' });
        } else {
            showToast({
                message: tCloud('cloud_toast_action_failed', {
                    action: tCloud(actionKey as any),
                    errMsg: errMsg || tCloud('sync_status_failed') // fallback to 'Failed'
                }),
                type: 'error'
            });
        }
    };

    const handleBackup = useCallback(async (template: GameTemplate): Promise<GameTemplate | null> => {
        // [Fix] Check preference directly
        if (!getAutoConnectPreference()) return null;

        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({ message: tCloud('cloud_toast_backing_up'), type: 'info' });
            const updatedTemplate = await googleDriveService.backupTemplate(template);
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_backup_success'), type: 'success' });
            return updatedTemplate;
        } catch (error: any) {
            handleError(error, "cloud_action_backup");
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const fetchFileList = useCallback(async (mode: 'active' | 'trash' = 'active', source: 'templates' | 'sessions' | 'history' = 'templates'): Promise<CloudFile[]> => {
        try {
            await ensureConnection();
            const files = await googleDriveService.listFiles(mode, source);
            setIsConnected(true);
            return files;
        } catch (error: any) {
            if (error.error !== 'popup_closed_by_user') {
                handleError(error, "cloud_action_fetch");
            }
            throw error;
        }
    }, [showToast, tCloud]);

    const restoreBackup = useCallback(async (fileId: string): Promise<GameTemplate> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({ message: tCloud('cloud_toast_restoring'), type: 'info' });
            // [Updated] Use new Smart Hydration method
            const template = await googleDriveService.restoreTemplate(fileId);
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_restore_success'), type: 'success' });
            return template;
        } catch (error: any) {
            handleError(error, "cloud_action_restore");
            throw error;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const restoreSessionBackup = useCallback(async (fileId: string): Promise<GameSession> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({ message: tCloud('cloud_toast_downloading'), type: 'info' });
            const session = await googleDriveService.getFileContent(fileId, 'session.json');
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_download_success'), type: 'success' });
            return session;
        } catch (error: any) {
            handleError(error, "cloud_action_download");
            throw error;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const restoreHistoryBackup = useCallback(async (fileId: string): Promise<HistoryRecord> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({ message: tCloud('cloud_toast_downloading_history'), type: 'info' });
            const record = await googleDriveService.getFileContent(fileId, 'session.json');
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_download_success'), type: 'success' });
            return record;
        } catch (error: any) {
            handleError(error, "cloud_action_download");
            throw error;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const restoreFromTrash = useCallback(async (folderId: string, type: CloudResourceType): Promise<boolean> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            await googleDriveService.restoreFolder(folderId, type);
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_restore_folder_success'), type: 'success' });
            return true;
        } catch (error: any) {
            handleError(error, "cloud_action_restore");
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    // [UPDATED] Return Blob instead of string
    const downloadCloudImage = useCallback(async (fileId: string): Promise<Blob | null> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({ message: tCloud('cloud_toast_downloading_image'), type: 'info' });
            const blob = await googleDriveService.downloadImage(fileId);
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_image_success'), type: 'success' });
            return blob;
        } catch (error: any) {
            handleError(error, "cloud_action_download_image");
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const deleteCloudFile = useCallback(async (fileId: string): Promise<boolean> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({ message: tCloud('cloud_toast_deleting'), type: 'info' });
            await googleDriveService.deleteFile(fileId);
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_delete_success'), type: 'success' });
            return true;
        } catch (error: any) {
            handleError(error, "cloud_action_delete");
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const emptyTrash = useCallback(async (type?: CloudResourceType): Promise<boolean> => {
        setIsSyncing(true);
        try {
            await ensureConnection();
            showToast({
                message: type ? tCloud('cloud_toast_emptying_trash_category') : tCloud('cloud_toast_emptying_trash_all'),
                type: 'info'
            });
            await googleDriveService.emptyTrash(type);
            setIsConnected(true);
            showToast({ message: tCloud('cloud_toast_trash_empty_success'), type: 'success' });
            return true;
        } catch (error: any) {
            handleError(error, "cloud_action_empty");
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, tCloud]);

    const silentSystemBackup = useCallback(async (data: any): Promise<void> => {
        if (!getAutoConnectPreference()) return;
        if (!googleDriveService.isAuthorized) return;
        try {
            // [Note] 自動背景備份目前不執行合併邏輯，僅在上傳單一設定檔時使用。
            // 真正的完整系統備份與合併現在由 performFullBackup 負責。
            const { data: rawData, ...settingsOnly } = data; // Only save preferences
            await googleDriveService.saveSystemData('settings_backup.json', settingsOnly);
        } catch (e) {
            console.warn("Silent settings backup failed:", e);
        }
    }, []);

    // [Full Backup] Smart Skip Logic: Cloud.ts >= Local.ts -> Skip
    const performFullBackup = useCallback(async (
        systemData: any, // [New Argument] Full system data for merging
        templates: GameTemplate[],
        history: HistoryRecord[],
        sessions: GameSession[],
        overrides: GameTemplate[],
        onProgress: (count: number, total: number) => void,
        onError: (failedItems: string[]) => void,
        onItemSuccess?: (type: 'template' | 'history' | 'session', item: any) => void
    ): Promise<{ success: number, skipped: number, failed: number }> => {
        setIsSyncing(true);
        let successCount = 0;
        let skippedCount = 0;
        const failedItems: string[] = [];

        try {
            await ensureConnection();

            await googleDriveService.ensureAppStructure();

            const [cloudTemplates, cloudHistory, cloudActive] = await Promise.all([
                googleDriveService.listFoldersInParent(googleDriveService.templatesFolderId!),
                googleDriveService.listFoldersInParent(googleDriveService.historyFolderId!),
                googleDriveService.listFoldersInParent(googleDriveService.activeFolderId!)
            ]);

            const createMap = (files: CloudFile[]) => {
                const map = new Map<string, CloudFile>();
                files.forEach(f => {
                    const lastSep = f.name.lastIndexOf('_');
                    // Ensure underscore exists and is not the first character
                    if (lastSep > 0) {
                        const uuid = f.name.substring(lastSep + 1);
                        map.set(uuid, f);
                    }
                });
                return map;
            };

            const templateMap = createMap(cloudTemplates);
            const historyMap = createMap(cloudHistory);
            const activeMap = createMap(cloudActive);

            const allTemplates = [...templates, ...overrides];

            const total = allTemplates.length + history.length + sessions.length + 1; // +1 for settings
            let processed = 0;
            let lastReportTime = 0; // [Optimization] Throttle UI updates

            // Initial Update
            onProgress(0, total);

            // [Optimization] Concurrency Pool Runner
            // Allows us to process multiple items in parallel but limited by concurrency.
            // Skipped items resolve immediately, freeing up a slot for the next item.
            const runWithConcurrency = async <T>(
                items: T[],
                concurrency: number,
                fn: (item: T) => Promise<void>
            ) => {
                const executing = new Set<Promise<void>>();
                for (const item of items) {
                    const p = fn(item).then(() => { executing.delete(p); });
                    executing.add(p);
                    if (executing.size >= concurrency) {
                        await Promise.race(executing);
                    }
                }
                await Promise.all(executing);
            };

            const processItem = async (task: () => Promise<void>, name: string, isSkipped: boolean = false) => {
                try {
                    if (isSkipped) {
                        skippedCount++;
                    } else {
                        await task();
                        successCount++;
                    }
                } catch (e) {
                    console.error(`Backup failed for ${name}:`, e);
                    failedItems.push(name);
                } finally {
                    processed++;

                    // [Optimization] Throttle progress updates to avoid freezing the UI when skipping many files
                    const now = Date.now();
                    // Update if:
                    // 1. Not skipped (Action happened, keep user informed)
                    // 2. OR > 200ms passed since last update (Throttle skips)
                    // 3. OR it's the last item (Ensure 100%)
                    if (!isSkipped || now - lastReportTime > 200 || processed === total) {
                        onProgress(processed, total);
                        lastReportTime = now;
                    }
                }
            };

            const CHUNK_SIZE = 3; // Max active uploads

            // 2a. Process Templates (Concurrency Pool)
            await runWithConcurrency(allTemplates, CHUNK_SIZE, async (t) => {
                // [Fix] Automatically skip disposable (simple) templates to avoid cluttering cloud
                if (isDisposableTemplate(t)) {
                    return processItem(async () => { }, t.name, true);
                }

                const cloudInfo = templateMap.get(t.id);

                // Skip Logic: If cloud exists AND cloud ts >= local ts
                let isUpToDate = false;
                if (cloudInfo && t.updatedAt) {
                    const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                    if (cloudTime >= t.updatedAt) {
                        isUpToDate = true;
                    }
                }

                return processItem(async () => {
                    const updatedT = await googleDriveService.backupTemplate(t, null, cloudInfo?.id, cloudInfo?.name);
                    if (onItemSuccess) onItemSuccess('template', updatedT);
                }, t.name, isUpToDate);
            });

            // 2b. Process History (Concurrency Pool)
            await runWithConcurrency(history, CHUNK_SIZE, async (h) => {
                const cloudInfo = historyMap.get(h.id);

                // [Change] Use updatedAt for history comparison
                let isUpToDate = false;
                const localTime = h.updatedAt || h.endTime;
                if (cloudInfo && localTime) {
                    const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                    if (cloudTime >= localTime) {
                        isUpToDate = true;
                    }
                }

                return processItem(async () => {
                    await googleDriveService.backupHistoryRecord(h, cloudInfo?.id, cloudInfo?.name);

                    // [Fix] Logic to cleanup stale Active Session in Cloud
                    if (activeMap.has(h.id)) {
                        const staleActiveFile = activeMap.get(h.id);
                        if (staleActiveFile) {
                            googleDriveService.softDeleteFolder(staleActiveFile.id, 'active')
                                .catch(err => console.warn("Failed to cleanup stale active session", err));
                        }
                    }
                }, `${h.gameName} (${new Date(h.endTime).toLocaleDateString()})`, isUpToDate);
            });

            // 2c. Process Active Sessions (Concurrency Pool)
            await runWithConcurrency(sessions, CHUNK_SIZE, async (s) => {
                const cloudInfo = activeMap.get(s.id);
                const templateName = allTemplates.find(t => t.id === s.templateId)?.name || tCloud('cloud_unknown_game');

                // [Comparison Logic Added] Check lastUpdatedAt
                let isUpToDate = false;
                const localTime = s.lastUpdatedAt || s.startTime;
                if (cloudInfo && localTime) {
                    const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                    if (cloudTime >= localTime) {
                        isUpToDate = true;
                    }
                }

                return processItem(async () => {
                    await googleDriveService.backupActiveSession(s, templateName, cloudInfo?.id, cloudInfo?.name);
                }, tCloud('cloud_active_session_prefix', { id: s.id.slice(0, 8) }), isUpToDate);
            });

            // 2d. Process System Settings (Merge & Upload via Service)
            try {
                await systemSyncService.mergeAndBackupSystemSettings(systemData);
                successCount++;
            } catch (e) {
                console.warn("Settings backup failed", e);
                failedItems.push(tCloud('cloud_system_settings'));
            } finally {
                processed++;
                // Always update for the last item (Settings)
                onProgress(processed, total);
            }

            if (failedItems.length > 0) {
                onError(failedItems);
            }

        } catch (e: any) {
            handleError(e, "cloud_action_full_backup_init");
        } finally {
            setIsSyncing(false);
        }
        return { success: successCount, skipped: skippedCount, failed: failedItems.length };
    }, [showToast, tCloud]);

    // [Full Restore] Smart Skip Logic: Local.ts >= Cloud.ts -> Skip
    const performFullRestore = useCallback(async (
        // [Update] Added sessions map to input signature
        localMeta: { templates: Map<string, number>, history: Map<string, number>, sessions: Map<string, number> },
        onProgress: (count: number, total: number) => void,
        onError: (failedItems: string[]) => void,
        onItemRestored: (type: 'template' | 'history' | 'session', item: any) => Promise<void>,
        onSettingsRestored?: (settings: any) => void
    ): Promise<{ success: number, skipped: number, failed: number }> => {
        setIsSyncing(true);
        let successCount = 0;
        let skippedCount = 0;
        const failedItems: string[] = [];

        try {
            await ensureConnection();
            await googleDriveService.ensureAppStructure();

            const [cloudTemplates, cloudHistory] = await Promise.all([
                googleDriveService.listFoldersInParent(googleDriveService.templatesFolderId!),
                googleDriveService.listFoldersInParent(googleDriveService.historyFolderId!)
                // [EXCLUDE ACTIVE SESSIONS] "One-Click Restore" should NOT touch active sessions
                // to prevent overwriting local in-progress games.
            ]);

            const total = cloudTemplates.length + cloudHistory.length + 1; // +1 for settings
            let processed = 0;
            let lastReportTime = 0; // [Optimization] Throttle UI updates

            onProgress(0, total);

            // 1. Restore Settings First (if callback provided)
            if (onSettingsRestored && googleDriveService.systemFolderId) {
                try {
                    const settings = await googleDriveService.getFileContent(googleDriveService.systemFolderId, 'settings_backup.json');
                    onSettingsRestored(settings);
                    successCount++;
                } catch (e) {
                    console.log("No settings backup found or failed to restore", e);
                    // Not critical, don't add to failed count to avoid scaring user
                } finally {
                    processed++;
                    onProgress(processed, total);
                }
            }

            // Helper to extract ID using lastUnderscore logic
            const getId = (name: string) => {
                const lastSep = name.lastIndexOf('_');
                if (lastSep !== -1) {
                    return name.substring(lastSep + 1);
                }
                return null;
            };

            const processItem = async (file: CloudFile, type: 'template' | 'history') => {
                const id = getId(file.name);
                const cloudTime = Number(file.appProperties?.originalUpdatedAt || 0);
                let shouldDownload = true;

                // Check vs Local
                if (id) {
                    let localTime = 0;
                    if (type === 'template' && localMeta.templates.has(id)) {
                        localTime = localMeta.templates.get(id) || 0;
                    } else if (type === 'history' && localMeta.history.has(id)) {
                        localTime = localMeta.history.get(id) || 0;
                    }

                    // Skip if local is newer or same
                    if (localTime >= cloudTime && localTime > 0) {
                        shouldDownload = false;
                    }
                }

                try {
                    if (shouldDownload) {
                        if (type === 'template') {
                            // [Updated] Use new Smart Hydration method
                            const data = await googleDriveService.restoreTemplate(file.id);
                            await onItemRestored('template', data);
                        } else if (type === 'history') {
                            const data = await googleDriveService.getFileContent(file.id, 'session.json');
                            await onItemRestored('history', data);
                        }
                        successCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (e: any) {
                    // Only report real errors, not "file not found" which might happen for empty folders
                    if (!e.message?.toLowerCase().includes('not found')) {
                        console.error(`Restore failed for ${file.name}:`, e);
                        failedItems.push(file.name);
                    }
                } finally {
                    processed++;

                    // [Optimization] Throttle progress updates
                    const now = Date.now();
                    if (shouldDownload || now - lastReportTime > 200 || processed === total) {
                        onProgress(processed, total);
                        lastReportTime = now;
                    }
                }
            };

            const CHUNK_SIZE = 3;

            // Process Templates
            const templateChunks = [];
            for (let i = 0; i < cloudTemplates.length; i += CHUNK_SIZE) {
                templateChunks.push(cloudTemplates.slice(i, i + CHUNK_SIZE));
            }
            for (const chunk of templateChunks) {
                await Promise.all(chunk.map(f => processItem(f, 'template')));
            }

            // Process History
            const historyChunks = [];
            for (let i = 0; i < cloudHistory.length; i += CHUNK_SIZE) {
                historyChunks.push(cloudHistory.slice(i, i + CHUNK_SIZE));
            }
            for (const chunk of historyChunks) {
                await Promise.all(chunk.map(f => processItem(f, 'history')));
            }

            // [EXCLUDE ACTIVE SESSIONS LOOP]

            if (failedItems.length > 0) {
                onError(failedItems);
            }

        } catch (e: any) {
            handleError(e, "cloud_action_full_restore_init");
        } finally {
            setIsSyncing(false);
        }
        return { success: successCount, skipped: skippedCount, failed: failedItems.length };
    }, [showToast, tCloud]);

    return {
        handleBackup,
        fetchFileList,
        restoreBackup,
        restoreSessionBackup,
        restoreHistoryBackup,
        restoreFromTrash,
        downloadCloudImage,
        deleteCloudFile,
        emptyTrash,
        connectToCloud,      // Exposed
        disconnectFromCloud, // Exposed
        isSyncing,
        isConnected,
        isAutoConnectEnabled,
        silentSystemBackup,
        performFullBackup,
        performFullRestore, // [New]
        isMockMode: false
    };
};
