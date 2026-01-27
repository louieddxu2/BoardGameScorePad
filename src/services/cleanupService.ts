
import { imageService } from './imageService';
import { googleDriveService } from './googleDrive';

export const cleanupService = {
  /**
   * 清理單一 Session 的關聯資源 (本地圖片、雲端資料夾)
   * 注意：此函式不負責刪除 Session 本體的 DB 紀錄，僅處理副作用
   * 
   * @param sessionId 遊戲場次 ID
   * @param cloudFolderId (選填) 雲端資料夾 ID
   */
  async cleanSessionArtifacts(sessionId: string, cloudFolderId?: string) {
    try {
      // 1. 刪除關聯的本地圖片 (保留 await 確保本地狀態乾淨)
      await imageService.deleteImagesByRelatedId(sessionId);

      // 2. 將雲端資料夾移至垃圾桶 (若有) - [Fix] 改為 Fire-and-forget，不等待網路回應
      if (cloudFolderId) {
        // 檢查 Google Drive 服務是否已授權，避免報錯
        if (googleDriveService.isAuthorized) {
          googleDriveService.softDeleteFolder(cloudFolderId, 'active')
            .catch(e => console.warn(`[Cleanup] Background cloud deletion failed for session ${sessionId}`, e));
        }
      }
    } catch (error) {
      console.error(`[Cleanup] Error cleaning artifacts for session ${sessionId}:`, error);
    }
  }
};
