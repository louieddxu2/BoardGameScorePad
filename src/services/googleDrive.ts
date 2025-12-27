
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

  public async signIn(): Promise<string> {
    return new Promise((resolve, reject) => {
      // 確保 client 已初始化
      if (!this.tokenClient) {
        this.initTokenClient();
        if(!this.tokenClient) return reject(new Error('Google Identity Services script not loaded yet. Please try again.'));
      }

      // 覆寫 callback 以捕捉這次請求的結果
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
            reject(resp);
        } else {
          this.accessToken = resp.access_token;
          this.tokenExpiration = Date.now() + (resp.expires_in * 1000);
          resolve(this.accessToken!);
        }
      };

      // 觸發登入彈窗
      // requestAccessToken 會忽略 prompt: 'none'，始終顯示選單或使用已登入帳號
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  private async fetchDrive(url: string, options: RequestInit = {}) {
    if (!this.isAuthorized) {
        throw new Error('Unauthorized'); // 讓外層捕獲並嘗試重新登入
    }
    
    const headers = { 
        'Authorization': `Bearer ${this.accessToken}`, 
        ...options.headers 
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Drive API Error: ${response.status}`);
    }
    return response.json();
  }

  // --- File Operations ---

  private async findFile(name: string, parentId: string = 'root', mimeType?: string): Promise<DriveFile | null> {
    let query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    if (mimeType) query += ` and mimeType = '${mimeType}'`;
    
    const data = await this.fetchDrive(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)`
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

  private async uploadFile(name: string, parentId: string, mimeType: string, body: Blob | string): Promise<DriveFile> {
    const existing = await this.findFile(name, parentId, mimeType);
    
    const metadata = { 
        name, 
        mimeType, 
        parents: existing ? undefined : [parentId] 
    };

    const form = new FormData();
    // Google Drive API Multipart upload:
    // Part 1: Metadata (JSON)
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    // Part 2: Content
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
    
    if (!response.ok) {
        throw new Error('File upload failed');
    }
    return response.json();
  }

  // --- Public Methods ---

  public async backupTemplate(template: GameTemplate, imageBase64?: string | null): Promise<void> {
    if (!this.isAuthorized) await this.signIn();

    // 1. 確保根目錄存在
    let root = await this.findFile('BoardGameScorePad', 'root', 'application/vnd.google-apps.folder');
    if (!root) root = await this.createFolder('BoardGameScorePad');

    // 2. 建立/尋找遊戲專屬資料夾 (名稱+ID前綴，避免同名衝突)
    // 為了讓還原時好辨識，我們用 name_shortID 的格式
    const folderName = `${template.name.trim()}_${template.id.slice(0, 6)}`;
    let gameFolder = await this.findFile(folderName, root.id, 'application/vnd.google-apps.folder');
    if (!gameFolder) gameFolder = await this.createFolder(folderName, root.id);

    // 3. 上傳 JSON 資料
    const jsonContent = JSON.stringify(template, null, 2);
    await this.uploadFile('data.json', gameFolder.id, 'application/json', jsonContent);

    // 4. (選擇性) 上傳背景圖
    if (imageBase64) {
        const blob = base64ToBlob(imageBase64);
        await this.uploadFile('background.jpg', gameFolder.id, 'image/jpeg', blob);
    }
  }

  public async listFiles(): Promise<CloudFile[]> {
    if (!this.isAuthorized) await this.signIn();
    
    // 1. 找根目錄
    const root = await this.findFile('BoardGameScorePad', 'root', 'application/vnd.google-apps.folder');
    if (!root) return [];

    // 2. 列出所有子資料夾 (每一個子資料夾代表一個備份的遊戲)
    const query = `'${root.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    // 排序：建立時間新到舊
    const data = await this.fetchDrive(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id, name, createdTime)`
    );
    
    return data.files || [];
  }

  public async getFileContent(folderId: string): Promise<GameTemplate> {
      if (!this.isAuthorized) await this.signIn();
      
      // 1. 在該資料夾內找 data.json
      const file = await this.findFile('data.json', folderId, 'application/json');
      if (!file) throw new Error("此備份中找不到 data.json");

      // 2. 下載內容
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (!response.ok) throw new Error("下載失敗");
      const templateData = await response.json();

      // 3. 檢查是否有 background.jpg
      const bgFile = await this.findFile('background.jpg', folderId, 'image/jpeg');
      if (bgFile) {
          // 下載圖片並轉為 Base64
          const bgResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${bgFile.id}?alt=media`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
          });
          if (bgResponse.ok) {
              const blob = await bgResponse.blob();
              // Convert Blob to Base64 String
              await new Promise<void>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      // 將圖片 Base64 注入到 runtime 的 image state，這部分需要透過 Hook 處理
                      // 這裡我們先回傳原始 template，圖片處理交給外部
                      // 但因為 GameTemplate 結構目前沒有直接存 Base64 (為了效能)，我們需要一種方式傳遞
                      
                      // 解決方案：我們約定，如果從雲端還原，我們可能需要將圖片暫存，或者直接寫入
                      // 由於 App 架構設計是把圖片跟 JSON 分開，這裡我們先把 Base64 塞進一個臨時欄位
                      // 注意：这個 `_tempImageBase64` 不是 GameTemplate 的標準欄位，但在 Restore 流程中會被取出
                      (templateData as any)._tempImageBase64 = reader.result;
                      resolve();
                  };
                  reader.readAsDataURL(blob);
              });
          }
      }

      return templateData;
  }
}

export const googleDriveService = new GoogleDriveService();
