
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { googleAuth } from './cloud/googleAuth';
import { googleDriveClient } from './cloud/googleDriveClient';
import { CloudFile, CloudResourceType } from './cloud/types';
import { imageService } from './imageService';

export type { CloudFile, CloudResourceType };

class GoogleDriveService {
  
  // Folder ID Cache
  private appRootId: string | null = null;
  private trashIds: Record<CloudResourceType, string | null> = {
      template: null,
      active: null,
      history: null
  };
  
  public systemFolderId: string | null = null;
  public activeFolderId: string | null = null;
  public historyFolderId: string | null = null;
  public templatesFolderId: string | null = null;

  public get isAuthorized(): boolean {
    return googleAuth.isAuthorized;
  }

  public async signIn(options: { prompt?: string } = {}): Promise<string> {
      return googleAuth.signIn(options);
  }

  public async signOut(): Promise<void> {
      await googleAuth.signOut();
      // Clear Cache
      this.appRootId = null;
      this.trashIds = { template: null, active: null, history: null };
      this.systemFolderId = null;
      this.activeFolderId = null;
      this.historyFolderId = null;
      this.templatesFolderId = null;
  }

  // --- Folder Management ---

  private async getAppRoot(): Promise<string> {
      if (this.appRootId) return this.appRootId;
      let root = await googleDriveClient.findFile('BoardGameScorePad', 'root', 'application/vnd.google-apps.folder');
      if (!root) root = await googleDriveClient.createFolder('BoardGameScorePad');
      this.appRootId = root.id;
      return root.id;
  }

  private async getTrashFolder(type: CloudResourceType): Promise<string> {
      if (this.trashIds[type]) return this.trashIds[type]!;

      const rootId = await this.getAppRoot();
      
      let folderName = '_Trash'; 
      if (type === 'template') folderName = '_Trash_Templates';
      if (type === 'active') folderName = '_Trash_Active';
      if (type === 'history') folderName = '_Trash_History';
      
      let trash = await googleDriveClient.findFile(folderName, rootId, 'application/vnd.google-apps.folder');
      if (!trash) trash = await googleDriveClient.createFolder(folderName, rootId);
      
      this.trashIds[type] = trash.id;
      return trash.id;
  }

  public async ensureAppStructure(): Promise<void> {
      if (this.systemFolderId && this.activeFolderId && this.historyFolderId && this.templatesFolderId) return;
      if (!this.isAuthorized) await this.signIn();

      const rootId = await this.getAppRoot();
      
      const folders = ['_System', '_Active', '_History', '_Templates'];
      const results = await Promise.all(folders.map(async name => {
          let folder = await googleDriveClient.findFile(name, rootId, 'application/vnd.google-apps.folder');
          if (!folder) folder = await googleDriveClient.createFolder(name, rootId);
          return { name, id: folder.id };
      }));

      results.forEach(r => {
          if (r.name === '_System') this.systemFolderId = r.id;
          if (r.name === '_Active') this.activeFolderId = r.id;
          if (r.name === '_History') this.historyFolderId = r.id;
          if (r.name === '_Templates') this.templatesFolderId = r.id;
      });
  }

  // --- App Business Logic ---

  public async listFiles(mode: 'active' | 'trash' = 'active', source: 'templates' | 'sessions' | 'history' = 'templates'): Promise<CloudFile[]> {
    if (!this.isAuthorized) await this.signIn();
    await this.ensureAppStructure();
    
    let targetType: CloudResourceType = 'template';
    if (source === 'sessions') targetType = 'active';
    if (source === 'history') targetType = 'history';

    let parentId;
    if (mode === 'trash') {
        parentId = await this.getTrashFolder(targetType);
    } else {
        if (targetType === 'active') parentId = this.activeFolderId;
        else if (targetType === 'history') parentId = this.historyFolderId;
        else parentId = this.templatesFolderId || await this.getAppRoot();
    }

    if (!parentId) return [];

    let query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (mode === 'active' && targetType === 'template') {
        query += ` and name != '_Trash_Templates' and name != '_Trash_Active' and name != '_Trash_History' and name != '_Trash' and name != '_System' and name != '_Active' and name != '_History' and name != '_Templates'`; 
    }

    return googleDriveClient.fetchAllItems(query, 'files(id, name, createdTime, appProperties)');
  }

