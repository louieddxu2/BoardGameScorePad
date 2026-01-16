
import { googleAuth } from './googleAuth';
import { CloudFile, DriveFile } from './types';

class GoogleDriveClient {
  
  private async fetchDrive(url: string, options: RequestInit = {}) {
    if (!googleAuth.isAuthorized) {
        throw new Error('Unauthorized');
    }
    
    const headers = { 
        'Authorization': `Bearer ${googleAuth.token}`, 
        ...options.headers 
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const error: any = new Error(err.error?.message || `Drive API Error: ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
  }

  public async fetchAllItems(query: string, fields: string): Promise<CloudFile[]> {
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

  public async findFile(name: string, parentId: string = 'root', mimeType?: string): Promise<DriveFile | null> {
    // Escape single quotes in name to prevent query injection / breakage
    const safeName = name.replace(/'/g, "\\'");
    let query = `name = '${safeName}' and '${parentId}' in parents and trashed = false`;
    if (mimeType) query += ` and mimeType = '${mimeType}'`;
    
    const data = await this.fetchDrive(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, parents)`
    );
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  public async getFile(fileId: string, fields: string = 'id, name, mimeType'): Promise<DriveFile> {
      const data = await this.fetchDrive(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`
      );
      return data;
  }

  public async createFolder(name: string, parentId: string = 'root'): Promise<DriveFile> {
    const metadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] };
    return this.fetchDrive('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
  }

  public async updateFileMetadata(fileId: string, metadata: any): Promise<void> {
      await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata)
      });
  }

  public async uploadFileToFolder(folderId: string, name: string, mimeType: string, body: Blob | string): Promise<DriveFile> {
    const existing = await this.findFile(name, folderId, mimeType);
    
    // Construct proper multipart/related body
    const metadata = { 
        name, 
        mimeType, 
        parents: existing ? undefined : [folderId] 
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    let contentBuffer: Uint8Array;
    if (typeof body === 'string') {
        contentBuffer = new TextEncoder().encode(body);
    } else {
        contentBuffer = new Uint8Array(await body.arrayBuffer());
    }

    const metadataStr = JSON.stringify(metadata);
    const part1 = `Content-Type: application/json\r\n\r\n${metadataStr}`;
    const part2 = `Content-Type: ${mimeType}\r\n\r\n`;

    // Construct the full body as Uint8Array
    const encoder = new TextEncoder();
    const p1 = encoder.encode(delimiter + part1 + delimiter + part2);
    const p3 = encoder.encode(closeDelimiter);
    
    const totalLength = p1.length + contentBuffer.length + p3.length;
    const requestBody = new Uint8Array(totalLength);
    
    requestBody.set(p1, 0);
    requestBody.set(contentBuffer, p1.length);
    requestBody.set(p3, p1.length + contentBuffer.length);

    const method = existing ? 'PATCH' : 'POST';
    const endpoint = existing 
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const response = await fetch(endpoint, {
      method,
      headers: { 
          'Authorization': `Bearer ${googleAuth.token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: requestBody,
    });
    
    if (!response.ok) throw new Error('File upload failed');
    return response.json();
  }

  public async moveFile(fileId: string, previousParentId: string, newParentId: string): Promise<void> {
      await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${previousParentId}`, {
          method: 'PATCH'
      });
  }

  // Soft delete (Move to Trash)
  public async trashFile(fileId: string): Promise<void> {
      await this.fetchDrive(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true })
      });
  }

  // Permanent delete
  public async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${googleAuth.token}` }
    });
    if (!response.ok && response.status !== 204) {
        throw new Error("刪除失敗");
    }
  }

  public async downloadFile(fileId: string): Promise<any> {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${googleAuth.token}` }
      });
      if (!response.ok) throw new Error("下載失敗");
      return response.json();
  }

  public async downloadBlob(fileId: string): Promise<Blob> {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${googleAuth.token}` }
      });
      if (!response.ok) throw new Error("下載失敗");
      return await response.blob();
  }
}

export const googleDriveClient = new GoogleDriveClient();
