
import { googleDriveService } from './googleDrive';

export const systemSyncService = {
  /**
   * 執行系統資料的原子化同步：下載雲端舊檔 -> 與本機合併 -> 上傳。
   * 確保雲端始終只有一份最新的聯集資料。
   */
  async mergeAndBackupSystemSettings(localData: any): Promise<void> {
    try {
      await googleDriveService.ensureAppStructure();
      if (!googleDriveService.systemFolderId) throw new Error("System folder missing");

      // 1. 準備本機資料
      const localLib = localData.library || {};
      const finalLib = { ...localLib };

      // 2. 嘗試下載雲端現有資料
      try {
        const cloudSettings = await googleDriveService.getFileContent(
          googleDriveService.systemFolderId,
          'settings_backup.json'
        );

        if (cloudSettings && cloudSettings.library) {
          console.log("[SystemSync] Found cloud settings, merging...");

          // 3. 合併邏輯 (Union)
          // 策略：以 Name 為 Key。
          // 若兩邊都有，保留本機的 (因為本機可能有最新的 usageCount 或 lastUsed)。
          // 若本機沒有但雲端有，則加入 (達成聯集)。
          const mergeList = (local: any[], cloud: any[]) => {
            const map = new Map();
            
            // 先放入雲端資料
            cloud?.forEach(i => {
                if (i && i.name) map.set(i.name, i);
            });
            
            // 再放入本機資料 (覆蓋)
            local?.forEach(i => {
                if (i && i.name) map.set(i.name, i);
            });
            
            return Array.from(map.values());
          };

          // 合併玩家清單
          finalLib.savedPlayers = mergeList(
            localLib.savedPlayers || [],
            cloudSettings.library.players || [] // 注意：舊版雲端結構可能是 library.players
          );

          // 合併地點清單
          finalLib.savedLocations = mergeList(
            localLib.savedLocations || [],
            cloudSettings.library.locations || []
          );
          
          console.log(`[SystemSync] Merge complete. Players: ${finalLib.savedPlayers.length}, Locations: ${finalLib.savedLocations.length}`);
        }
      } catch (e: any) {
        // 404 或網路錯誤通常代表雲端無檔案，或是第一次備份
        // 我們直接忽略錯誤，使用純本機資料上傳
        console.log("[SystemSync] No remote settings found or download failed, uploading local only.");
      }

      // 4. 建構上傳封包
      const payload = {
        preferences: localData.preferences, // 設定類 (Theme, Pin) 以本機為主 (Last Write Wins)
        library: finalLib, // 清單類已合併
        timestamp: Date.now()
      };

      // 5. 上傳 (覆蓋或建立)
      // googleDriveService.saveSystemData 底層會呼叫 uploadFileToFolder
      // 該函式具備 "Find or Create" 邏輯，確保檔案單一性
      await googleDriveService.saveSystemData('settings_backup.json', payload);

    } catch (error) {
      console.error("[SystemSync] Critical failure:", error);
      throw error; // 拋出錯誤讓外層 UI (SyncDashboard) 顯示紅燈
    }
  }
};
