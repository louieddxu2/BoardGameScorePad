import { googleAuth } from './cloud/googleAuth';
import { googleDriveClient } from './cloud/googleDriveClient';
import { CloudFile, CloudResourceType } from './cloud/types';
import { GameTemplate, GameSession, HistoryRecord } from '../types';

const FOLDER_NAMES = {
    ROOT: 'BoardGameScorePad',
    TEMPLATES: '_Templates',
    ACTIVE: '_ActiveSessions',
    HISTORY: '_History',
    TRASH_TEMPLATES: '_Trash_Templates',
    TRASH_ACTIVE: '_Trash_ActiveSessions',
    TRASH_HISTORY: '_Trash_History'
};

export class GoogleDriveService {
    private rootFolderId: string | null = null;
    private folderIds: Record<string, string> = {};

    get isAuthorized(): boolean {
        return googleAuth.isAuthorized;
    }

    async signIn(): Promise<string> {
        return await googleAuth.signIn();
    }

    async signOut(): Promise<void> {
        return await googleAuth.signOut();
    }

    private async getRootFolder(): Promise<string> {
        if (this.rootFolderId) return this.rootFolderId;
        let root = await googleDriveClient.findFile(FOLDER_NAMES.ROOT, 'root', 'application/vnd.google-apps.folder');
        if (!root) {
            root = await googleDriveClient.createFolder(FOLDER_NAMES.ROOT);
        }
        this.rootFolderId = root.id;
        return root.id;
    }

    private async getFolder(type: CloudResourceType, isTrash: boolean = false): Promise<string> {
        const key = `${type}_${isTrash ? 'trash' : 'active'}`;
        if (this.folderIds[key]) return this.folderIds[key];

        const rootId = await this.getRootFolder();
        let folderName = '';
        
        if (isTrash) {
            if (type === 'template') folderName = FOLDER_NAMES.TRASH_TEMPLATES;
            else if (type === 'active') folderName = FOLDER_NAMES.TRASH_ACTIVE;
            else if (type === 'history') folderName = FOLDER_NAMES.TRASH_HISTORY;
        } else {
            if (type === 'template') folderName = FOLDER_NAMES.TEMPLATES;
            else if (type === 'active') folderName = FOLDER_NAMES.ACTIVE;
            else if (type === 'history') folderName = FOLDER_NAMES.HISTORY;
        }

        let folder = await googleDriveClient.findFile(folderName, rootId, 'application/vnd.google-apps.folder');
        if (!folder) {
            folder = await googleDriveClient.createFolder(folderName, rootId);
        }
        this.folderIds[key] = folder.id;
        return folder.id;
    }

    async getTrashFolder(type: CloudResourceType): Promise<string> {
        return this.getFolder(type, true);
    }

    async fetchFileList(mode: 'active' | 'trash', type: CloudResourceType): Promise<CloudFile[]> {
        if (!this.isAuthorized) await this.signIn();
        const folderId = await this.getFolder(type, mode === 'trash');
        const query = `'${folderId}' in parents and trashed = false`;
        const files = await googleDriveClient.fetchAllItems(query, 'files(id, name, createdTime, appProperties)');
        return files.map((f: any) => ({
            id: f.id,
            name: f.name,
            createdTime: f.createdTime,
            appProperties: f.appProperties
        }));
    }

    async backupTemplate(template: GameTemplate): Promise<GameTemplate | null> {
        if (!this.isAuthorized) await this.signIn();
        const folderId = await this.getFolder('template');
        const fileName = `${template.name}_${template.id}.json`;
        
        const file = await googleDriveClient.uploadFileToFolder(folderId, fileName, 'application/json', JSON.stringify(template));
        if (file) {
            await googleDriveClient.updateFileMetadata(file.id, {
                appProperties: { originalUpdatedAt: String(template.updatedAt || Date.now()) }
            });
            // Return updated template with sync time
            return { ...template, lastSyncedAt: Date.now() };
        }
        return null;
    }

    async restoreBackup(fileId: string): Promise<GameTemplate> {
        if (!this.isAuthorized) await this.signIn();
        const blob = await googleDriveClient.downloadBlob(fileId);
        const text = await blob.text();
        return JSON.parse(text);
    }

