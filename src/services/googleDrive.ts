
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config';
import { GameTemplate } from '../types';

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
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
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

class GoogleDriveService {
  private tokenClient: any;
  private accessToken: string | null = null;
  private tokenExpiration: number = 0;
  
  // Folder ID Cache
  private appRootId: string | null = null;
  private trashFolderId: string | null = null;
  private systemFolderId: string | null = null;
  private activeFolderId: string | null = null;
  private historyFolderId: string | null = null;
  private templatesFolderId: string | null = null;

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
      this.trashFolderId = null;
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

  private async getTrashFolder(): Promise<string> {
      if (this.trashFolderId) return this.trashFolderId;
      const rootId = await this.getAppRoot();
      // Name the custom trash folder "_Trash" so it sorts to top (usually) and is distinct
      let trash = await this.findFile('_Trash', rootId, 'application/vnd.google-apps.folder');
      if (!trash) trash = await this.createFolder('_Trash', rootId);
      this.trashFolderId = trash.id;
      return trash.id;
  }

  /**
   * Initializes and caches the 4 core subfolders: _System, _Active, _History, _Templates
   */
  public async ensureAppStructure(): Promise<void> {
      if (this.systemFolderId && this.activeFolderId && this.historyFolderId && this.templatesFolderId) return;
      if (!this.isAuthorized) await this.signIn();

      const rootId = await this.getAppRoot();
      
      const folders = ['_System', '_Active', '_History', '_Templates'];
      
      // Use Promise.all for parallel processing to speed up init
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

  private async findFile(name: string, parentId: string = 'root', mimeType?: string): Promise<DriveFile | null> {
    let query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    if (mimeType) query += ` and mimeType = '${mimeType}'`;
    
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

  private async renameFile(fileId: string, newName: string): Promise<void> {
    const metadata = { name: newName };
    await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
  }

  private async moveFile(fileId: string, previousParentId: string, newParentId: string): Promise<void> {
      await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${previousParentId}`, {
          method: 'PATCH'
      });
  }

  /**
   * Universal upload method
   * If 'body' is a string, it's treated as raw content (e.g. JSON string).
   * If 'body' is a Blob, it's uploaded as binary.
   */
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

  // --- Specialized Public Methods ---

  /**
   * Save a JSON object to the _System folder (e.g., preferences.json, library.json)
   */
  public async saveSystemData(filename: string, data: any): Promise<void> {
      await this.ensureAppStructure();
      if (!this.systemFolderId) throw new Error("System folder not found");
      
      const jsonContent = JSON.stringify(data, null, 2);
      await this.uploadFileToFolder(this.systemFolderId, filename, 'application/json', jsonContent);
  }

  /**
   * Load a JSON object from the _System folder
   */
  public async loadSystemData<T>(filename: string): Promise<T | null> {
      await this.ensureAppStructure();
      if (!this.systemFolderId) throw new Error("System folder not found");

      const file = await this.findFile(filename, this.systemFolderId, 'application/json');
      if (!file) return null;

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (!response.ok) return null;
      return await response.json();
  }

  /**
   * Creates (or finds) a dedicated folder for a game session in _Active.
   * Returns the folder ID.
   */
  public async createActiveSessionFolder(sessionName: string, sessionId: string): Promise<string> {
      await this.ensureAppStructure();
      if (!this.activeFolderId) throw new Error("Active folder not found");

      // Folder naming convention: "{GameName}_{UUID}"
      const folderName = `${sessionName.trim()}_${sessionId}`;
      
      let folder = await this.findFile(folderName, this.activeFolderId, 'application/vnd.google-apps.folder');
      if (!folder) {
          folder = await this.createFolder(folderName, this.activeFolderId);
      }
      return folder.id;
  }

  /**
   * Moves a session folder from _Active to _History.
   * Efficient: Does not re-upload files.
   */
  public async moveSessionToHistory(sessionFolderId: string): Promise<void> {
      await this.ensureAppStructure();
      if (!this.activeFolderId || !this.historyFolderId) throw new Error("Directories not initialized");

      // Move using Drive API (add new parent, remove old parent)
      await this.moveFile(sessionFolderId, this.activeFolderId, this.historyFolderId);
  }

  /**
   * Legacy Method: Preserved for compatibility with existing code during migration.
   * Maps to saving into _Templates (or root if not migrated fully yet).
   */
  public async backupTemplate(template: GameTemplate, imageBase64?: string | null): Promise<GameTemplate> {
    if (!this.isAuthorized) await this.signIn();

    // Use _Templates folder if available, else root
    await this.ensureAppStructure();
    const parentId = this.templatesFolderId || await this.getAppRoot();

    const folderNameFull = `${template.name.trim()}_${template.id}`;
    let gameFolder = await this.findFile(folderNameFull, parentId, 'application/vnd.google-apps.folder');

    if (!gameFolder) {
        gameFolder = await this.createFolder(folderNameFull, parentId);
    }

    // Move out of trash if it was there
    const trashId = await this.getTrashFolder();
    if (gameFolder.parents && gameFolder.parents.includes(trashId)) {
        await this.moveFile(gameFolder.id, trashId, parentId);
    }

    // Upload Image
    let uploadedImageId = template.cloudImageId;
    if (imageBase64) {
        const blob = base64ToBlob(imageBase64);
        // Use generic upload helper
        const uploadedFile = await this.uploadFileToFolder(gameFolder.id, 'background.jpg', 'image/jpeg', blob);
        uploadedImageId = uploadedFile.id;
    }

    // Upload JSON
    const updatedTemplate = { ...template, cloudImageId: uploadedImageId };
    const jsonContent = JSON.stringify(updatedTemplate, null, 2);
    await this.uploadFileToFolder(gameFolder.id, 'data.json', 'application/json', jsonContent);

    return updatedTemplate;
  }

  public async listFiles(mode: 'active' | 'trash' = 'active'): Promise<CloudFile[]> {
    if (!this.isAuthorized) await this.signIn();
    
    // Default listing behavior (Legacy support: list templates in root or _Templates)
    // For now, we list from _Templates if initialized, or fallback to Root
    await this.ensureAppStructure();
    let parentId = this.templatesFolderId || await this.getAppRoot();

    if (mode === 'trash') {
        parentId = await this.getTrashFolder();
    }

    let query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (mode === 'active') {
        query += ` and name != '_Trash' and name != '_System' and name != '_Active' and name != '_History'`; 
    }

    const data = await this.fetchDrive(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id, name, createdTime)`
    );
    
    return data.files || [];
  }

  // Soft Delete: Move to _Trash subfolder
  public async softDeleteFolder(templateId: string, templateName: string): Promise<void> {
      if (!this.isAuthorized) return; 

      await this.ensureAppStructure();
      const parentId = this.templatesFolderId || await this.getAppRoot();
      const trashId = await this.getTrashFolder();

      const folderNameFull = `${templateName.trim()}_${templateId}`;
      let targetFolder = await this.findFile(folderNameFull, parentId, 'application/vnd.google-apps.folder');

      if (targetFolder) {
          await this.moveFile(targetFolder.id, parentId, trashId);
          this.cleanupTrashLimit(trashId);
      }
  }

  // Restore: Move from _Trash back to _Templates
  public async restoreFolder(folderId: string): Promise<void> {
      if (!this.isAuthorized) await this.signIn();
      
      await this.ensureAppStructure();
      const targetParentId = this.templatesFolderId || await this.getAppRoot();
      const trashId = await this.getTrashFolder();
      
      await this.moveFile(folderId, trashId, targetParentId);
  }

  // 100 Items Limit Logic
  private async cleanupTrashLimit(trashFolderId: string) {
      try {
          const query = `'${trashFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
          const data = await this.fetchDrive(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id, createdTime)`
          );
          
          const files = data.files || [];
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

  // Empty Trash: Delete all in _Trash
  public async emptyTrash(): Promise<void> {
      if (!this.isAuthorized) await this.signIn();
      const trashId = await this.getTrashFolder();
      
      const query = `'${trashId}' in parents and trashed = false`;
      const data = await this.fetchDrive(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`
      );
      
      const files = data.files || [];
      const promises = files.map((f: any) => this.deleteFile(f.id));
      await Promise.all(promises);
  }

  public async getFileContent(folderId: string): Promise<GameTemplate> {
      if (!this.isAuthorized) await this.signIn();
      
      const file = await this.findFile('data.json', folderId, 'application/json');
      if (!file) throw new Error("此備份中找不到 data.json");

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (!response.ok) throw new Error("下載失敗");
      const templateData: GameTemplate = await response.json();

      if (!templateData.cloudImageId) {
          const bgFile = await this.findFile('background.jpg', folderId);
          if (bgFile) {
              templateData.cloudImageId = bgFile.id;
          }
      }
      return templateData;
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
}

export const googleDriveService = new GoogleDriveService();