  public async listFoldersInParent(parentId: string): Promise<CloudFile[]> {
      const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      return googleDriveClient.fetchAllItems(query, 'files(id, name, createdTime, appProperties)');
  }

  /**
   * Helper: Backup Photos for Session/History
   * 1. Uploads missing photos and collects their Cloud IDs.
   * 2. Cleans up stale photos (files in cloud that are not in the current list).
   * Returns the updated photoCloudIds map.
   */
  private async backupPhotos(
      folderId: string, 
      photoIds: string[] | undefined, 
      existingCloudIds: Record<string, string> | undefined
  ): Promise<Record<string, string>> {
      const resultCloudIds: Record<string, string> = { ...(existingCloudIds || {}) };
      const validPhotoIds = new Set(photoIds || []);

      if (!photoIds || photoIds.length === 0) {
          // If no photos, we should still perform cleanup if there are any existing ones
          // But we need to list files first.
      }

      // 1. Upload Missing Photos & Capture IDs
      for (const photoId of photoIds || []) {
          // If we already have a Cloud ID for this photo, assume it's good (optimization)
          if (resultCloudIds[photoId]) continue;

          try {
              const localImg = await imageService.getImage(photoId);
              if (localImg && localImg.blob) {
                  const mimeType = localImg.mimeType || 'image/jpeg';
                  const filename = `${photoId}.jpg`;
                  
                  // Note: uploadFileToFolder performs a find-or-create logic
                  const uploadedFile = await googleDriveClient.uploadFileToFolder(folderId, filename, mimeType, localImg.blob);
                  
                  if (uploadedFile && uploadedFile.id) {
                      resultCloudIds[photoId] = uploadedFile.id;
                  }
              }
          } catch (e) {
              console.warn(`Failed to upload photo ${photoId}`, e);
          }
      }

      // 2. Cleanup Stale Photos (Hygiene)
      // We list ALL files in the folder to ensure we don't leave orphans.
      // This listing is acceptable during backup (write op) to save storage.
      try {
          const cloudFiles = await googleDriveClient.fetchAllItems(
              `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`, 
              'files(id, name)'
          );

          // Protected files that shouldn't be deleted
          const protectedFiles = new Set(['data.json', 'session.json', 'background.jpg']);

          for (const file of cloudFiles) {
              if (protectedFiles.has(file.name)) continue;

              // Check if it's an image associated with this session
              if (file.name.endsWith('.jpg')) {
                  const uuid = file.name.replace('.jpg', '');
                  
                  // If this UUID is NOT in our valid list, delete it
                  if (!validPhotoIds.has(uuid)) {
                      await googleDriveClient.deleteFile(file.id);
                      // Also remove from result map if present
                      delete resultCloudIds[uuid];
                  } else {
                      // If it IS valid, ensure it's in our map (healing self-repair)
                      if (!resultCloudIds[uuid]) {
                          resultCloudIds[uuid] = file.id;
                      }
                  }
              }
          }
      } catch (e) {
          console.warn("Failed to cleanup stale session photos", e);
      }

      return resultCloudIds;
  }

