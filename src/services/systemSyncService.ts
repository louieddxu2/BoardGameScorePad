
import { googleDriveService } from './googleDrive';
import { googleDriveClient } from './cloud/googleDriveClient';
import {
  mergeBggGames,
  mergeSessionContextWeights,
  mergeTemplatePrefs,
  hasSameSystemBackupContent
} from './systemBackupMerge';

export const systemSyncService = {
  /**
   * 下載雲端舊檔 -> 與本機合併 -> 僅在內容改變時上傳。
   * 重用當次查詢的檔案 ID；讀取失敗不得覆寫雲端聯集資料。
   */
  async mergeAndBackupSystemSettings(localData: any): Promise<boolean> {
    try {
      await googleDriveService.ensureAppStructure();
      if (!googleDriveService.systemFolderId) throw new Error("System folder missing");

      // 1. 準備本機資料
      const localLib = localData.library || {};
      const finalLib = { ...localLib };
      const localSystem = localData.system || {};
      let finalSystem = { ...localSystem };

      // 2. 查詢一次並保留 ID；只有確定不存在才走首次備份。
      const cloudFile = await googleDriveClient.findFile(
        'settings_backup.json', googleDriveService.systemFolderId, 'application/json',
      );
      const cloudSettings = cloudFile ? await googleDriveClient.downloadFile(cloudFile.id) : undefined;
      if (cloudFile && (!cloudSettings || typeof cloudSettings !== 'object' || Array.isArray(cloudSettings))) {
        throw new Error('Invalid cloud settings backup');
      }

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
        finalLib.players = mergeList(
          localLib.players || [],
          cloudSettings.library.players || [] // 注意：舊版雲端結構可能是 library.players
        );

        // 合併地點清單
        finalLib.locations = mergeList(
          localLib.locations || [],
          cloudSettings.library.locations || []
        );

        finalSystem = {
          bggGames: mergeBggGames(localSystem.bggGames || [], cloudSettings.system?.bggGames || []),
          templatePrefs: mergeTemplatePrefs(localSystem.templatePrefs || [], cloudSettings.system?.templatePrefs || []),
          sessionContextWeights: mergeSessionContextWeights(
            localSystem.sessionContextWeights || {},
            cloudSettings.system?.sessionContextWeights || {}
          )
        };

        console.log(`[SystemSync] Merge complete. Players: ${finalLib.players.length}, Locations: ${finalLib.locations.length}`);
      }

      // 4. 建構上傳封包
      const payload = {
        schemaVersion: 2,
        preferences: localData.preferences, // 設定類 (Theme, Pin) 以本機為主 (Last Write Wins)
        library: finalLib, // 清單類已合併
        system: finalSystem,
        timestamp: Date.now()
      };

      if (cloudSettings && hasSameSystemBackupContent(payload, cloudSettings)) return false;

      // 5. 直接更新已知 ID，或建立查詢已確認不存在的檔案。
      await googleDriveService.saveSystemData('settings_backup.json', payload, cloudFile?.id ?? null);
      return true;

    } catch (error) {
      console.error("[SystemSync] Critical failure:", error);
      throw error; // 拋出錯誤讓外層 UI (SyncDashboard) 顯示紅燈
    }
  }
};
