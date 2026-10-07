import { googleDriveService, type CloudFile } from '../googleDrive';

export interface GoogleDriveRestoreOptions {
    localMeta: { templates: Map<string, number>; history: Map<string, number>; sessions: Map<string, number> };
    onProgress: (count: number, total: number) => void;
    onError: (failedItems: string[]) => void;
    onItemRestored: (type: 'template' | 'history' | 'session', item: any) => Promise<void>;
    onSettingsRestored?: (settings: any) => void;
    ensureConnection: () => Promise<void>;
    handleError: (error: any, actionKey: string) => void;
    setIsSyncing: (syncing: boolean) => void;
}

/** Restore saved data without overwriting in-progress sessions. */
export async function runGoogleDriveRestore({
    localMeta, onProgress, onError, onItemRestored, onSettingsRestored,
    ensureConnection, handleError, setIsSyncing
}: GoogleDriveRestoreOptions): Promise<{ success: number; skipped: number; failed: number }> {
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
                console.log(`[Restore Debug] File ${file.name} - Local: ${localTime}, Cloud: ${cloudTime}, shouldDownload: ${shouldDownload}`);
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
}