  /**
   * Helper: Restore Photos for Session/History
   * Uses `photoCloudIds` map for direct access (O(1)) instead of searching.
   */
  private async restorePhotos(
      photoIds: string[] | undefined, 
      photoCloudIds: Record<string, string> | undefined,
      relatedId: string
  ) {
      if (!photoIds || photoIds.length === 0) return;
      if (!photoCloudIds) return; // Cannot restore efficiently without map

      for (const photoId of photoIds) {
          // 1. Check if exists locally
          const exists = await imageService.getImage(photoId);
          if (exists) continue;

          // 2. Direct download using ID from map
          const fileId = photoCloudIds[photoId];
          if (fileId) {
              try {
                  const blob = await googleDriveClient.downloadBlob(fileId);
                  // Save with forced ID to match the JSON record
                  await imageService.saveImage(blob, relatedId, 'session', photoId);
              } catch (e) {
                  console.warn(`Failed to restore photo ${photoId} using ID ${fileId}`, e);
              }
          } else {
              console.warn(`No cloud ID found for photo ${photoId}`);
          }
      }
  }

  /**
   * Smart Restore for Game Template
   */
  public async restoreTemplate(folderId: string): Promise<GameTemplate> {
      if (!this.isAuthorized) await this.signIn();
      
      const template = await this.getFileContent(folderId, 'data.json');
      
      if (template.imageId) {
          const localImage = await imageService.getImage(template.imageId);
          
          if (localImage) {
              template.hasImage = true;
          } else {
              const imageFileId = template.cloudImageId;
              if (imageFileId) {
                  try {
                      const blob = await googleDriveClient.downloadBlob(imageFileId);
                      await imageService.saveImage(blob, template.id, 'template', template.imageId);
                      template.hasImage = true;
                  } catch (e) {
                      console.warn(`[Smart Hydration] Failed to download image ${imageFileId}`, e);
                  }
              }
          }
      }
      return template;
  }

  public async backupTemplate(template: GameTemplate, _unused?: any, knownFolderId?: string, existingFolderName?: string): Promise<GameTemplate> {
    if (!this.isAuthorized) await this.signIn();
    await this.ensureAppStructure();
    const parentId = this.templatesFolderId || await this.getAppRoot();

    const targetFolderName = `${template.name.trim()}_${template.id}`;
    let gameFolderId = knownFolderId;

    if (!gameFolderId) {
        let gameFolder = await googleDriveClient.findFile(targetFolderName, parentId, 'application/vnd.google-apps.folder');
        if (!gameFolder) {
            gameFolder = await googleDriveClient.createFolder(targetFolderName, parentId);
        }
        gameFolderId = gameFolder.id;
    } else {
        if (existingFolderName && existingFolderName !== targetFolderName) {
            await googleDriveClient.updateFileMetadata(gameFolderId, { name: targetFolderName });
        }
    }

    let uploadedImageId = template.cloudImageId;
    
    // [CLEANUP & UPLOAD] Handle Background Image
    if (template.imageId) {
        try {
            const currentFilename = `${template.imageId}.jpg`;
            
            // 1. List all JPGs in the folder to identify orphans
            const existingFiles = await googleDriveClient.fetchAllItems(`'${gameFolderId}' in parents and mimeType contains 'image/' and trashed = false`, 'files(id, name)');
            
            let alreadyExists = false;

            // 2. Delete old images that don't match current ID
            // Also clean up legacy 'background.jpg' if a new UUID image is taking over
            for (const file of existingFiles) {
                if (file.name !== currentFilename) {
                    // It's an old uuid.jpg or legacy background.jpg, delete it
                    await googleDriveClient.deleteFile(file.id);
                } else {
                    alreadyExists = true;
                    uploadedImageId = file.id;
                }
            }

            // 3. Upload new image if missing
            if (!alreadyExists) {
                const localImg = await imageService.getImage(template.imageId);
                if (localImg && localImg.blob) {
                     const mimeType = localImg.mimeType || 'image/jpeg';
                     const uploadedFile = await googleDriveClient.uploadFileToFolder(gameFolderId, currentFilename, mimeType, localImg.blob);
                     uploadedImageId = uploadedFile.id;
                }
            }
        } catch (e) {
            console.warn("Failed to manage template background image", e);
        }
    } else {
        // If template has NO image, but folder has images, clean them up
        try {
            const existingFiles = await googleDriveClient.fetchAllItems(`'${gameFolderId}' in parents and mimeType contains 'image/' and trashed = false`, 'files(id, name)');
            for (const file of existingFiles) {
                await googleDriveClient.deleteFile(file.id);
            }
            uploadedImageId = undefined;
        } catch (e) {
            console.warn("Failed to cleanup old images", e);
        }
    }

    const updatedTemplate = { ...template, cloudImageId: uploadedImageId };
    const jsonContent = JSON.stringify(updatedTemplate, null, 2);
    await googleDriveClient.uploadFileToFolder(gameFolderId, 'data.json', 'application/json', jsonContent);

    if (template.updatedAt) {
        await googleDriveClient.updateFileMetadata(gameFolderId, {
            appProperties: { originalUpdatedAt: String(template.updatedAt) }
        });
    }

    return updatedTemplate;
  }

