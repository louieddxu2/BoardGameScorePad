
import { googleAuth } from './cloud/googleAuth';
import { googleDriveClient } from './cloud/googleDriveClient';
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { imageService } from './imageService';
import { CloudFile } from './cloud/types';

export type { CloudFile };
export type CloudResourceType = 'template' | 'active' | 'history';

const FOLDER_NAMES = {
    ROOT: 'BoardGameScorePad_Data',
    TEMPLATES: '_Templates',
    ACTIVE: '_Active',
    HISTORY: '_History'
};

class GoogleDriveService {
    private rootFolderId: string | null = null;
    private templatesFolderId: string | null = null;
    private activeFolderId: string | null = null;
    private historyFolderId: string | null = null;

    get isAuthorized() {
        return googleAuth.isAuthorized;
    }

    async signIn() {
        return await googleAuth.signIn();
    }

    async signOut() {
        return await googleAuth.signOut();
    }

    async ensureAppStructure() {
        if (this.rootFolderId && this.templatesFolderId && this.activeFolderId && this.historyFolderId) return;

        // Find or create Root
        let root = await googleDriveClient.findFile(FOLDER_NAMES.ROOT, 'root', 'application/vnd.google-apps.folder');
        if (!root) {
            root = await googleDriveClient.createFolder(FOLDER_NAMES.ROOT);
        }
        this.rootFolderId = root.id;

        // Find or create Subfolders
        const ensureSubFolder = async (name: string) => {
            let folder = await googleDriveClient.findFile(name, this.rootFolderId!, 'application/vnd.google-apps.folder');
            if (!folder) {
                folder = await googleDriveClient.createFolder(name, this.rootFolderId!);
            }
            return folder.id;
        };

        this.templatesFolderId = await ensureSubFolder(FOLDER_NAMES.TEMPLATES);
        this.activeFolderId = await ensureSubFolder(FOLDER_NAMES.ACTIVE);
        this.historyFolderId = await ensureSubFolder(FOLDER_NAMES.HISTORY);
    }

    private async backupPhotos(folderId: string, photoIds: string[] | undefined, existingCloudMap: Record<string, string> | undefined): Promise<Record<string, string>> {
        const cloudMap: Record<string, string> = existingCloudMap ? { ...existingCloudMap } : {};
        if (!photoIds || photoIds.length === 0) return cloudMap;

        // 1. Upload missing photos
        for (const pid of photoIds) {
            if (!cloudMap[pid]) {
                const localImg = await imageService.getImage(pid);
                if (localImg) {
                    const uploaded = await googleDriveClient.uploadFileToFolder(folderId, `photo_${pid}.jpg`, localImg.mimeType, localImg.blob);
                    cloudMap[pid] = uploaded.id;
                }
            }
        }
        
        return cloudMap;
    }

    public async backupTemplate(template: GameTemplate): Promise<GameTemplate> {
        if (!this.isAuthorized) await this.signIn();
        await this.ensureAppStructure();
        if (!this.templatesFolderId) throw new Error("Templates folder not found");

        const targetFolderName = `${template.name}_${template.id}`;
        
        // 1. Find or Create Folder for this Template
        let folder = await googleDriveClient.findFile(targetFolderName, this.templatesFolderId, 'application/vnd.google-apps.folder');
        if (!folder) {
            folder = await googleDriveClient.createFolder(targetFolderName, this.templatesFolderId);
        }
        
        const folderId = folder.id;
        
        // 2. Upload Image if exists
        let cloudImageId = template.cloudImageId;
        if (template.imageId) {
            const img = await imageService.getImage(template.imageId);
            if (img) {
                const uploadedImg = await googleDriveClient.uploadFileToFolder(folderId, 'background.jpg', img.mimeType, img.blob);
                cloudImageId = uploadedImg.id;
            }
        }

        // 3. Upload JSON
        const templateToSave = { ...template, cloudImageId, lastSyncedAt: Date.now() };
        const jsonContent = JSON.stringify(templateToSave, null, 2);
        
        const uploadedJson = await googleDriveClient.uploadFileToFolder(folderId, 'template.json', 'application/json', jsonContent);
        
        // 4. Update Folder Metadata (Timestamp for Sync)
        await googleDriveClient.updateFileMetadata(folderId, {
            appProperties: { originalUpdatedAt: String(template.updatedAt || Date.now()) }
        });

        return templateToSave;
    }

