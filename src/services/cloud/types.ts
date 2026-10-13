
export interface CloudFile {
  id: string;
  name: string;
  createdTime: string; // ISO string
  modifiedTime?: string;
  mimeType?: string;
  parents?: string[];
  appProperties?: { [key: string]: string }; // Custom metadata
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
  appProperties?: { [key: string]: string };
}

export type CloudResourceType = 'template' | 'active' | 'history';
