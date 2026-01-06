
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config';
import { GameTemplate, GameSession, HistoryRecord } from '../types';

// Types for Google API
declare global {
  interface Window {
    google: any;
  }
}

export interface CloudFile {
  id: string;
  name: string;
  createdTime: string; // ISO string
  appProperties?: { [key: string]: string }; // [New] Custom metadata
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  appProperties?: { [key: string]: string };
}

// Convert Base64 to Blob for uploading
const base64ToBlob = (base64: string, mimeType: string = 'image/jpeg'): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

// Define explicit types for resource management
export type CloudResourceType = 'template' | 'active' | 'history';

class GoogleDriveService {
  private tokenClient: any;
  private accessToken: string | null = null;
  private tokenExpiration: number = 0;
  
  // Folder ID Cache
  private appRootId: string | null = null;
  
  // [Changed] Dedicated Trash Folders
  private trashTemplatesId: string | null = null;
  private trashActiveId: string | null = null;
  private trashHistoryId: string | null = null;
  
  public systemFolderId: string | null = null; // Made public for bulk ops
  public activeFolderId: string | null = null; // Made public for bulk ops
  public historyFolderId: string | null = null; // Made public for bulk ops
  public templatesFolderId: string | null = null; // Made public for bulk ops

  constructor() {
    this.loadScripts();
  }

