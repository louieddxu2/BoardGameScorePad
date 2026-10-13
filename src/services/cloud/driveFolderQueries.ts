import { googleDriveClient } from './googleDriveClient';
import type { CloudFile } from './types';

const APP_FOLDERS = ['_System', '_Active', '_History', '_Templates'] as const;
type AppFolderName = typeof APP_FOLDERS[number];

/** Resolve the four existing directories with one complete query; create only missing ones. */
export const resolveDriveAppFolders = async (
    rootId: string, assertCurrent: () => void,
): Promise<Record<AppFolderName, string>> => {
    assertCurrent();
    const names = APP_FOLDERS.map(name => `name = '${name}'`).join(' or ');
    const files = await googleDriveClient.fetchAllItems(
        `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and (${names})`,
        'files(id, name)',
    );
    assertCurrent();
    const existing = new Map<string, CloudFile>();
    for (const file of files) {
        if (!existing.has(file.name)) existing.set(file.name, file);
    }
    const folders = await Promise.all(APP_FOLDERS.map(async name => {
        assertCurrent();
        const folder = existing.get(name) || await googleDriveClient.createFolder(name, rootId);
        return [name, folder.id] as const;
    }));
    assertCurrent();
    return Object.fromEntries(folders) as Record<AppFolderName, string>;
};

/** Merge direct-child queries, keeping category ownership from returned parent IDs. */
export const listDriveFoldersInParents = async (parentIds: readonly string[]): Promise<Map<string, CloudFile[]>> => {
    const groups = new Map(parentIds.map(id => [id, [] as CloudFile[]]));
    const parents = [...groups.keys()].map(id => `'${id}' in parents`).join(' or ');
    const files = await googleDriveClient.fetchAllItems(
        `(${parents}) and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        'files(id, name, createdTime, appProperties, parents)',
    );
    for (const file of files) {
        if (!file.parents?.length) throw new Error('Drive folder parent is missing');
        for (const parentId of file.parents) groups.get(parentId)?.push(file);
    }
    return groups;
};
