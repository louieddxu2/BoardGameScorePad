
import { googleAuth } from './googleAuth';
import { CloudFile, DriveFile } from './types';

class GoogleDriveClient {

  private async assertSuccess(response: Response, fallback: string): Promise<void> {
    if (response.ok) return;
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.error?.message || fallback), { status: response.status });
  }

  private async fetchDrive(url: string, options: RequestInit = {}) {
    if (!googleAuth.isAuthorized) {
        throw new Error('Unauthorized');
    }
    
    const headers = { 
        'Authorization': `Bearer ${googleAuth.token}`, 
        ...options.headers 
    };
    
    const response = await fetch(url, { ...options, headers });
    
    await this.assertSuccess(response, `Drive API Error: ${response.status}`);
    return response.json();
  }

  public async fetchAllItems(query: string, fields: string): Promise<CloudFile[]> {
      let allFiles: CloudFile[] = [];
      let pageToken: string | null = null;
      
      do {
          const url: string = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1000&fields=nextPageToken,incompleteSearch,${fields}${pageToken ? `&pageToken=${pageToken}` : ''}`;
          const data: any = await this.fetchDrive(url);
          if (data.incompleteSearch) throw new Error('Drive file listing is incomplete');
          
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

  public async findFileByProperty(key: string, value: string, parentId: string = 'root'): Promise<DriveFile | null> {
    const query = `'${parentId}' in parents and appProperties has { key='${key}' and value='${value}' } and trashed = false`;
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

  /** undefined searches; null is confirmed absent; a string updates the known file. */
  public async uploadFileToFolder(
    folderId: string, name: string, mimeType: string, body: Blob | string,
    knownFileId?: string | null, retryMissingFile: boolean = true,
  ): Promise<DriveFile> {
    if (!googleAuth.isAuthorized) throw new Error('Unauthorized');
    const fileId = knownFileId === undefined
      ? (await this.findFile(name, folderId, mimeType))?.id ?? null
      : knownFileId;
    try {
      return await this.uploadFile(folderId, name, mimeType, body, fileId);
    } catch (error) {
      // A stale ID gets one fresh lookup. Permission/network errors never create a replacement.
      if (!retryMissingFile || !knownFileId || (error as { status?: number }).status !== 404) throw error;
      const refreshed = await this.findFile(name, folderId, mimeType);
      return this.uploadFile(folderId, name, mimeType, body, refreshed?.id ?? null);
    }
  }

  private async uploadFile(
    folderId: string, name: string, mimeType: string, body: Blob | string,
    fileId: string | null,
  ): Promise<DriveFile> {
    // Construct proper multipart/related body
    const metadata = { 
        name, 
        mimeType, 
        parents: fileId ? undefined : [folderId]
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

    const method = fileId ? 'PATCH' : 'POST';
    const endpoint = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const response = await fetch(endpoint, {
      method,
      headers: { 
          'Authorization': `Bearer ${googleAuth.token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: requestBody,
    });
    
    await this.assertSuccess(response, 'File upload failed');
    return response.json();
  }

  public async moveFile(fileId: string, previousParentId: string | undefined, newParentId: string): Promise<void> {
      let removeParents = previousParentId;
      
      // If previousParentId is missing, fetch it first (Atomic Auto-Resolution)
      if (!removeParents) {
          try {
              const file = await this.getFile(fileId, 'parents');
              if (file.parents && file.parents.length > 0) {
                  removeParents = file.parents.join(',');
              }
          } catch (e) {
              console.warn(`[moveFile] Could not resolve parents for ${fileId}, skipping removeParents`, e);
          }
      }

      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}${removeParents ? `&removeParents=${removeParents}` : ''}`;
      
      await this.fetchDrive(url, {
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
      await this.assertSuccess(response, "下載失敗");
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