  private loadScripts() {
    // 避免重複載入
    if (document.getElementById('gsi-script')) {
        this.initTokenClient();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'gsi-script';
    script.async = true;
    script.defer = true;
    script.onload = () => { this.initTokenClient(); };
    document.body.appendChild(script);
  }

  private initTokenClient() {
    if (window.google && window.google.accounts && !this.tokenClient) {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID.trim(),
            scope: GOOGLE_SCOPES,
            callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
                this.accessToken = tokenResponse.access_token;
                this.tokenExpiration = Date.now() + (tokenResponse.expires_in * 1000);
            }
            },
        });
      } catch (e) {
          console.error("GSI Init Error:", e);
      }
    }
  }

  public get isAuthorized(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiration;
  }

  // 支援傳入 options，例如 { prompt: 'none' } 用於靜默登入
  public async signIn(options: { prompt?: string } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      // 確保 client 已初始化
      if (!this.tokenClient) {
        this.initTokenClient();
        if(!this.tokenClient) return reject(new Error('Google Identity Services script not loaded yet. Please try again.'));
      }

      // 覆寫 callback 以捕捉這次請求的結果
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
            // 處理靜默登入失敗 (需要互動)
            if (resp.error === 'interaction_required' || resp.error === 'popup_closed_by_user') {
                reject(resp);
            } else {
                reject(resp);
            }
        } else {
          this.accessToken = resp.access_token;
          this.tokenExpiration = Date.now() + (resp.expires_in * 1000);
          resolve(this.accessToken!);
        }
      };

      // 觸發登入彈窗或靜默請求
      // prompt: '' (default) or 'none' (silent) or 'select_account'
      this.tokenClient.requestAccessToken({ prompt: options.prompt ?? '' });
    });
  }

  public async signOut(): Promise<void> {
      if (this.accessToken && window.google && window.google.accounts) {
          try {
              window.google.accounts.oauth2.revoke(this.accessToken, () => {
                  console.log('Access token revoked');
              });
          } catch (e) {
              console.warn('Revoke failed', e);
          }
      }
      this.accessToken = null;
      this.tokenExpiration = 0;
      // Clear Cache
      this.appRootId = null;
      this.trashTemplatesId = null;
      this.trashActiveId = null;
      this.trashHistoryId = null;
      this.systemFolderId = null;
      this.activeFolderId = null;
      this.historyFolderId = null;
      this.templatesFolderId = null;
  }

  private async fetchDrive(url: string, options: RequestInit = {}) {
    if (!this.isAuthorized) {
        throw new Error('Unauthorized'); // Can catch this to trigger re-auth
    }
    
    const headers = { 
        'Authorization': `Bearer ${this.accessToken}`, 
        ...options.headers 
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // 拋出包含 status 的錯誤，方便上層判斷是否為 401/403
        const error: any = new Error(err.error?.message || `Drive API Error: ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
  }

  // --- Folder Structure Helpers ---

  private async getAppRoot(): Promise<string> {
      if (this.appRootId) return this.appRootId;
      let root = await this.findFile('BoardGameScorePad', 'root', 'application/vnd.google-apps.folder');
      if (!root) root = await this.createFolder('BoardGameScorePad');
      this.appRootId = root.id;
      return root.id;
  }

  // [Changed] Dedicated Trash Folders for strict separation
  private async getTrashFolder(type: CloudResourceType): Promise<string> {
      if (type === 'template' && this.trashTemplatesId) return this.trashTemplatesId;
      if (type === 'active' && this.trashActiveId) return this.trashActiveId;
      if (type === 'history' && this.trashHistoryId) return this.trashHistoryId;

      const rootId = await this.getAppRoot();
      
      let folderName = '_Trash'; // Fallback
      if (type === 'template') folderName = '_Trash_Templates';
      if (type === 'active') folderName = '_Trash_Active';
      if (type === 'history') folderName = '_Trash_History';
      
      let trash = await this.findFile(folderName, rootId, 'application/vnd.google-apps.folder');
      if (!trash) trash = await this.createFolder(folderName, rootId);
      
      if (type === 'template') this.trashTemplatesId = trash.id;
      if (type === 'active') this.trashActiveId = trash.id;
      if (type === 'history') this.trashHistoryId = trash.id;
      
      return trash.id;
  }

  /**
   * Initializes and caches the core subfolders
   */
  public async ensureAppStructure(): Promise<void> {
      if (this.systemFolderId && this.activeFolderId && this.historyFolderId && this.templatesFolderId) return;
      if (!this.isAuthorized) await this.signIn();

      const rootId = await this.getAppRoot();
      
      // We don't init trash here, do it on demand
      const folders = ['_System', '_Active', '_History', '_Templates'];
      
      const results = await Promise.all(folders.map(async name => {
          let folder = await this.findFile(name, rootId, 'application/vnd.google-apps.folder');
          if (!folder) folder = await this.createFolder(name, rootId);
          return { name, id: folder.id };
      }));

      results.forEach(r => {
          if (r.name === '_System') this.systemFolderId = r.id;
          if (r.name === '_Active') this.activeFolderId = r.id;
          if (r.name === '_History') this.historyFolderId = r.id;
          if (r.name === '_Templates') this.templatesFolderId = r.id;
      });
  }

  // --- Core File Operations ---

  // [Helper] Generic fetch all items with pagination
  private async fetchAllItems(query: string, fields: string): Promise<CloudFile[]> {
      let allFiles: CloudFile[] = [];
      let pageToken: string | null = null;
      
      do {
          const url: string = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1000&fields=nextPageToken,${fields}${pageToken ? `&pageToken=${pageToken}` : ''}`;
          const data: any = await this.fetchDrive(url);
          
          if (data.files) {
              allFiles = allFiles.concat(data.files);
          }
          pageToken = data.nextPageToken || null;
      } while (pageToken);

      return allFiles;
  }

  // [Updated] Include appProperties in the fields AND handle pagination
  public async listFoldersInParent(parentId: string): Promise<CloudFile[]> {
      const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      // Fetch 'appProperties' to check sync status
      return this.fetchAllItems(query, 'files(id, name, createdTime, appProperties)');
  }

  private async findFile(name: string, parentId: string = 'root', mimeType?: string): Promise<DriveFile | null> {
    let query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    if (mimeType) query += ` and mimeType = '${mimeType}'`;
    
    // findFile usually expects 1 result, pagination typically not needed unless user has dupes
    const data = await this.fetchDrive(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, parents)`
    );
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  private async createFolder(name: string, parentId: string = 'root'): Promise<DriveFile> {
    const metadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] };
    return this.fetchDrive('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
  }

  // [New] Update file/folder metadata (e.g. appProperties)
  public async updateFileMetadata(fileId: string, metadata: any): Promise<void> {
      await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata)
      });
  }

  // [New] Rename Folder/File
  public async renameFile(fileId: string, newName: string): Promise<void> {
      await this.updateFileMetadata(fileId, { name: newName });
  }

  public async uploadFileToFolder(folderId: string, name: string, mimeType: string, body: Blob | string): Promise<DriveFile> {
    const existing = await this.findFile(name, folderId, mimeType);
    
    const metadata = { 
        name, 
        mimeType, 
        parents: existing ? undefined : [folderId] 
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    const contentBlob = typeof body === 'string' ? new Blob([body], { type: mimeType }) : body;
    form.append('file', contentBlob);

    const method = existing ? 'PATCH' : 'POST';
    const endpoint = existing 
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form,
    });
    
    if (!response.ok) throw new Error('File upload failed');
    return response.json();
  }

  private async moveFile(fileId: string, previousParentId: string, newParentId: string): Promise<void> {
      await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${previousParentId}`, {
          method: 'PATCH'
      });
  }

  public async deleteFile(fileId: string): Promise<void> {
    if (!this.isAuthorized) await this.signIn();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    if (!response.ok && response.status !== 204) {
        throw new Error("刪除失敗");
    }
  }

  // --- Specialized Public Methods ---

  public async saveSystemData(filename: string, data: any): Promise<void> {
      await this.ensureAppStructure();
      if (!this.systemFolderId) throw new Error("System folder not found");
      
      const jsonContent = JSON.stringify(data, null, 2);
      await this.uploadFileToFolder(this.systemFolderId, filename, 'application/json', jsonContent);
  }

  public async createActiveSessionFolder(sessionName: string, sessionId: string): Promise<string> {
      await this.ensureAppStructure();
      if (!this.activeFolderId) throw new Error("Active folder not found");

      const folderName = `${sessionName.trim()}_${sessionId}`;
      
      let folder = await this.findFile(folderName, this.activeFolderId, 'application/vnd.google-apps.folder');
      if (!folder) {
          folder = await this.createFolder(folderName, this.activeFolderId);
      }
      return folder.id;
  }

  public async moveSessionToHistory(sessionFolderId: string): Promise<void> {
      await this.ensureAppStructure();
      if (!this.activeFolderId || !this.historyFolderId) throw new Error("Directories not initialized");
      await this.moveFile(sessionFolderId, this.activeFolderId, this.historyFolderId);
  }

  // Updated: Handle metadata tagging on the Folder
  public async backupTemplate(template: GameTemplate, imageBase64?: string | null, knownFolderId?: string, existingFolderName?: string): Promise<GameTemplate> {
    if (!this.isAuthorized) await this.signIn();

    await this.ensureAppStructure();
    const parentId = this.templatesFolderId || await this.getAppRoot();

    const targetFolderName = `${template.name.trim()}_${template.id}`;
    let gameFolderId = knownFolderId;

    // If ID not provided, search for it (fallback)
    if (!gameFolderId) {
        let gameFolder = await this.findFile(targetFolderName, parentId, 'application/vnd.google-apps.folder');
        if (!gameFolder) {
            gameFolder = await this.createFolder(targetFolderName, parentId);
        }
        gameFolderId = gameFolder.id;
    } else {
        // We have an ID. Check if name matches.
        if (existingFolderName && existingFolderName !== targetFolderName) {
            await this.renameFile(gameFolderId, targetFolderName);
        }
    }

    let uploadedImageId = template.cloudImageId;
    if (imageBase64) {
        const blob = base64ToBlob(imageBase64);
        const uploadedFile = await this.uploadFileToFolder(gameFolderId, 'background.jpg', 'image/jpeg', blob);
        uploadedImageId = uploadedFile.id;
    }

    const updatedTemplate = { ...template, cloudImageId: uploadedImageId };
    const jsonContent = JSON.stringify(updatedTemplate, null, 2);
    await this.uploadFileToFolder(gameFolderId, 'data.json', 'application/json', jsonContent);

    // [New] Update Folder Metadata with updatedAt timestamp
    if (template.updatedAt) {
        await this.updateFileMetadata(gameFolderId, {
            appProperties: { originalUpdatedAt: String(template.updatedAt) }
        });
    }

    return updatedTemplate;
  }

  // Updated: Handle metadata tagging
  public async backupHistoryRecord(record: HistoryRecord, knownFolderId?: string, existingFolderName?: string): Promise<string> {
      if (!this.isAuthorized) await this.signIn();
      await this.ensureAppStructure();
      if (!this.historyFolderId) throw new Error("History folder not found");

      const targetFolderName = `${record.gameName.trim()}_${record.id}`;
      let folderId = knownFolderId;

      if (!folderId) {
          let folder = await this.findFile(targetFolderName, this.historyFolderId, 'application/vnd.google-apps.folder');
          if (!folder) {
              folder = await this.createFolder(targetFolderName, this.historyFolderId);
          }
          folderId = folder.id;
      } else {
          // Check for rename
          if (existingFolderName && existingFolderName !== targetFolderName) {
              await this.renameFile(folderId, targetFolderName);
          }
      }

      const jsonContent = JSON.stringify(record, null, 2);
      await this.uploadFileToFolder(folderId, 'session.json', 'application/json', jsonContent);
      
      // [New] History usually doesn't update, but if we edit notes/location, endTime is the "version"
      // Use endTime as the version stamp
      await this.updateFileMetadata(folderId, {
          appProperties: { originalUpdatedAt: String(record.endTime) }
      });

      return folderId;
  }

  // [New] Backup Active Session
  public async backupActiveSession(session: GameSession, templateName: string, knownFolderId?: string, existingFolderName?: string): Promise<string> {
      if (!this.isAuthorized) await this.signIn();
      await this.ensureAppStructure();
      if (!this.activeFolderId) throw new Error("Active folder not found");

      const targetFolderName = `${templateName.trim()}_${session.id}`;
      let folderId = knownFolderId;

      if (!folderId) {
          let folder = await this.findFile(targetFolderName, this.activeFolderId, 'application/vnd.google-apps.folder');
          if (!folder) {
              folder = await this.createFolder(targetFolderName, this.activeFolderId);
          }
          folderId = folder.id;
      } else {
          if (existingFolderName && existingFolderName !== targetFolderName) {
              await this.renameFile(folderId, targetFolderName);
          }
      }

      const jsonContent = JSON.stringify(session, null, 2);
      await this.uploadFileToFolder(folderId, 'session.json', 'application/json', jsonContent);
      
      // [New] Use startTime as a proxy for ID, but active sessions change constantly.
      // We can use a generated timestamp or just current time since active sessions are always "latest".
      // But better to use something deterministic if available.
      // Let's use Date.now() since active session state is volatile.
      await this.updateFileMetadata(folderId, {
          appProperties: { originalUpdatedAt: String(Date.now()) }
      });
      
      return folderId;
  }

  // [Update] List files based on source with Pagination Support
  public async listFiles(mode: 'active' | 'trash' = 'active', source: 'templates' | 'sessions' | 'history' = 'templates'): Promise<CloudFile[]> {
    if (!this.isAuthorized) await this.signIn();
    
    await this.ensureAppStructure();
    
    // Determine target resource type logic
    let targetType: CloudResourceType = 'template';
    if (source === 'sessions') targetType = 'active';
    if (source === 'history') targetType = 'history';

    // Determine Parent Folder
    let parentId;
    if (mode === 'trash') {
        parentId = await this.getTrashFolder(targetType);
    } else {
        if (targetType === 'active') {
            parentId = this.activeFolderId;
        } else if (targetType === 'history') {
            parentId = this.historyFolderId;
        } else {
            parentId = this.templatesFolderId || await this.getAppRoot();
        }
    }

    if (!parentId) return [];

    let query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    if (mode === 'active' && targetType === 'template') {
        query += ` and name != '_Trash_Templates' and name != '_Trash_Active' and name != '_Trash_History' and name != '_Trash' and name != '_System' and name != '_Active' and name != '_History' and name != '_Templates'`; 
    }

    // Use common fetcher with pagination
    return this.fetchAllItems(query, 'files(id, name, createdTime, appProperties)');
  }

  // [Changed] Soft Delete with Strict Type
  public async softDeleteFolder(folderId: string, type: CloudResourceType): Promise<void> {
      if (!this.isAuthorized) return; 

      await this.ensureAppStructure();
      
      const file = await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=parents`);
      if (!file.parents || file.parents.length === 0) return;
      const currentParentId = file.parents[0];

      const trashId = await this.getTrashFolder(type);

      await this.moveFile(folderId, currentParentId, trashId);
      this.cleanupTrashLimit(trashId);
  }

  // [Changed] Restore with Strict Type
  public async restoreFolder(folderId: string, type: CloudResourceType): Promise<void> {
      if (!this.isAuthorized) await this.signIn();
      
      await this.ensureAppStructure();
      
      let targetParentId;
      if (type === 'active') {
          targetParentId = this.activeFolderId;
      } else if (type === 'history') {
          targetParentId = this.historyFolderId;
      } else {
          targetParentId = this.templatesFolderId || await this.getAppRoot();
      }
      
      const trashId = await this.getTrashFolder(type);
      
      if (targetParentId) {
          await this.moveFile(folderId, trashId, targetParentId);
      }
  }

  // 100 Items Limit Logic per Trash Bin
  private async cleanupTrashLimit(trashFolderId: string) {
      try {
          const query = `'${trashFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
          const files = await this.fetchAllItems(query, 'files(id, createdTime)'); // Use paginated fetch
          
          // Sort explicitly if needed, though Drive usually returns sorted by createdTime desc if requested
          // Re-sort just in case pagination messed up order slightly
          files.sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

          if (files.length > 100) {
              const toDelete = files.slice(100); 
              const promises = toDelete.map((f: any) => this.deleteFile(f.id));
              await Promise.all(promises);
              console.log(`Auto-cleaned ${toDelete.length} old backups from Trash.`);
          }
      } catch (e) {
          console.warn("Trash cleanup failed", e);
      }
  }

  // Empty Trash: Delete ALL from ALL trash folders
  public async emptyTrash(): Promise<void> {
      if (!this.isAuthorized) await this.signIn();
      
      const trashTempId = await this.getTrashFolder('template');
      const trashActiveId = await this.getTrashFolder('active');
      const trashHistoryId = await this.getTrashFolder('history');
      
      // Use set to ensure uniqueness if logic returns same (rare but safe)
      const idsToCheck = Array.from(new Set([trashTempId, trashActiveId, trashHistoryId]));

      const promises = idsToCheck.map(async (trashId) => {
          const query = `'${trashId}' in parents and trashed = false`;
          const files = await this.fetchAllItems(query, 'files(id)'); // Use paginated fetch
          return Promise.all(files.map((f: any) => this.deleteFile(f.id)));
      });

      await Promise.all(promises);
  }

  public async getFileContent(folderId: string, filename: string = 'data.json'): Promise<any> {
      if (!this.isAuthorized) await this.signIn();
      
      const file = await this.findFile(filename, folderId, 'application/json');
      if (!file) throw new Error(`此備份中找不到 ${filename}`);

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (!response.ok) throw new Error("下載失敗");
      const data = await response.json();

      if (filename === 'data.json') {
          if (!data.cloudImageId) {
              const bgFile = await this.findFile('background.jpg', folderId);
              if (bgFile) {
                  data.cloudImageId = bgFile.id;
              }
          }
      }
      return data;
  }

  public async downloadImage(fileId: string): Promise<string> {
      if (!this.isAuthorized) await this.signIn();

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (!response.ok) throw new Error("圖片下載失敗");
      const blob = await response.blob();
      
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
      });
  }
}

export const googleDriveService = new GoogleDriveService();
