
import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile, CloudResourceType, getAutoConnectPreference, setAutoConnectPreference } from '../services/googleDrive';
import { systemSyncService } from '../services/systemSyncService';
import { useToast } from './useToast';
import { GameTemplate, GameSession, HistoryRecord } from '../types';
import { isDisposableTemplate } from '../utils/templateUtils';

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(googleDriveService.isAuthorized);
  
  // [Standardized] Initialize from shared helper
  const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(getAutoConnectPreference);

  const { showToast } = useToast();

  useEffect(() => {
      setIsConnected(googleDriveService.isAuthorized);
  }, []);

  // [Modified] Explicit Connect Function
  const connectToCloud = useCallback(async () => {
      try {
          await googleDriveService.signIn(); 
          setIsConnected(true);
          // Only enable auto-connect preference AFTER successful sign-in
          setIsAutoConnectEnabled(true); 
          // [Fix] Sync state using shared helper
          setAutoConnectPreference(true);
          
          showToast({ message: "Google Drive 連線成功", type: 'success' });
          return true;
      } catch (e: any) {
          console.error("Manual connection failed:", e);
          
          setIsAutoConnectEnabled(false); 
          setAutoConnectPreference(false);
          setIsConnected(false);

          if (e.error === 'popup_closed_by_user') {
              showToast({ message: "已取消登入", type: 'info' });
          } else {
              showToast({ message: "連線失敗，請檢查網路或稍後再試", type: 'error' });
          }
          return false;
      }
  }, [showToast]);

  // [Modified] Explicit Disconnect Function
  const disconnectFromCloud = useCallback(async () => {
      setIsAutoConnectEnabled(false);
      setAutoConnectPreference(false);
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

  const handleBackup = useCallback(async (template: GameTemplate): Promise<GameTemplate | null> => {
    if (!isAutoConnectEnabled) return null;
    setIsSyncing(true);
    try {
      await ensureConnection();
      showToast({ message: "正在上傳備份...", type: 'info' });
      // Remove deprecated imageBase64 arg
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
          // [Updated] Use new Smart Hydration method
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

  // [UPDATED] Return Blob instead of string
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

  const emptyTrash = useCallback(async (type?: CloudResourceType): Promise<boolean> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: type ? "正在清空此分類垃圾桶..." : "正在清空所有垃圾桶...", type: 'info' });
          await googleDriveService.emptyTrash(type);
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
          // [Note] 自動背景備份目前不執行合併邏輯，僅在上傳單一設定檔時使用。
          // 真正的完整系統備份與合併現在由 performFullBackup 負責。
          const { data: rawData, ...settingsOnly } = data; // Only save preferences
          await googleDriveService.saveSystemData('settings_backup.json', settingsOnly);
      } catch (e) {
          console.warn("Silent settings backup failed:", e);
      }
  }, [isAutoConnectEnabled]);

  // [Full Backup] Smart Skip Logic: Cloud.ts >= Local.ts -> Skip
  const performFullBackup = useCallback(async (
      systemData: any, // [New Argument] Full system data for merging
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
                  // Ensure underscore exists and is not the first character
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
          
          const total = allTemplates.length + history.length + sessions.length + 1; // +1 for settings
          let processed = 0;
          let lastReportTime = 0; // [Optimization] Throttle UI updates
          
          // Initial Update
          onProgress(0, total);

          // [Optimization] Concurrency Pool Runner
          // Allows us to process multiple items in parallel but limited by concurrency.
          // Skipped items resolve immediately, freeing up a slot for the next item.
          const runWithConcurrency = async <T>(
              items: T[],
              concurrency: number,
              fn: (item: T) => Promise<void>
          ) => {
              const executing = new Set<Promise<void>>();
              for (const item of items) {
                  const p = fn(item).then(() => { executing.delete(p); });
                  executing.add(p);
                  if (executing.size >= concurrency) {
                      await Promise.race(executing);
                  }
              }
              await Promise.all(executing);
          };

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
                  
                  // [Optimization] Throttle progress updates to avoid freezing the UI when skipping many files
                  const now = Date.now();
                  // Update if:
                  // 1. Not skipped (Action happened, keep user informed)
                  // 2. OR > 200ms passed since last update (Throttle skips)
                  // 3. OR it's the last item (Ensure 100%)
                  if (!isSkipped || now - lastReportTime > 200 || processed === total) {
                      onProgress(processed, total);
                      lastReportTime = now;
                  }
              }
          };

          const CHUNK_SIZE = 3; // Max active uploads

          // 2a. Process Templates (Concurrency Pool)
          await runWithConcurrency(allTemplates, CHUNK_SIZE, async (t) => {
              // [Fix] Automatically skip disposable (simple) templates to avoid cluttering cloud
              if (isDisposableTemplate(t)) {
                  return processItem(async () => {}, t.name, true);
              }

              const cloudInfo = templateMap.get(t.id);
              
              // Skip Logic: If cloud exists AND cloud ts >= local ts
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
          });

          // 2b. Process History (Concurrency Pool)
          await runWithConcurrency(history, CHUNK_SIZE, async (h) => {
              const cloudInfo = historyMap.get(h.id);
              
              // [Change] Use updatedAt for history comparison
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
                  
                  // [Fix] Logic to cleanup stale Active Session in Cloud
                  if (activeMap.has(h.id)) {
                      const staleActiveFile = activeMap.get(h.id);
                      if (staleActiveFile) {
                          googleDriveService.softDeleteFolder(staleActiveFile.id, 'active')
                              .catch(err => console.warn("Failed to cleanup stale active session", err));
                      }
                  }
              }, `${h.gameName} (${new Date(h.endTime).toLocaleDateString()})`, isUpToDate);
          });

          // 2c. Process Active Sessions (Concurrency Pool)
          await runWithConcurrency(sessions, CHUNK_SIZE, async (s) => {
              const cloudInfo = activeMap.get(s.id);
              const templateName = allTemplates.find(t => t.id === s.templateId)?.name || '未命名遊戲';
              
              // [Comparison Logic Added] Check lastUpdatedAt
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
          });

          // 2d. Process System Settings (Merge & Upload via Service)
          try {
              await systemSyncService.mergeAndBackupSystemSettings(systemData);
              successCount++;
          } catch (e) {
              console.warn("Settings backup failed", e);
              failedItems.push("System Settings");
          } finally {
              processed++;
              // Always update for the last item (Settings)
              onProgress(processed, total);
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

  // [Full Restore] Smart Skip Logic: Local.ts >= Cloud.ts -> Skip
  const performFullRestore = useCallback(async (
      // [Update] Added sessions map to input signature
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

          const [cloudTemplates, cloudHistory] = await Promise.all([
              googleDriveService.listFoldersInParent(googleDriveService.templatesFolderId!),
              googleDriveService.listFoldersInParent(googleDriveService.historyFolderId!)
              // [EXCLUDE ACTIVE SESSIONS] "One-Click Restore" should NOT touch active sessions
              // to prevent overwriting local in-progress games.
          ]);

          const total = cloudTemplates.length + cloudHistory.length + 1; // +1 for settings
          let processed = 0;
          let lastReportTime = 0; // [Optimization] Throttle UI updates
          
          onProgress(0, total);

          // 1. Restore Settings First (if callback provided)
          if (onSettingsRestored && googleDriveService.systemFolderId) {
              try {
                  const settings = await googleDriveService.getFileContent(googleDriveService.systemFolderId, 'settings_backup.json');
                  onSettingsRestored(settings);
                  successCount++;
              } catch (e) {
                  console.log("No settings backup found or failed to restore", e);
                  // Not critical, don't add to failed count to avoid scaring user
              } finally {
                  processed++;
                  onProgress(processed, total);
              }
          }

          // Helper to extract ID using lastUnderscore logic
          const getId = (name: string) => {
              const lastSep = name.lastIndexOf('_');
              if (lastSep !== -1) {
                  return name.substring(lastSep + 1);
              }
              return null;
          };

          const processItem = async (file: CloudFile, type: 'template' | 'history') => {
              const id = getId(file.name);
              const cloudTime = Number(file.appProperties?.originalUpdatedAt || 0);
              let shouldDownload = true;

              // Check vs Local
              if (id) {
                  let localTime = 0;
                  if (type === 'template' && localMeta.templates.has(id)) {
                      localTime = localMeta.templates.get(id) || 0;
                  } else if (type === 'history' && localMeta.history.has(id)) {
                      localTime = localMeta.history.get(id) || 0;
                  }
                  
                  // Skip if local is newer or same
                  if (localTime >= cloudTime && localTime > 0) {
                      shouldDownload = false;
                  }
              }

              try {
                  if (shouldDownload) {
                      if (type === 'template') {
                          // [Updated] Use new Smart Hydration method
                          const data = await googleDriveService.restoreTemplate(file.id);
                          await onItemRestored('template', data);
                      } else if (type === 'history') {
                          const data = await googleDriveService.getFileContent(file.id, 'session.json');
                          await onItemRestored('history', data);
                      }
                      successCount++;
                  } else {
                      skippedCount++;
                  }
              } catch (e: any) {
                  // Only report real errors, not "file not found" which might happen for empty folders
                  if (!e.message?.includes('找不到')) {
                      console.error(`Restore failed for ${file.name}:`, e);
                      failedItems.push(file.name);
                  }
              } finally {
                  processed++;
                  
                  // [Optimization] Throttle progress updates
                  const now = Date.now();
                  if (shouldDownload || now - lastReportTime > 200 || processed === total) {
                      onProgress(processed, total);
                      lastReportTime = now;
                  }
              }
          };

          const CHUNK_SIZE = 3;
          
          // Process Templates
          const templateChunks = [];
          for (let i = 0; i < cloudTemplates.length; i += CHUNK_SIZE) {
              templateChunks.push(cloudTemplates.slice(i, i + CHUNK_SIZE));
          }
          for (const chunk of templateChunks) {
              await Promise.all(chunk.map(f => processItem(f, 'template')));
          }

          // Process History
          const historyChunks = [];
          for (let i = 0; i < cloudHistory.length; i += CHUNK_SIZE) {
              historyChunks.push(cloudHistory.slice(i, i + CHUNK_SIZE));
          }
          for (const chunk of historyChunks) {
              await Promise.all(chunk.map(f => processItem(f, 'history')));
          }

          // [EXCLUDE ACTIVE SESSIONS LOOP]

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
    connectToCloud,      // Exposed
    disconnectFromCloud, // Exposed
    isSyncing,
    isConnected,
    isAutoConnectEnabled, 
    silentSystemBackup, 
    performFullBackup, 
    performFullRestore, // [New]
    isMockMode: false
  };
};