  public async backupHistoryRecord(record: HistoryRecord, knownFolderId?: string, existingFolderName?: string): Promise<string> {
      if (!this.isAuthorized) await this.signIn();
      await this.ensureAppStructure();
      if (!this.historyFolderId) throw new Error("History folder not found");

      const targetFolderName = `${record.gameName.trim()}_${record.id}`;
      let folderId = knownFolderId;

      if (!folderId) {
          let folder = await googleDriveClient.findFile(targetFolderName, this.historyFolderId, 'application/vnd.google-apps.folder');
          if (!folder) {
              folder = await googleDriveClient.createFolder(targetFolderName, this.historyFolderId);
          }
          folderId = folder.id;
      } else {
          if (existingFolderName && existingFolderName !== targetFolderName) {
              await googleDriveClient.updateFileMetadata(folderId, { name: targetFolderName });
          }
      }

      // [NEW] Backup Photos and Get Updated Map
      const updatedCloudMap = await this.backupPhotos(folderId, record.photos, record.photoCloudIds);
      
      // Update record with the new map before saving JSON
      const recordToSave = { ...record, photoCloudIds: updatedCloudMap };

      const jsonContent = JSON.stringify(recordToSave, null, 2);
      await googleDriveClient.uploadFileToFolder(folderId, 'session.json', 'application/json', jsonContent);
      
      await googleDriveClient.updateFileMetadata(folderId, {
          appProperties: { originalUpdatedAt: String(record.endTime) }
      });

      return folderId;
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

      // [NEW] Backup Photos and Get Updated Map
      const updatedCloudMap = await this.backupPhotos(folderId, session.photos, session.photoCloudIds);
      
      // Update session with the new map before saving JSON
      const sessionToSave = { ...session, photoCloudIds: updatedCloudMap };

      const jsonContent = JSON.stringify(sessionToSave, null, 2);
      await googleDriveClient.uploadFileToFolder(folderId, 'session.json', 'application/json', jsonContent);
      
      await googleDriveClient.updateFileMetadata(folderId, {
          appProperties: { originalUpdatedAt: String(Date.now()) }
      });
      
      return folderId;
  }

  // --- Utility Methods ---

  public async saveSystemData(filename: string, data: any): Promise<void> {
      await this.ensureAppStructure();
      if (!this.systemFolderId) throw new Error("System folder not found");
      const jsonContent = JSON.stringify(data, null, 2);
      await googleDriveClient.uploadFileToFolder(this.systemFolderId, filename, 'application/json', jsonContent);
  }

  public async createActiveSessionFolder(sessionName: string, sessionId: string): Promise<string> {
      await this.ensureAppStructure();
      if (!this.activeFolderId) throw new Error("Active folder not found");
      const folderName = `${sessionName.trim()}_${sessionId}`;
      let folder = await googleDriveClient.findFile(folderName, this.activeFolderId, 'application/vnd.google-apps.folder');
      if (!folder) folder = await googleDriveClient.createFolder(folderName, this.activeFolderId);
      return folder.id;
  }

