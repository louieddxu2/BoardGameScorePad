
import { imageService } from './imageService';
import { googleDriveService, getAutoConnectPreference } from './googleDrive';
import { db } from '../db';
import { isDisposableTemplate } from '../utils/templateUtils';

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
        // [Standardized Check] 統一使用共享的 helper
        const isCloudEnabled = getAutoConnectPreference();

        if (isCloudEnabled) {
          googleDriveService.softDeleteFolder(cloudFolderId, 'active')
            .catch(e => console.warn(`[Cleanup] Background cloud deletion failed for session ${sessionId}`, e));
        }
      }
    } catch (error) {
      console.error(`[Cleanup] Error cleaning artifacts for session ${sessionId}:`, error);
    }
  },

  /**
   * 檢查並清理免洗模板
   * 定義：如果一個模板是「免洗」的 (無欄位/無圖/未釘選)，則將其從資料庫中移除。
   * 通常在該模板的 Session 結束或捨棄時呼叫。
   * 
   * @param templateId 模板 ID
   */
  async cleanupDisposableTemplate(templateId: string) {
    try {
      const template = await db.templates.get(templateId);
      if (template && isDisposableTemplate(template)) {
        await db.templates.delete(templateId);
        await db.templatePrefs.delete(templateId);

        // [Standardized Check] 統一使用共享的 helper
        const isCloudEnabled = getAutoConnectPreference();

        if (isCloudEnabled) {
          googleDriveService.softDeleteFolder(templateId, 'template')
            .catch(e => console.warn(`[Cleanup] Cloud deletion failed for disposable template ${templateId}`, e));
        }

        console.log(`[Cleanup] Deleted disposable template: ${template.name} (${templateId})`);
      }
    } catch (e) {
      console.warn(`[Cleanup] Failed to process disposable template ${templateId}`, e);
    }
  },

  /**
   * 徹底刪除一個模板及其所有相關數據
   * 包含：會話(Sessions)、偏好設定(Prefs)、雲端快取(ShareCache)、本地圖片、雲端資料夾
   * 注意：歷史紀錄 (HistoryRecord) 會被保留，因為它包含快照（Snapshot）
   * 
   * @param templateId 模板 ID
   */
  async fullTemplateCleanup(templateId: string) {
    try {
      // 1. [Declarative] 根據 DB 註冊表自動清理所有相依表格
      for (const [tableName, fieldName] of Object.entries(db.templateRegistry)) {
        const table = (db as any)[tableName];
        if (!table) continue;

        if (fieldName === null) {
          // [PK Cleanup] 若主鍵就是 templateId (例如：templates, templatePrefs)
          await table.delete(templateId);
        } else {
          // [FK Cleanup] 若是根據欄位關聯 (例如：sessions)
          const relatedItems = await table.where(fieldName).equals(templateId).toArray();
          if (relatedItems.length === 0) continue;

          // 特殊處理：會話需要額外清理實體檔案 (圖片、雲端)
          if (tableName === 'sessions') {
            for (const s of relatedItems) {
              await this.cleanSessionArtifacts(s.id, s.cloudFolderId);
            }
          }

          // 批量刪除
          await table.bulkDelete(relatedItems.map((item: any) => item.id));
        }
      }

      // 2. 刪除模板層級的圖片資源 (非表格能表達的副作用)
      await imageService.deleteImagesByRelatedId(templateId);

      // 3. 刪除雲端資料夾 (與 fullTemplateCleanup 流程一致，維持 Fire-and-forget)
      const isCloudEnabled = getAutoConnectPreference();
      if (isCloudEnabled) {
        googleDriveService.softDeleteFolder(templateId, 'template')
          .catch(e => console.warn(`[Cleanup] Cloud deletion failed for template ${templateId}`, e));
      }

      console.log(`[Cleanup] Declarative finish for template: ${templateId}`);
    } catch (error) {
      console.error(`[Cleanup] Declarative cleanup failed for ${templateId}:`, error);
      throw error;
    }
  }
};
