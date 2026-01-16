import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile, CloudResourceType } from '../services/googleDrive';
import { googleDriveClient } from '../services/cloud/googleDriveClient'; // Needed for direct download
import { useToast } from './useToast';
import { GameTemplate, GameSession, HistoryRecord } from '../types';

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(() => localStorage.getItem('google_drive_auto_connect') === 'true');
  const { showToast } = useToast();

  // Check auth status on mount
  useEffect(() => {
      if (googleDriveService.isAuthorized) {
          setIsConnected(true);
      } else if (isAutoConnectEnabled) {
          // Silent check/connect is limited by GSI, handled by user interaction primarily
      }
  }, []);

  const connectToCloud = useCallback(async () => {
      try {
          await googleDriveService.signIn();
          localStorage.setItem('google_drive_auto_connect', 'true');
          setIsAutoConnectEnabled(true);
          setIsConnected(true);
          showToast({ message: "已連線至 Google Drive", type: 'success' });
          return true;
      } catch (error) {
          console.error("Connection failed", error);
          showToast({ message: "連線失敗", type: 'error' });
          return false;
      }
  }, [showToast]);

  const disconnectFromCloud = useCallback(async () => {
      await googleDriveService.signOut();
      localStorage.setItem('google_drive_auto_connect', 'false');
      setIsAutoConnectEnabled(false);
      setIsConnected(false);
      showToast({ message: "已登出 Google Drive", type: 'info' });
  }, [showToast]);

  const ensureConnection = async () => {
      if (!googleDriveService.isAuthorized) {
          await googleDriveService.signIn();
          setIsConnected(true);
      }
  };

  const handleError = (error: any, action: string) => {
      console.error(`${action} failed`, error);
      if (error.status === 401 || error.status === 403) {
          setIsConnected(false);
          showToast({ message: "連線已過期，請重新登入", type: 'error' });
      } else {
          showToast({ message: `${action}失敗`, type: 'error' });
      }
  };

  // --- Exposed Actions ---

  const handleBackup = useCallback(async (template: GameTemplate) => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          const updated = await googleDriveService.backupTemplate(template);
          showToast({ message: "備份成功", type: 'success' });
          return updated;
      } catch (error) {
          handleError(error, "備份");
          return null;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  const fetchFileList = useCallback(async (mode: 'active' | 'trash', source: CloudResourceType) => {
      try {
          await ensureConnection();
          return await googleDriveService.fetchFileList(mode, source);
      } catch (error) {
          handleError(error, "讀取列表");
          return [];
      }
  }, [showToast]);

  const restoreBackup = useCallback(async (fileId: string) => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          const template = await googleDriveService.restoreBackup(fileId);
          showToast({ message: "還原成功", type: 'success' });
          return template;
      } catch (error) {
          handleError(error, "還原");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  const restoreSessionBackup = useCallback(async (fileId: string) => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          // The fileId in the list corresponds to the folder ID of the session
          return await googleDriveService.restoreSessionBackup(fileId);
      } catch (error) {
          handleError(error, "還原紀錄");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  const restoreHistoryBackup = useCallback(async (fileId: string) => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          // The fileId in the list corresponds to the folder ID of the history record
          return await googleDriveService.restoreHistoryBackup(fileId);
      } catch (error) {
          handleError(error, "還原歷史");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  const restoreFromTrash = useCallback(async (fileId: string, type: CloudResourceType) => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          await googleDriveService.restoreFromTrash(fileId, type);
          showToast({ message: "已還原", type: 'success' });
          return true;
      } catch (error) {
          handleError(error, "還原");
          return false;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

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
  }, [showToast]);

  const emptyTrash = useCallback(async (type?: CloudResourceType): Promise<boolean> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          showToast({ message: "正在清空垃圾桶...", type: 'info' });
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
  }, [showToast]);

  const silentSystemBackup = useCallback(async (data: any): Promise<void> => {
      if (!isAutoConnectEnabled) return;
      try {
          if (!googleDriveService.isAuthorized) {
              return;
          }
          // Placeholder for actual full backup logic if needed
          console.log("Silent system backup check passed");
      } catch (e) {
          console.warn("Silent backup failed", e);
      }
  }, [isAutoConnectEnabled]);

  const downloadCloudImage = useCallback(async (fileId: string) => {
      try {
          await ensureConnection();
          const blob = await googleDriveClient.downloadBlob(fileId);
          return blob;
      } catch (e) {
          console.error("Image download failed", e);
          return null;
      }
  }, []);

  // Sync Logic Placeholders (To satisfy interface usage in Dashboard)
  const performFullBackup = useCallback(async (...args: any[]) => { 
      return { success: 0, skipped: 0, failed: 0 }; 
  }, []);
  
  const performFullRestore = useCallback(async (...args: any[]) => { 
      return { success: 0, skipped: 0, failed: 0 }; 
  }, []);

  return {
      isSyncing,
      isConnected,
      isAutoConnectEnabled,
      isMockMode: false,
      connectToCloud,
      disconnectFromCloud,
      handleBackup,
      fetchFileList,
      restoreBackup,
      restoreSessionBackup,
      restoreHistoryBackup,
      restoreFromTrash,
      deleteCloudFile,
      emptyTrash,
      silentSystemBackup,
      downloadCloudImage,
      performFullBackup,
      performFullRestore
  };
};