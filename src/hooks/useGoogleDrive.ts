
import { useState, useCallback, useEffect } from 'react';
import { googleDriveService, CloudFile } from '../services/googleDrive';
import { useToast } from './useToast';
import { GameTemplate } from '../types';

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(googleDriveService.isAuthorized);
  
  // Persistent state for user intent (default to false if not set)
  const [isAutoConnectEnabled, setIsAutoConnectEnabled] = useState(() => {
      return localStorage.getItem('google_drive_auto_connect') === 'true';
  });

  const { showToast } = useToast();

  // Check current auth status on mount/update
  useEffect(() => {
      setIsConnected(googleDriveService.isAuthorized);
  }, []);

  // Update localStorage when intent changes
  useEffect(() => {
      localStorage.setItem('google_drive_auto_connect', String(isAutoConnectEnabled));
  }, [isAutoConnectEnabled]);

  // Attempt auto-connect on mount if enabled
  useEffect(() => {
      if (isAutoConnectEnabled && !googleDriveService.isAuthorized) {
          const trySilentConnect = async () => {
              try {
                  // Try silent sign-in ('none' prompt)
                  await googleDriveService.signIn({ prompt: 'none' });
                  setIsConnected(true);
                  console.log("Auto-connected to Google Drive");
              } catch (e: any) {
                  // Silent failure is expected if no session exists or interaction required
                  console.log("Silent auto-connect failed (interaction required):", e);
                  // We do NOT set isAutoConnectEnabled to false here. 
                  // We want the UI to show the "Amber Cloud" indicating intent is ON but connection FAILED.
                  setIsConnected(false); 
              }
          };
          trySilentConnect();
      }
  }, []); // Run once on mount

  const toggleCloudConnection = useCallback(async () => {
      if (isAutoConnectEnabled) {
          // User wants to DISCONNECT
          setIsAutoConnectEnabled(false);
          await googleDriveService.signOut();
          setIsConnected(false);
          showToast({ message: "已斷開 Google Drive 連線", type: 'info' });
      } else {
          // User wants to CONNECT
          setIsAutoConnectEnabled(true);
          try {
              await googleDriveService.signIn(); // Normal prompt
              setIsConnected(true);
              showToast({ message: "Google Drive 連線成功", type: 'success' });
          } catch (e: any) {
              console.error("Manual connection failed:", e);
              // Connection failed, but intent remains true (so they can try again)
              // Optionally revert intent if user cancelled:
              if (e.error === 'popup_closed_by_user') {
                  setIsAutoConnectEnabled(false); 
                  showToast({ message: "已取消登入", type: 'info' });
              } else {
                  showToast({ message: "連線失敗，請檢查網路或稍後再試", type: 'error' });
              }
              setIsConnected(false);
          }
      }
  }, [isAutoConnectEnabled, showToast]);

  const ensureConnection = async () => {
      if (!isAutoConnectEnabled) {
          throw new Error("雲端功能未開啟");
      }
      if (!googleDriveService.isAuthorized) {
          // Attempt re-auth (might trigger popup if silent fails, but here we likely need explicit interaction if called from a button)
          // However, typically this helper is called within operations.
          // If we are here, it means silent auth failed previously or token expired.
          // We try one more time or fail.
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
          showToast({ message: "設定錯誤：專案尚未啟用 Google Drive API。請至 Google Cloud Console 啟用。", type: 'error' });
      } else if (error.status === 403 || error.status === 401) {
          setIsConnected(false); // Mark as disconnected on auth error
          // Note: We keep isAutoConnectEnabled as true, so the UI shows the "Re-auth needed" icon
          showToast({ message: "權限不足或憑證過期，請重新連結 Google Drive。", type: 'error' });
      } else {
          showToast({ message: `${action}失敗: ${errMsg || '網路錯誤'}`, type: 'error' });
      }
  };

  const handleBackup = useCallback(async (template: GameTemplate, imageBase64?: string | null): Promise<GameTemplate | null> => {
    // Only proceed if intent is enabled
    if (!isAutoConnectEnabled) return null;

    setIsSyncing(true);
    try {
      await ensureConnection();
      showToast({ message: "正在上傳備份...", type: 'info' });
      
      const updatedTemplate = await googleDriveService.backupTemplate(template, imageBase64);
      
      setIsConnected(true); 
      showToast({ message: "備份成功！已上傳至雲端。", type: 'success' });
      return updatedTemplate;
    } catch (error: any) {
      handleError(error, "備份");
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isAutoConnectEnabled, showToast]);

  const fetchFileList = useCallback(async (mode: 'active' | 'trash' = 'active'): Promise<CloudFile[]> => {
      try {
          await ensureConnection();
          const files = await googleDriveService.listFiles(mode);
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
          showToast({ message: "正在下載設定檔...", type: 'info' });
          const template = await googleDriveService.getFileContent(fileId);
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

  const restoreFromTrash = useCallback(async (folderId: string): Promise<boolean> => {
      setIsSyncing(true);
      try {
          await ensureConnection();
          await googleDriveService.restoreFolder(folderId);
          setIsConnected(true);
          showToast({ message: "已還原至我的備份", type: 'success' });
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
          showToast({ message: "正在清空垃圾桶...", type: 'info' });
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

  return {
    handleBackup,
    fetchFileList,
    restoreBackup,
    restoreFromTrash,
    downloadCloudImage,
    deleteCloudFile,
    emptyTrash,
    toggleCloudConnection, // Export toggle
    isSyncing,
    isConnected,
    isAutoConnectEnabled, // Export intent state
    isMockMode: false
  };
};