  public async uploadFileToFolder(folderId: string, name: string, mimeType: string, body: string): Promise<void> {
      await googleDriveClient.uploadFileToFolder(folderId, name, mimeType, body);
  }

  public async moveSessionToHistory(sessionFolderId: string): Promise<void> {
      await this.ensureAppStructure();
      if (!this.activeFolderId || !this.historyFolderId) throw new Error("Directories not initialized");
      await googleDriveClient.moveFile(sessionFolderId, this.activeFolderId, this.historyFolderId);
  }

  public async softDeleteFolder(folderId: string, type: CloudResourceType): Promise<void> {
      if (!this.isAuthorized) return; 
      await this.ensureAppStructure();
      
      let sourceParentId;
      if (type === 'active') sourceParentId = this.activeFolderId;
      else if (type === 'history') sourceParentId = this.historyFolderId;
      else sourceParentId = this.templatesFolderId || this.appRootId;

      const trashId = await this.getTrashFolder(type);

      if (sourceParentId) {
          await googleDriveClient.moveFile(folderId, sourceParentId, trashId);
          this.cleanupTrashLimit(trashId);
      }
  }

  public async restoreFolder(folderId: string, type: CloudResourceType): Promise<void> {
      if (!this.isAuthorized) await this.signIn();
      await this.ensureAppStructure();
      
      let targetParentId;
      if (type === 'active') targetParentId = this.activeFolderId;
      else if (type === 'history') targetParentId = this.historyFolderId;
      else targetParentId = this.templatesFolderId || await this.getAppRoot();
      
      const trashId = await this.getTrashFolder(type);
      
      if (targetParentId) {
          await googleDriveClient.moveFile(folderId, trashId, targetParentId);
      }
  }

  public async deleteFile(fileId: string): Promise<boolean> {
      await googleDriveClient.deleteFile(fileId);
      return true;
  }

  public async emptyTrash(): Promise<void> {
      if (!this.isAuthorized) await this.signIn();
      const trashTempId = await this.getTrashFolder('template');
      const trashActiveId = await this.getTrashFolder('active');
      const trashHistoryId = await this.getTrashFolder('history');
      
      const idsToCheck = Array.from(new Set([trashTempId, trashActiveId, trashHistoryId]));

      const promises = idsToCheck.map(async (trashId) => {
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

          if (files.length > 100) {
              const toDelete = files.slice(100); 
              const promises = toDelete.map((f: any) => googleDriveClient.deleteFile(f.id));
              await Promise.all(promises);
          }
      } catch (e) {
          console.warn("Trash cleanup failed", e);
      }
  }

  public async getFileContent(folderId: string, filename: string = 'data.json'): Promise<any> {
      if (!this.isAuthorized) await this.signIn();
      const file = await googleDriveClient.findFile(filename, folderId, 'application/json');
      if (!file) throw new Error(`此備份中找不到 ${filename}`);

      const data = await googleDriveClient.downloadFile(file.id);

      // --- Enhanced Restore Logic for Session/History Photos ---
      // We check for `photos` array AND `photoCloudIds` in the JSON and restore them if needed
      if (data.id && (filename === 'session.json')) {
          await this.restorePhotos(data.photos, data.photoCloudIds, data.id);
      }

      if (filename === 'data.json') {
          if (!data.cloudImageId) {
              if (data.imageId) {
                  const uuidFile = await googleDriveClient.findFile(`${data.imageId}.jpg`, folderId);
                  if (uuidFile) {
                      data.cloudImageId = uuidFile.id;
                  }
              }
              if (!data.cloudImageId) {
                  const bgFile = await googleDriveClient.findFile('background.jpg', folderId);
                  if (bgFile) {
                      data.cloudImageId = bgFile.id;
                  }
              }
          }
      }
      return data;
  }

  public async downloadImage(fileId: string): Promise<Blob> {
      if (!this.isAuthorized) await this.signIn();
      return await googleDriveClient.downloadBlob(fileId);
  }
}

export const googleDriveService = new GoogleDriveService();
