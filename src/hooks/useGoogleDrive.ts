
import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile, CloudResourceType } from '../services/googleDrive';
import { useToast } from './useToast';
import { GameTemplate, GameSession, HistoryRecord } from '../types';

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(googleDriveService.isAuthorized);
  
  // [Fix] Initialize from localStorage. 
  // This ensures that when navigating between pages (which unmounts/remounts hooks),
  // we remember the user's preference.
  const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(() => {
      return localStorage.getItem('google_drive_auto_connect') === 'true';
  });

  const { showToast } = useToast();

  useEffect(() => {
      setIsConnected(googleDriveService.isAuthorized);
  }, []);

  // [Modified] Explicit Connect Function
  const connectToCloud = useCallback(async () => {
      try {
          await googleDriveService.signIn(); 
          setIsConnected(true);
          
          // [Fix] Persist preference
          setIsAutoConnectEnabled(true); 
          localStorage.setItem('google_drive_auto_connect', 'true');
          
          showToast({ message: "Google Drive 連線成功", type: 'success' });
          return true;
      } catch (e: any) {
          console.error("Manual connection failed:", e);
          
          // Only disable if explicitly failed (user cancelled or error)
          if (e.error === 'popup_closed_by_user' || e.error === 'access_denied') {
              setIsAutoConnectEnabled(false); 
              localStorage.setItem('google_drive_auto_connect', 'false');
              setIsConnected(false);
              showToast({ message: "已取消登入", type: 'info' });
          } else {
              // For network errors, we keep the flag true (optional choice), 
              // but to be safe and avoid loops, we turn it off here for manual attempts.
              setIsAutoConnectEnabled(false);
              localStorage.setItem('google_drive_auto_connect', 'false');
              setIsConnected(false);
              showToast({ message: "連線失敗，請檢查網路或稍後再試", type: 'error' });
          }
          return false;
      }
  }, [showToast]);

  // [Modified] Explicit Disconnect Function
  const disconnectFromCloud = useCallback(async () => {
      await googleDriveService.signOut();
      
      // [Fix] Persist preference
      setIsAutoConnectEnabled(false);
      localStorage.setItem('google_drive_auto_connect', 'false');
      
      setIsConnected(false);
      showToast({ message: "已斷開 Google Drive 連線", type: 'info' });
  }, [showToast]);

  const ensureConnection = async () => {
      if (!isAutoConnectEnabled) {
          throw new Error("雲端功能未開啟");
      }
      // Lazy Connection Logic:
      // If enabled but not authorized (e.g. token expired or page refreshed),
      // try to sign in NOW. This works because ensureConnection is usually called
      // inside a user-triggered event handler (like 'End Game' click).
      if (!googleDriveService.isAuthorized) {
          await googleDriveService.signIn(); 
          setIsConnected(true);
      }
  };

  const handleError = (error: any, action: string) => {
      console.error(`${action} Error:`, error);
      const errMsg = error.message || '';
      if (error.error === 'popup_closed_by_user') {
          showToast({ message: "已取消登入", type: 'info' });
      } else if (errMsg.includes('API has not been used') || errMsg.includes('is disabled')) {
          showToast({ message: "設定錯誤：API 未啟用", type: 'error' });
      } else if (error.status === 403 || error.status === 401) {
          setIsConnected(false); 
          showToast({ message: "權限不足或憑證過期，請重新連結。", type: 'error' });
      } else {
          showToast({ message: `${action}失敗: ${errMsg || '網路錯誤'}`, type: 'error' });
      }
  };

  const handleBackup = useCallback(async (template: GameTemplate): Promise<GameTemplate | null> => {
    if (!isAutoConnectEnabled) return null;
    setIsSyncing(true);
    try {
      await ensureConnection();
      showToast({ message: "正在上傳備份...", type: 'info' });
      const updatedTemplate = await googleDriveService.backupTemplate(template);
      setIsConnected(true); 
      showToast({ message: "備份成功！", type: 'success' });
      return updatedTemplate;
    } catch (error: any) {
      handleError(error, "備份");
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isAutoConnectEnabled, showToast]);

  const fetchFileList = useCallback(async (mode: 'active' | 'trash' = 'active', source: 'templates' | 'sessions' | 'history' = 'templates'): Promise<CloudFile[]> => {
      try {
          await ensureConnection();
          const files = await googleDriveService.listFiles(mode, source);
          setIsConnected(true);
          return files;
      } catch (error: any) {
          if (error.error !== 'popup_closed_by_user') {
             handleError(error, "讀取列表");
          }
          throw error;
      }
  }, [isAutoConnectEnabled, showToast]);

  const restoreBackup = useCallback(async (fileId: string): Promise<GameTemplate> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在還原...", type: 'info' });
          const template = await googleDriveService.restoreTemplate(fileId);
          setIsConnected(true);
          showToast({ message: "還原成功！", type: 'success' });
          return template;
      } catch (error: any) {
          handleError(error, "還原");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const restoreSessionBackup = useCallback(async (fileId: string): Promise<GameSession> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在下載...", type: 'info' });
          const session = await googleDriveService.getFileContent(fileId, 'session.json');
          setIsConnected(true);
          showToast({ message: "下載成功！", type: 'success' });
          return session;
      } catch (error: any) {
          handleError(error, "下載");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const restoreHistoryBackup = useCallback(async (fileId: string): Promise<HistoryRecord> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在下載歷史紀錄...", type: 'info' });
          const record = await googleDriveService.getFileContent(fileId, 'session.json');
          setIsConnected(true);
          showToast({ message: "下載成功！", type: 'success' });
          return record;
      } catch (error: any) {
          handleError(error, "下載");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const restoreFromTrash = useCallback(async (folderId: string, type: CloudResourceType): Promise<boolean> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          await googleDriveService.restoreFolder(folderId, type);
          setIsConnected(true);
          showToast({ message: "已還原至對應資料夾", type: 'success' });
          return true;
      } catch (error: any) {
          handleError(error, "還原");
          return false;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const downloadCloudImage = useCallback(async (fileId: string): Promise<Blob | null> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在下載圖片...", type: 'info' });
          const blob = await googleDriveService.downloadImage(fileId);
          setIsConnected(true);
          showToast({ message: "圖片載入完成", type: 'success' });
          return blob;
      } catch (error: any) {
          handleError(error, "圖片下載");
          return null;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const deleteCloudFile = useCallback(async (fileId: string): Promise<boolean> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在永久刪除...", type: 'info' });
          await googleDriveService.deleteFile(fileId);
          setIsConnected(true);
          showToast({ message: "刪除成功", type: 'success' });
          return true;
      } catch (error: any) {
          handleError(error, "刪除");
          return false;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const emptyTrash = useCallback(async (): Promise<boolean> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在清空所有垃圾桶...", type: 'info' });
          await googleDriveService.emptyTrash();
          setIsConnected(true);
          showToast({ message: "垃圾桶已清空", type: 'success' });
          return true;
      } catch (error: any) {
          handleError(error, "清空");
          return false;
      } finally {
          setIsSyncing(false);
      }
  }, [isAutoConnectEnabled, showToast]);

  const silentSystemBackup = useCallback(async (data: any): Promise<void> => {
      if (!isAutoConnectEnabled) return;
      // Note: Silent backup shouldn't prompt login, so we check isAuthorized directly
      if (!googleDriveService.isAuthorized) return; 
      try {
          const { data: rawData, ...settingsOnly } = data; 
          await googleDriveService.saveSystemData('settings_backup.json', settingsOnly);
      } catch (e) {
          console.warn("Silent settings backup failed:", e);
      }
  }, [isAutoConnectEnabled]);

  const performFullBackup = useCallback(async (
      templates: GameTemplate[], 
      history: HistoryRecord[],
      sessions: GameSession[],
      overrides: GameTemplate[],
      onProgress: (count: number, total: number) => void,
      onError: (failedItems: string[]) => void,
      onItemSuccess?: (type: 'template' | 'history' | 'session', item: any) => void
  ): Promise<{ success: number, skipped: number, failed: number }> => {
      setIsSyncing(true);
      let successCount = 0;
      let skippedCount = 0;
      const failedItems: string[] = [];
      
      try {
          await ensureConnection();
          
          await googleDriveService.ensureAppStructure();
          
          const [cloudTemplates, cloudHistory, cloudActive] = await Promise.all([
              googleDriveService.listFoldersInParent(googleDriveService.templatesFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.historyFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.activeFolderId!)
          ]);

          const createMap = (files: CloudFile[]) => {
              const map = new Map<string, CloudFile>();
              files.forEach(f => {
                  const lastSep = f.name.lastIndexOf('_');
                  if (lastSep > 0) {
                      const uuid = f.name.substring(lastSep + 1);
                      map.set(uuid, f);
                  }
              });
              return map;
          };

          const templateMap = createMap(cloudTemplates);
          const historyMap = createMap(cloudHistory);
          const activeMap = createMap(cloudActive);

          const allTemplates = [...templates, ...overrides];
          
          const total = allTemplates.length + history.length + sessions.length;
          let processed = 0;
          onProgress(0, total);

          const processItem = async (task: () => Promise<void>, name: string, isSkipped: boolean = false) => {
              try {
                  if (isSkipped) {
                      skippedCount++;
                  } else {
                      await task();
                      successCount++;
                  }
              } catch (e) {
                  console.error(`Backup failed for ${name}:`, e);
                  failedItems.push(name);
              } finally {
                  processed++;
                  onProgress(processed, total);
              }
          };

          const chunkArray = <T>(arr: T[], size: number) => {
              const res = [];
              for (let i = 0; i < arr.length; i += size) {
                  res.push(arr.slice(i, i + size));
              }
              return res;
          };

          const CHUNK_SIZE = 3;

          // 2a. Process Templates
          const templateChunks = chunkArray(allTemplates, CHUNK_SIZE);
          for (const chunk of templateChunks) {
              await Promise.all(chunk.map(t => {
                  const cloudInfo = templateMap.get(t.id);
                  let isUpToDate = false;
                  if (cloudInfo && t.updatedAt) {
                      const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                      if (cloudTime >= t.updatedAt) {
                          isUpToDate = true;
                      }
                  }
                  return processItem(async () => {
                      const updatedT = await googleDriveService.backupTemplate(t, null, cloudInfo?.id, cloudInfo?.name);
                      if (onItemSuccess) onItemSuccess('template', updatedT);
                  }, t.name, isUpToDate);
              }));
          }

          // 2b. Process History
          const historyChunks = chunkArray(history, CHUNK_SIZE);
          for (const chunk of historyChunks) {
              await Promise.all(chunk.map(h => {
                  const cloudInfo = historyMap.get(h.id);
                  let isUpToDate = false;
                  const localTime = h.updatedAt || h.endTime;
                  if (cloudInfo && localTime) {
                      const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                      if (cloudTime >= localTime) {
                          isUpToDate = true;
                      }
                  }
                  return processItem(async () => {
                      await googleDriveService.backupHistoryRecord(h, cloudInfo?.id, cloudInfo?.name);
                  }, `${h.gameName} (${new Date(h.endTime).toLocaleDateString()})`, isUpToDate);
              }));
          }

          // 2c. Process Active Sessions
          const sessionChunks = chunkArray(sessions, CHUNK_SIZE);
          for (const chunk of sessionChunks) {
              await Promise.all(chunk.map(s => {
                  const cloudInfo = activeMap.get(s.id);
                  const templateName = allTemplates.find(t => t.id === s.templateId)?.name || '未命名遊戲';
                  let isUpToDate = false;
                  const localTime = s.lastUpdatedAt || s.startTime;
                  if (cloudInfo && localTime) {
                      const cloudTime = Number(cloudInfo.appProperties?.originalUpdatedAt || 0);
                      if (cloudTime >= localTime) {
                          isUpToDate = true;
                      }
                  }
                  return processItem(async () => {
                      await googleDriveService.backupActiveSession(s, templateName, cloudInfo?.id, cloudInfo?.name);
                  }, `進行中: ${s.id.slice(0,8)}`, isUpToDate);
              }));
          }

          // 2d. Always backup Settings
          try {
              await googleDriveService.saveSystemData('settings_backup.json', { timestamp: Date.now() });
          } catch (e) {
              console.warn("Settings backup failed", e);
          }

          if (failedItems.length > 0) {
              onError(failedItems);
          }

      } catch (e: any) {
          handleError(e, "全域備份初始化");
      } finally {
          setIsSyncing(false);
      }
      return { success: successCount, skipped: skippedCount, failed: failedItems.length };
  }, [isAutoConnectEnabled, showToast]);

  const performFullRestore = useCallback(async (
      localMeta: { templates: Map<string, number>, history: Map<string, number>, sessions: Map<string, number> },
      onProgress: (count: number, total: number) => void,
      onError: (failedItems: string[]) => void,
      onItemRestored: (type: 'template' | 'history' | 'session', item: any) => Promise<void>,
      onSettingsRestored?: (settings: any) => void 
  ): Promise<{ success: number, skipped: number, failed: number }> => {
      setIsSyncing(true);
      let successCount = 0;
      let skippedCount = 0;
      const failedItems: string[] = [];

      try {
          await ensureConnection();
          await googleDriveService.ensureAppStructure();

          const [cloudTemplates, cloudHistory, cloudActive] = await Promise.all([
              googleDriveService.listFoldersInParent(googleDriveService.templatesFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.historyFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.activeFolderId!)
          ]);

          const total = cloudTemplates.length + cloudHistory.length + cloudActive.length + 1;
          let processed = 0;
          onProgress(0, total);

          // 1. Restore Settings
          if (onSettingsRestored && googleDriveService.systemFolderId) {
              try {
                  const settings = await googleDriveService.getFileContent(googleDriveService.systemFolderId, 'settings_backup.json');
                  onSettingsRestored(settings);
                  successCount++;
              } catch (e) {
                  console.log("No settings backup found or failed to restore", e);
              } finally {
                  processed++;
                  onProgress(processed, total);
              }
          }

          const getId = (name: string) => {
              const lastSep = name.lastIndexOf('_');
              if (lastSep !== -1) {
                  return name.substring(lastSep + 1);
              }
              return null;
          };

          const processItem = async (file: CloudFile, type: 'template' | 'history' | 'active') => {
              const id = getId(file.name);
              const cloudTime = Number(file.appProperties?.originalUpdatedAt || 0);
              let shouldDownload = true;

              if (id) {
                  let localTime = 0;
                  if (type === 'template' && localMeta.templates.has(id)) {
                      localTime = localMeta.templates.get(id) || 0;
                  } else if (type === 'history' && localMeta.history.has(id)) {
                      localTime = localMeta.history.get(id) || 0;
                  } else if (type === 'active' && localMeta.sessions.has(id)) {
                      localTime = localMeta.sessions.get(id) || 0;
                  }
                  
                  if (localTime >= cloudTime && localTime > 0) {
                      shouldDownload = false;
                  }
              }

              try {
                  if (shouldDownload) {
                      if (type === 'template') {
                          const data = await googleDriveService.restoreTemplate(file.id);
                          await onItemRestored('template', data);
                      } else if (type === 'history') {
                          const data = await googleDriveService.getFileContent(file.id, 'session.json');
                          await onItemRestored('history', data);
                      } else if (type === 'active') {
                          const data = await googleDriveService.getFileContent(file.id, 'session.json');
                          await onItemRestored('session', data);
                      }
                      successCount++;
                  } else {
                      skippedCount++;
                  }
              } catch (e: any) {
                  if (!e.message?.includes('找不到')) {
                      console.error(`Restore failed for ${file.name}:`, e);
                      failedItems.push(file.name);
                  }
              } finally {
                  processed++;
                  onProgress(processed, total);
              }
          };

          const CHUNK_SIZE = 3;
          
          const templateChunks = [];
          for (let i = 0; i < cloudTemplates.length; i += CHUNK_SIZE) {
              templateChunks.push(cloudTemplates.slice(i, i + CHUNK_SIZE));
          }
          for (const chunk of templateChunks) {
              await Promise.all(chunk.map(f => processItem(f, 'template')));
          }

          const historyChunks = [];
          for (let i = 0; i < cloudHistory.length; i += CHUNK_SIZE) {
              historyChunks.push(cloudHistory.slice(i, i + CHUNK_SIZE));
          }
          for (const chunk of historyChunks) {
              await Promise.all(chunk.map(f => processItem(f, 'history')));
          }

          const activeChunks = [];
          for (let i = 0; i < cloudActive.length; i += CHUNK_SIZE) {
              activeChunks.push(cloudActive.slice(i, i + CHUNK_SIZE));
          }
          for (const chunk of activeChunks) {
              await Promise.all(chunk.map(f => processItem(f, 'active')));
          }

          if (failedItems.length > 0) {
              onError(failedItems);
          }

      } catch (e: any) {
          handleError(e, "全域還原初始化");
      } finally {
          setIsSyncing(false);
      }
      return { success: successCount, skipped: skippedCount, failed: failedItems.length };
  }, [isAutoConnectEnabled, showToast]);

  return {
    handleBackup,
    fetchFileList,
    restoreBackup,
    restoreSessionBackup,
    restoreHistoryBackup, 
    restoreFromTrash,
    downloadCloudImage,
    deleteCloudFile,
    emptyTrash,
    connectToCloud,      
    disconnectFromCloud, 
    isSyncing,
    isConnected,
    isAutoConnectEnabled, 
    silentSystemBackup, 
    performFullBackup, 
    performFullRestore, 
    isMockMode: false
  };
};
