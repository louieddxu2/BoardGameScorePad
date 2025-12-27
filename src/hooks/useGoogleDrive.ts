
import { useState, useCallback } from 'react';
import { googleDriveService, CloudFile } from '../services/googleDrive';
import { useToast } from './useToast';
import { GameTemplate } from '../types';

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  const handleError = (error: any, action: string) => {
      console.error(`${action} Error:`, error);
      
      const errMsg = error.message || '';

      // Error handling specifically for Auth issues
      if (error.error === 'popup_closed_by_user') {
          showToast({ message: "已取消登入", type: 'info' });
      } else if (errMsg.includes('API has not been used') || errMsg.includes('is disabled')) {
          showToast({ message: "設定錯誤：專案尚未啟用 Google Drive API。請至 Google Cloud Console 啟用。", type: 'error' });
      } else if (error.status === 403 || error.status === 401) {
          showToast({ message: "權限不足，請確認已授權 Google Drive 存取。", type: 'error' });
      } else {
          showToast({ message: `${action}失敗: ${errMsg || '網路錯誤'}`, type: 'error' });
      }
  };

  const handleBackup = useCallback(async (template: GameTemplate, imageBase64?: string | null): Promise<GameTemplate | null> => {
    setIsSyncing(true);
    try {
      if (!googleDriveService.isAuthorized) {
          showToast({ message: "正在連接 Google 帳號...", type: 'info' });
      } else {
          showToast({ message: "正在上傳備份...", type: 'info' });
      }
      
      const updatedTemplate = await googleDriveService.backupTemplate(template, imageBase64);
      
      showToast({ message: "備份成功！已上傳至雲端。", type: 'success' });
      return updatedTemplate;
    } catch (error: any) {
      handleError(error, "備份");
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  const fetchFileList = useCallback(async (): Promise<CloudFile[]> => {
      try {
          return await googleDriveService.listFiles();
      } catch (error: any) {
          if (error.error !== 'popup_closed_by_user') {
             handleError(error, "讀取列表");
          }
          throw error;
      }
  }, [showToast]);

  const restoreBackup = useCallback(async (fileId: string): Promise<GameTemplate> => {
      setIsSyncing(true);
      try {
          showToast({ message: "正在下載設定檔...", type: 'info' });
          const template = await googleDriveService.getFileContent(fileId);
          showToast({ message: "還原成功！", type: 'success' });
          return template;
      } catch (error: any) {
          handleError(error, "還原");
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  const downloadCloudImage = useCallback(async (fileId: string): Promise<string | null> => {
      setIsSyncing(true);
      try {
          showToast({ message: "正在下載圖片...", type: 'info' });
          const base64 = await googleDriveService.downloadImage(fileId);
          showToast({ message: "圖片載入完成", type: 'success' });
          return base64;
      } catch (error: any) {
          handleError(error, "圖片下載");
          return null;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  return {
    handleBackup,
    fetchFileList,
    restoreBackup,
    downloadCloudImage,
    isSyncing,
    isMockMode: false
  };
};