    public async backupActiveSession(session: GameSession, templateName: string, knownFolderId?: string, existingFolderName?: string): Promise<string> {
        if (!this.isAuthorized) await this.signIn();
        await this.ensureAppStructure();
        if (!this.activeFolderId) throw new Error("Active folder not found");

        const targetFolderName = `${templateName.trim()}_${session.id}`;
        let folderId = knownFolderId;

        if (!folderId) {
            let folder = await googleDriveClient.findFile(targetFolderName, this.activeFolderId, 'application/vnd.google-apps.folder');
            if (!folder) {
                folder = await googleDriveClient.createFolder(targetFolderName, this.activeFolderId);
            }
            folderId = folder.id;
        } else {
            if (existingFolderName && existingFolderName !== targetFolderName) {
                await googleDriveClient.updateFileMetadata(folderId, { name: targetFolderName });
            }
        }

        // Backup Photos and Get Updated Map
        const updatedCloudMap = await this.backupPhotos(folderId, session.photos, session.photoCloudIds);
        
        // Update session with the new map before saving JSON
        const sessionToSave = { ...session, photoCloudIds: updatedCloudMap };

        const jsonContent = JSON.stringify(sessionToSave, null, 2);
        await googleDriveClient.uploadFileToFolder(folderId, 'session.json', 'application/json', jsonContent);
        
        // Use session.updatedAt for sync comparison
        const timestamp = session.updatedAt || Date.now();
        
        await googleDriveClient.updateFileMetadata(folderId, {
            appProperties: { originalUpdatedAt: String(timestamp) }
        });
        
        return folderId;
    }

    public async createActiveSessionFolder(templateName: string, sessionId: string): Promise<string> {
        if (!this.isAuthorized) await this.signIn();
        await this.ensureAppStructure();
        if (!this.activeFolderId) throw new Error("Active folder not found");
        
        const targetFolderName = `${templateName.trim()}_${sessionId}`;
        const folder = await googleDriveClient.createFolder(targetFolderName, this.activeFolderId);
        return folder.id;
    }

    public async backupHistoryRecord(record: HistoryRecord, knownFolderId?: string): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        await this.ensureAppStructure();
        
        if (!knownFolderId) {
             if (!this.historyFolderId) throw new Error("History folder not found");
             const folderName = `${record.gameName.trim()}_${record.id}`;
             const folder = await googleDriveClient.createFolder(folderName, this.historyFolderId);
             knownFolderId = folder.id;
        }

        // Backup Photos
        const updatedCloudMap = await this.backupPhotos(knownFolderId, record.photos, record.photoCloudIds);
        const recordToSave = { ...record, photoCloudIds: updatedCloudMap };

        const jsonContent = JSON.stringify(recordToSave, null, 2);
        await googleDriveClient.uploadFileToFolder(knownFolderId, 'record.json', 'application/json', jsonContent);
        
        await googleDriveClient.updateFileMetadata(knownFolderId, {
            appProperties: { originalUpdatedAt: String(record.endTime) }
        });
    }

    public async moveSessionToHistory(folderId: string): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        await this.ensureAppStructure();
        if (!this.activeFolderId || !this.historyFolderId) throw new Error("Folders not found");
        
        await googleDriveClient.moveFile(folderId, this.activeFolderId, this.historyFolderId);
    }

    public async softDeleteFolder(folderId: string, type: CloudResourceType): Promise<void> {
        if (!this.isAuthorized) await this.signIn();
        await googleDriveClient.deleteFile(folderId);
    }

    public async getFileList(mode: 'active' | 'trash', source: CloudResourceType): Promise<CloudFile[]> {
        if (!this.isAuthorized) await this.signIn();
        await this.ensureAppStructure();
        
        let parentId: string | null = null;
        if (source === 'template') parentId = this.templatesFolderId;
        else if (source === 'active') parentId = this.activeFolderId;
        else if (source === 'history') parentId = this.historyFolderId;
        
        if (!parentId) return [];

        const query = mode === 'active' 
            ? `'${parentId}' in parents and trashed = false`
            : `'${parentId}' in parents and trashed = true`;
            
        return await googleDriveClient.fetchAllItems(query, 'files(id, name, createdTime, appProperties)');
    }
}

export const googleDriveService = new GoogleDriveService();
