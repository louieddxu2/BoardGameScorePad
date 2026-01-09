
import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile, CloudResourceType } from '../services/googleDrive';
import { googleAuth } from '../services/cloud/googleAuth';
import { googleDriveClient } from '../services/cloud/googleDriveClient';
import { useToast } from './useToast';
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { imageService } from '../services/imageService';

const CHUNK_SIZE = 3;

const chunkArray = <T>(array: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
};

export const useGoogleDrive = () => {
  const { showToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(() => localStorage.getItem('google_drive_auto_connect') === 'true');
  const [isMockMode] = useState(false);

  // Check auth status on mount
  useEffect(() => {
      const checkAuth = async () => {
          if (isAutoConnectEnabled && googleAuth.isAuthorized) {
              setIsConnected(true);
          }
      };
      checkAuth();
  }, [isAutoConnectEnabled]);

  const connectToCloud = useCallback(async () => {
      try {
          await googleDriveService.signIn();
          await googleDriveService.ensureAppStructure();
          localStorage.setItem('google_drive_auto_connect', 'true');
          setIsAutoConnectEnabled(true);
          setIsConnected(true);
          showToast({ message: "已連線至 Google Drive", type: 'success' });
          return true;
      } catch (e) {
          console.error("Connection failed", e);
          showToast({ message: "連線失敗", type: 'error' });
          return false;
      }
  }, [showToast]);

  const disconnectFromCloud = useCallback(async () => {
      await googleDriveService.signOut();
      localStorage.removeItem('google_drive_auto_connect');
      setIsAutoConnectEnabled(false);
      setIsConnected(false);
      showToast({ message: "已登出 Google Drive", type: 'info' });
  }, [showToast]);

  const fetchFileList = useCallback(async (mode: 'active' | 'trash', source: 'templates' | 'sessions' | 'history'): Promise<CloudFile[]> => {
      let type: CloudResourceType = 'template';
      if (source === 'sessions') type = 'active';
      if (source === 'history') type = 'history';
      return await googleDriveService.getFileList(mode, type);
  }, []);

  const restoreBackup = useCallback(async (id: string): Promise<GameTemplate> => {
      const files = await googleDriveClient.fetchAllItems(`'${id}' in parents and name = 'template.json'`, 'files(id)');
      if (files.length === 0) throw new Error("Template file not found");
      const jsonFileId = files[0].id;
      const content = await googleDriveClient.downloadFile(jsonFileId);
      
      const imgFiles = await googleDriveClient.fetchAllItems(`'${id}' in parents and name = 'background.jpg'`, 'files(id)');
      if (imgFiles.length > 0) {
          content.cloudImageId = imgFiles[0].id;
      }
      return content;
  }, []);

  const restoreSessionBackup = useCallback(async (id: string): Promise<GameSession> => {
      const files = await googleDriveClient.fetchAllItems(`'${id}' in parents and name = 'session.json'`, 'files(id)');
      if (files.length === 0) throw new Error("Session file not found");
      const session = await googleDriveClient.downloadFile(files[0].id);
      
      if (session.photoCloudIds) {
          for (const [localId, cloudId] of Object.entries(session.photoCloudIds as Record<string, string>)) {
              const existing = await imageService.getImage(localId);
              if (!existing) {
                  try {
                      const blob = await googleDriveClient.downloadBlob(cloudId);
                      await imageService.saveImage(blob, session.id, 'session', localId);
                  } catch (e) { console.warn("Failed to restore photo", localId); }
              }
          }
      }
      
      session.cloudFolderId = id; 
      return session;
  }, []);

  const restoreHistoryBackup = useCallback(async (id: string): Promise<HistoryRecord> => {
      const files = await googleDriveClient.fetchAllItems(`'${id}' in parents and name = 'record.json'`, 'files(id)');
      if (files.length === 0) throw new Error("Record file not found");
      const record = await googleDriveClient.downloadFile(files[0].id);
      
      if (record.photoCloudIds) {
          for (const [localId, cloudId] of Object.entries(record.photoCloudIds as Record<string, string>)) {
              const existing = await imageService.getImage(localId);
              if (!existing) {
                  try {
                      const blob = await googleDriveClient.downloadBlob(cloudId);
                      await imageService.saveImage(blob, record.id, 'session', localId);
                  } catch (e) { console.warn("Failed to restore history photo", localId); }
              }
          }
      }
      record.cloudFolderId = id;
      return record;
  }, []);

  const downloadCloudImage = useCallback(async (fileId: string): Promise<Blob | null> => {
      try {
          return await googleDriveClient.downloadBlob(fileId);
      } catch (e) {
          console.error("Download image failed", e);
          return null;
      }
  }, []);

  const handleBackup = useCallback(async (template: GameTemplate): Promise<GameTemplate | null> => {
      setIsSyncing(true);
      try {
          const updated = await googleDriveService.backupTemplate(template);
          showToast({ message: "備份成功", type: 'success' });
          return updated;
      } catch (e) {
          console.error(e);
          showToast({ message: "備份失敗", type: 'error' });
          return null;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  const silentSystemBackup = useCallback(async (data: any) => {
      if (!isAutoConnectEnabled || !googleAuth.isAuthorized) return;
      // Silent backup implementation
  }, [isAutoConnectEnabled]);

  const deleteCloudFile = useCallback(async (id: string) => {
      try {
          await googleDriveClient.deleteFile(id);
          showToast({ message: "檔案已刪除", type: 'success' });
          return true;
      } catch (e) {
          showToast({ message: "刪除失敗", type: 'error' });
          return false;
      }
  }, [showToast]);

  const restoreFromTrash = useCallback(async (id: string, type: CloudResourceType) => {
      try {
          await googleDriveClient.updateFileMetadata(id, { trashed: false });
          showToast({ message: "已還原", type: 'success' });
          return true;
      } catch (e) {
          showToast({ message: "還原失敗", type: 'error' });
          return false;
      }
  }, [showToast]);

  const emptyTrash = useCallback(async () => {
      try {
          await googleDriveClient.emptyTrash();
          showToast({ message: "垃圾桶已清空", type: 'success' });
          return true;
      } catch (e) {
          showToast({ message: "清空失敗", type: 'error' });
          return false;
      }
  }, [showToast]);

  const performFullBackup = useCallback(async (
      templates: GameTemplate[], 
      history: HistoryRecord[], 
      sessions: GameSession[],
      overrides: GameTemplate[],
      onProgress: (count: number, total: number) => void,
      onError: (failedItems: string[]) => void,
      onItemSuccess?: (type: 'template' | 'history' | 'session', item: any) => void
  ) => {
      if (!isConnected) return { success: 0, skipped: 0, failed: 0 };
      
      const allTemplates = [...templates, ...overrides];
      const total = allTemplates.length + history.length + sessions.length;
      let processed = 0;
      let successCount = 0;
      let skippedCount = 0;
      const failedItems: string[] = [];

      try {
          const [cTemplates, cSessions, cHistory] = await Promise.all([
              fetchFileList('active', 'templates'),
              fetchFileList('active', 'sessions'),
              fetchFileList('active', 'history')
          ]);

          const extractId = (name: string) => {
              const lastUnderscore = name.lastIndexOf('_');
              return lastUnderscore !== -1 ? name.substring(lastUnderscore + 1) : null;
          };

          const buildMap = (files: CloudFile[]) => {
              const map = new Map<string, CloudFile>();
              files.forEach(f => {
                  const id = extractId(f.name);
                  if (id) map.set(id, f);
              });
              return map;
          };

          const templateMap = buildMap(cTemplates);
          const sessionMap = buildMap(cSessions);
          const historyMap = buildMap(cHistory);

          const processItem = async (fn: () => Promise<any>, name: string, isUpToDate: boolean, type: 'template' | 'history' | 'session', item: any) => {
              try {
                  if (isUpToDate) {
                      skippedCount++;
                  } else {
                      await fn();
                      successCount++;
                      if (onItemSuccess) onItemSuccess(type, item);
                  }
              } catch (e) {
                  console.error(`Failed to backup ${name}`, e);
                  failedItems.push(name);
              } finally {
                  processed++;
                  onProgress(processed, total);
              }
          };

          const tChunks = chunkArray(allTemplates, CHUNK_SIZE);
          for (const chunk of tChunks) {
              await Promise.all(chunk.map(t => {
                  const cloudInfo = templateMap.get(t.id);
                  let isUpToDate = false;
                  if (cloudInfo) {
                      const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                      if ((t.updatedAt || 0) <= cloudTime) isUpToDate = true;
                  }
                  
                  return processItem(async () => {
                      await googleDriveService.backupTemplate(t);
                  }, t.name, isUpToDate, 'template', t);
              }));
          }

          const hChunks = chunkArray(history, CHUNK_SIZE);
          for (const chunk of hChunks) {
              await Promise.all(chunk.map(h => {
                  const cloudInfo = historyMap.get(h.id);
                  let isUpToDate = false;
                  if (cloudInfo) {
                      const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                      if (h.endTime <= cloudTime) isUpToDate = true;
                  }

                  return processItem(async () => {
                      await googleDriveService.backupHistoryRecord(h, cloudInfo?.id);
                  }, `歷史: ${h.gameName}`, isUpToDate, 'history', h);
              }));
          }

          const sChunks = chunkArray(sessions, CHUNK_SIZE);
          for (const chunk of sChunks) {
              await Promise.all(chunk.map(s => {
                  const cloudInfo = sessionMap.get(s.id);
                  const templateName = allTemplates.find(t => t.id === s.templateId)?.name || '未命名遊戲';
                  
                  let isUpToDate = false;
                  if (cloudInfo && s.updatedAt) {
                      const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                      if (cloudTime >= s.updatedAt) isUpToDate = true;
                  }

                  return processItem(async () => {
                      await googleDriveService.backupActiveSession(s, templateName, cloudInfo?.id, cloudInfo?.name);
                  }, `進行中: ${s.id.slice(0,8)}`, isUpToDate, 'session', s);
              }));
          }

          if (failedItems.length > 0) onError(failedItems);

          return { success: successCount, skipped: skippedCount, failed: failedItems.length };

      } catch (e: any) {
          console.error("Batch backup error", e);
          throw e;
      }
  }, [isConnected, fetchFileList]);

  const performFullRestore = useCallback(async (
      localDataMap: { templates: Map<string, number>, history: Map<string, number>, sessions: Map<string, number> },
      onProgress: (count: number, total: number) => void,
      onError: (failedItems: string[]) => void,
      onItemRestored: (type: 'template' | 'history' | 'session', item: any) => Promise<void>,
      onSettingsRestored?: (settings: any) => void
  ) => {
      setIsSyncing(true);
      let successCount = 0;
      let skippedCount = 0;
      const failedItems: string[] = [];

      try {
          if (!googleDriveService.isAuthorized) await googleDriveService.signIn();
          await googleDriveService.ensureAppStructure();

          const [cloudTemplates, cloudSessions, cloudHistory] = await Promise.all([
              fetchFileList('active', 'templates'),
              fetchFileList('active', 'sessions'),
              fetchFileList('active', 'history')
          ]);

          const total = cloudTemplates.length + cloudSessions.length + cloudHistory.length;
          let processed = 0;
          onProgress(0, total);

          const extractId = (name: string) => {
              const lastUnderscore = name.lastIndexOf('_');
              return lastUnderscore !== -1 ? name.substring(lastUnderscore + 1) : null;
          };

          const processItem = async (file: CloudFile, type: 'template' | 'session' | 'history') => {
              try {
                  const cloudTime = Number(file.appProperties?.originalUpdatedAt || 0);
                  const id = extractId(file.name);
                  
                  let localTime = 0;
                  if (id) {
                      if (type === 'template') localTime = localDataMap.templates.get(id) || 0;
                      else if (type === 'session') localTime = localDataMap.sessions.get(id) || 0;
                      else if (type === 'history') localTime = localDataMap.history.get(id) || 0;
                  }

                  // Skip if local is newer or same
                  // For sessions, this is critical to prevent overwriting active progress
                  if (localTime > 0 && localTime >= cloudTime) {
                      skippedCount++;
                  } else {
                      let data;
                      if (type === 'template') data = await restoreBackup(file.id);
                      else if (type === 'session') data = await restoreSessionBackup(file.id);
                      else if (type === 'history') data = await restoreHistoryBackup(file.id);
                      
                      if (data) await onItemRestored(type, data);
                      successCount++;
                  }
              } catch (e: any) {
                  // Ignore "File not found" errors which can happen if a folder is empty or deleted concurrently
                  if (!e.message?.includes('not found') && !e.message?.includes('找不到')) {
                      console.error(`Restore failed for ${file.name}`, e);
                      failedItems.push(file.name);
                  }
              } finally {
                  processed++;
                  onProgress(processed, total);
              }
          };

          const chunk = 3;
          
          for(let i=0; i<cloudTemplates.length; i+=chunk) {
              await Promise.all(cloudTemplates.slice(i, i+chunk).map(f => processItem(f, 'template')));
          }
          for(let i=0; i<cloudSessions.length; i+=chunk) {
              await Promise.all(cloudSessions.slice(i, i+chunk).map(f => processItem(f, 'session')));
          }
          for(let i=0; i<cloudHistory.length; i+=chunk) {
              await Promise.all(cloudHistory.slice(i, i+chunk).map(f => processItem(f, 'history')));
          }

          if (failedItems.length > 0) onError(failedItems);

      } catch (e) {
          console.error("Full restore failed", e);
          onError(["System Error"]);
      } finally {
          setIsSyncing(false);
      }

      return { success: successCount, skipped: skippedCount, failed: failedItems.length };
  }, [isConnected, fetchFileList, restoreBackup, restoreSessionBackup, restoreHistoryBackup]);

  return {
      isSyncing,
      isConnected,
      isAutoConnectEnabled,
      isMockMode,
      connectToCloud,
      disconnectFromCloud,
      fetchFileList,
      handleBackup,
      silentSystemBackup,
      performFullBackup,
      performFullRestore,
      restoreBackup,
      restoreSessionBackup,
      restoreHistoryBackup,
      restoreFromTrash,
      deleteCloudFile,
      emptyTrash,
      downloadCloudImage
  };
};
