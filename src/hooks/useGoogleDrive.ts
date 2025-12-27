
import { useState, useCallback } from 'react';
import { googleDriveService, CloudFile } from '../services/googleDrive';
import { useToast } from './useToast';
import { GameTemplate } from '../types';
import { useAppData } from './useAppData'; // Assuming we need to set the image

export const useGoogleDrive = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();
  // We need access to setSessionImage from app data if we want to restore background immediately
  // However, hooks rule prevents conditional usage.
  // We will handle the image setting in the component that calls restoreBackup.

  const handleBackup = useCallback(async (template: GameTemplate, imageBase64?: string | null) => {
    setIsSyncing(true);
    try {
      if (!googleDriveService.isAuthorized) {
          showToast({ message: "正在連接 Google 帳號...", type: 'info' });
      } else {
          showToast({ message: "正在上傳備份...", type: 'info' });
      }
      
      await googleDriveService.backupTemplate(template, imageBase64);
      
      showToast({ message: "備份成功！已上傳至雲端。", type: 'success' });
    } catch (error: any) {
      console.error("Backup Error:", error);
      
      // Error handling specifically for Auth issues
      if (error.error === 'popup_closed_by_user') {
          showToast({ message: "取消登入", type: 'info' });
      } else if (error.status === 403 || error.status === 401) {
          showToast({ message: "權限不足，請確認已授權 Google Drive 存取。", type: 'error' });
      } else {
          showToast({ message: `備份失敗: ${error.message || '網路錯誤'}`, type: 'error' });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  const fetchFileList = useCallback(async (): Promise<CloudFile[]> => {
      try {
          return await googleDriveService.listFiles();
      } catch (error: any) {
          console.error("List Files Error:", error);
          if (error.error !== 'popup_closed_by_user') {
             showToast({ message: `讀取列表失敗: ${error.message}`, type: 'error' });
          }
          throw error;
      }
  }, [showToast]);

  const restoreBackup = useCallback(async (fileId: string): Promise<GameTemplate> => {
      setIsSyncing(true);
      try {
          showToast({ message: "正在下載並還原...", type: 'info' });
          const template = await googleDriveService.getFileContent(fileId);
          showToast({ message: "還原成功！", type: 'success' });
          return template;
      } catch (error: any) {
          console.error("Restore Error:", error);
          showToast({ message: `還原失敗: ${error.message}`, type: 'error' });
          throw error;
      } finally {
          setIsSyncing(false);
      }
  }, [showToast]);

  return {
    handleBackup,
    fetchFileList,
    restoreBackup,
    isSyncing,
    isMockMode: false // Force false for production
  };
};
