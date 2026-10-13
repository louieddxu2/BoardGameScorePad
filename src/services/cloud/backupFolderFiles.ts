import { googleDriveClient } from './googleDriveClient';
import type { CloudFile } from './types';
import { preferBackupJsonFile } from './backupJsonSelection';

export interface BackupFolderFiles {
    files: readonly CloudFile[];
    idFor(name: string, mimeType: string): string | null;
}

/** One complete, per-backup listing for uploads and post-commit cleanup; never cached globally. */
export const readBackupFolderFiles = async (folderId: string): Promise<BackupFolderFiles> => {
    const files = await googleDriveClient.fetchAllItems(
        `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        'files(id, name, mimeType, modifiedTime)',
    );
    const selected = new Map<string, CloudFile>();
    for (const file of files) {
        const key = JSON.stringify([file.name, file.mimeType]);
        selected.set(key, file.mimeType === 'application/json'
            ? preferBackupJsonFile(selected.get(key), file) : file);
    }
    return {
        files,
        idFor: (name, mimeType) => selected.get(JSON.stringify([name, mimeType]))?.id ?? null,
    };
};
