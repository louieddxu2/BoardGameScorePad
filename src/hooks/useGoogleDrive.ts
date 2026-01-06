
import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile, CloudResourceType } from '../services/googleDrive';
import { useToast } from './useToast';
import { GameTemplate, GameSession, HistoryRecord } from '../types';

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(googleDriveService.isAuthorized);
  
  const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(() => {
      return localStorage.getItem('google_drive_auto_connect') === 'true';
  });

  const { showToast } = useToast();

  useEffect(() => {
      setIsConnected(googleDriveService.isAuthorized);
  }, []);

  useEffect(() => {
      localStorage.setItem('google_drive_auto_connect', String(isAutoConnectEnabled));
  }, [isAutoConnectEnabled]);

  useEffect(() => {
      if (isAutoConnectEnabled && !googleDriveService.isAuthorized) {
          const trySilentConnect = async () => {
              try {
                  await googleDriveService.signIn({ prompt: 'none' });
                  setIsConnected(true);
                  console.log("Auto-connected to Google Drive");
              } catch (e: any) {
                  console.log("Silent auto-connect failed (interaction required):", e);
                  setIsConnected(false); 
              }
          };
          trySilentConnect();
      }
  }, []); 

  // [Modified] Explicit Connect Function
  const connectToCloud = useCallback(async () => {
      setIsAutoConnectEnabled(true);
      try {
          await googleDriveService.signIn(); 
          setIsConnected(true);
          showToast({ message: "Google Drive 連線成功", type: 'success' });
          return true;
      } catch (e: any) {
          console.error("Manual connection failed:", e);
          if (e.error === 'popup_closed_by_user') {
              setIsAutoConnectEnabled(false); 
              showToast({ message: "已取消登入", type: 'info' });
          } else {
              showToast({ message: "連線失敗，請檢查網路或稍後再試", type: 'error' });
          }
          setIsConnected(false);
          return false;
      }
  }, [showToast]);

  // [Modified] Explicit Disconnect Function
  const disconnectFromCloud = useCallback(async () => {
      setIsAutoConnectEnabled(false);
      await googleDriveService.signOut();
      setIsConnected(false);
      showToast({ message: "已斷開 Google Drive 連線", type: 'info' });
  }, [showToast]);

  const ensureConnection = async () => {
      if (!isAutoConnectEnabled) {
          throw new Error("雲端功能未開啟");
      }
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

  const handleBackup = useCallback(async (template: GameTemplate, imageBase64?: string | null): Promise<GameTemplate | null> => {
    if (!isAutoConnectEnabled) return null;
    setIsSyncing(true);
    try {
      await ensureConnection();
      showToast({ message: "正在上傳備份...", type: 'info' });
      const updatedTemplate = await googleDriveService.backupTemplate(template, imageBase64);
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
          showToast({ message: "正在下載...", type: 'info' });
          const template = await googleDriveService.getFileContent(fileId, 'data.json');
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
          // History records are also stored as session.json in their respective folder
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

  const downloadCloudImage = useCallback(async (fileId: string): Promise<string | null> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在下載圖片...", type: 'info' });
          const base64 = await googleDriveService.downloadImage(fileId);
          setIsConnected(true);
          showToast({ message: "圖片載入完成", type: 'success' });
          return base64;
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
      if (!googleDriveService.isAuthorized) return;
      try {
          // Keep the preferences/settings backup for "Settings Restore"
          const { data: rawData, ...settingsOnly } = data; // Only save preferences
          await googleDriveService.saveSystemData('settings_backup.json', settingsOnly);
      } catch (e) {
          console.warn("Silent settings backup failed:", e);
      }
  }, [isAutoConnectEnabled]);

  // [Enhanced & Optimized] Manual Full Batch Backup with Name Sync and Smart Skip Logic
  const performFullBackup = useCallback(async (
      templates: GameTemplate[], 
      history: HistoryRecord[],
      sessions: GameSession[],
      overrides: GameTemplate[],
      onProgress: (count: number, total: number) => void,
      onError: (failedItems: string[]) => void,
      onItemSuccess?: (type: 'template' | 'history' | 'session', item: any) => void
  ): Promise<void> => {
      setIsSyncing(true);
      let successCount = 0;
      let skippedCount = 0;
      const failedItems: string[] = [];
      
      try {
          await ensureConnection();
          
          // Phase 1: Pre-fetch existing folders
          await googleDriveService.ensureAppStructure();
          
          const [cloudTemplates, cloudHistory, cloudActive] = await Promise.all([
              googleDriveService.listFoldersInParent(googleDriveService.templatesFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.historyFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.activeFolderId!)
          ]);

          // Helper: Create lookup map with metadata support
          const createMap = (files: CloudFile[]) => {
              const map = new Map<string, CloudFile>();
              files.forEach(f => {
                  const uuid = f.name.split('_').pop(); 
                  if (uuid) map.set(uuid, f);
              });
              return map;
          };

          const templateMap = createMap(cloudTemplates);
          const historyMap = createMap(cloudHistory);
          const activeMap = createMap(cloudActive);

          // Phase 2: Concurrent Processing
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

          // Helper for chunking
          const chunkArray = <T>(arr: T[], size: number) => {
              const res = [];
              for (let i = 0; i < arr.length; i += size) {
                  res.push(arr.slice(i, i + size));
              }
              return res;
          };

          const CHUNK_SIZE = 5;

          // 2a. Process Templates (Custom + Overrides)
          const templateChunks = chunkArray(allTemplates, CHUNK_SIZE);
          for (const chunk of templateChunks) {
              await Promise.all(chunk.map(t => {
                  const cloudInfo = templateMap.get(t.id);
                  
                  // Smart Skip Logic: Check cloud metadata
                  // If cloud has 'originalUpdatedAt', compare with local 'updatedAt'
                  let isUpToDate = false;
                  if (cloudInfo && t.updatedAt) {
                      const cloudTime = cloudInfo.appProperties?.originalUpdatedAt;
                      if (cloudTime && Number(cloudTime) === t.updatedAt) {
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
                  
                  // History typically immutable, but we check endTime as version
                  let isUpToDate = false;
                  if (cloudInfo && h.endTime) {
                      const cloudTime = cloudInfo.appProperties?.originalUpdatedAt;
                      if (cloudTime && Number(cloudTime) === h.endTime) {
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
                  
                  return processItem(async () => {
                      await googleDriveService.backupActiveSession(s, templateName, cloudInfo?.id, cloudInfo?.name);
                  }, `進行中: ${s.id.slice(0,8)}`, false);
              }));
          }

          // 3. Backup Settings
          try {
              await googleDriveService.saveSystemData('settings_backup.json', { timestamp: Date.now() });
          } catch (e) {
              console.warn("Settings backup failed", e);
          }

          // Phase 3: Reporting
          if (failedItems.length > 0) {
              onError(failedItems);
          } else {
              const msg = skippedCount > 0 
                ? `備份完成！上傳 ${successCount} 個，略過 ${skippedCount} 個最新項目`
                : `全域備份完成！共 ${successCount} 個項目`;
              showToast({ message: msg, type: 'success' });
          }

      } catch (e: any) {
          handleError(e, "全域備份初始化");
      } finally {
          setIsSyncing(false);
      }
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
    connectToCloud,      // Exposed
    disconnectFromCloud, // Exposed
    isSyncing,
    isConnected,
    isAutoConnectEnabled, 
    silentSystemBackup, 
    performFullBackup, 
    isMockMode: false
  };
};