    // Sessions are folders containing session.json
    async createActiveSessionFolder(templateName: string, sessionId: string): Promise<string> {
        if (!this.isAuthorized) await this.signIn();
        const activeRoot = await this.getFolder('active');
        const folderName = `${templateName}_${sessionId}`;
        
        // Check if exists
        const existing = await googleDriveClient.findFile(folderName, activeRoot, 'application/vnd.google-apps.folder');
        if (existing) return existing.id;

        const folder = await googleDriveClient.createFolder(folderName, activeRoot);
        return folder.id;
    }

    async backupActiveSession(session: GameSession, templateName: string, folderId: string): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        await googleDriveClient.uploadFileToFolder(folderId, 'session.json', 'application/json', JSON.stringify(session));
        await googleDriveClient.updateFileMetadata(folderId, {
            appProperties: { originalUpdatedAt: String(session.lastUpdatedAt || Date.now()) }
        });
    }

    async restoreSessionBackup(folderId: string): Promise<GameSession> {
        if (!this.isAuthorized) await this.signIn();
        const query = `'${folderId}' in parents and name = 'session.json' and trashed = false`;
        const files = await googleDriveClient.fetchAllItems(query, 'files(id)');
        if (files.length === 0) throw new Error("Invalid session backup");
        const blob = await googleDriveClient.downloadBlob(files[0].id);
        const text = await blob.text();
        return JSON.parse(text);
    }

    async moveSessionToHistory(folderId: string): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        const activeRoot = await this.getFolder('active');
        const historyRoot = await this.getFolder('history');
        await googleDriveClient.moveFile(folderId, activeRoot, historyRoot);
    }

    async backupHistoryRecord(record: HistoryRecord, folderId: string): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        await googleDriveClient.uploadFileToFolder(folderId, 'record.json', 'application/json', JSON.stringify(record));
        await googleDriveClient.updateFileMetadata(folderId, {
            appProperties: { originalUpdatedAt: String(record.updatedAt || record.endTime) }
        });
    }

    async restoreHistoryBackup(folderId: string): Promise<HistoryRecord> {
        if (!this.isAuthorized) await this.signIn();
        const query = `'${folderId}' in parents and name = 'record.json' and trashed = false`;
        const files = await googleDriveClient.fetchAllItems(query, 'files(id)');
        if (files.length === 0) throw new Error("Invalid history backup");
        const blob = await googleDriveClient.downloadBlob(files[0].id);
        const text = await blob.text();
        return JSON.parse(text);
    }

    async deleteFile(fileId: string): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        await googleDriveClient.deleteFile(fileId);
    }

    async restoreFromTrash(fileId: string, type: CloudResourceType): Promise<boolean> {
        if (!this.isAuthorized) await this.signIn();
        const activeFolderId = await this.getFolder(type, false);
        const trashFolderId = await this.getFolder(type, true);
        await googleDriveClient.moveFile(fileId, trashFolderId, activeFolderId);
        return true;
    }

    async softDeleteFolder(fileId: string, type: CloudResourceType): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        const activeFolderId = await this.getFolder(type, false);
        const trashFolderId = await this.getFolder(type, true);
        await googleDriveClient.moveFile(fileId, activeFolderId, trashFolderId);
        this.cleanupTrashLimit(trashFolderId);
    }

    async emptyTrash(targetType?: CloudResourceType): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        
        const targetTypes: CloudResourceType[] = targetType 
            ? [targetType] 
            : ['template', 'active', 'history'];

        const promises = targetTypes.map(async (type) => {
            const trashId = await this.getTrashFolder(type);
            const query = `'${trashId}' in parents and trashed = false`;
            const files = await googleDriveClient.fetchAllItems(query, 'files(id)');
            return Promise.all(files.map((f: any) => googleDriveClient.deleteFile(f.id)));
        });

        await Promise.all(promises);
    }

    private async cleanupTrashLimit(trashFolderId: string) {
        try {
            const query = `'${trashFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const files = await googleDriveClient.fetchAllItems(query, 'files(id, createdTime)');
            files.sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

            if (files.length > 20) {
                const toDelete = files.slice(20); 
                const promises = toDelete.map((f: any) => googleDriveClient.deleteFile(f.id));
                await Promise.all(promises);
            }
        } catch (e) {
            console.warn("Trash cleanup failed", e);
        }
    }
}

export const googleDriveService = new GoogleDriveService();
export type { CloudFile, CloudResourceType };