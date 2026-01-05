
import Dexie, { Table } from 'dexie';
import { GameTemplate, GameSession, TemplatePreference, HistoryRecord, SavedListItem } from './types';
import { generateId } from './utils/idGenerator';

export class ScorePadDatabase extends Dexie {
  templates!: Table<GameTemplate>;
  systemOverrides!: Table<GameTemplate>;
  builtins!: Table<GameTemplate>; // 內建遊戲表
  sessions!: Table<GameSession>;
  templatePrefs!: Table<TemplatePreference>; // 模板偏好設定表
  history!: Table<HistoryRecord>; // 歷史紀錄表
  savedPlayers!: Table<SavedListItem>; // [v4] 儲存的玩家清單
  savedLocations!: Table<SavedListItem>; // [v4] 儲存的地點清單

  constructor() {
    super('BoardGameScorePadDB');
    
    // Version 1: 初始結構
    (this as any).version(1).stores({
      templates: 'id, name, updatedAt', 
      systemOverrides: 'id', 
      builtins: 'id, name', 
      sessions: 'id, templateId, startTime, status'
    });

    // Version 2: 新增 templatePrefs
    (this as any).version(2).stores({
      templatePrefs: 'templateId' 
    });

    // Version 3: 新增 history
    (this as any).version(3).stores({
      history: '++id, templateId, startTime, endTime' 
    });

    // Version 4: 新增 lists
    (this as any).version(4).stores({
      savedPlayers: '++id, &name, lastUsed, usageCount',
      savedLocations: '++id, &name, lastUsed, usageCount'
    });

    // Version 5: 中繼遷移 (History PK Change Step 1)
    // IndexedDB 不允許直接修改 PK，必須先刪除舊表，將資料移至臨時表 (New Schema)
    (this as any).version(5).stores({
      history: null, // 刪除舊表 (Auto-inc)
      history_migration: 'id, templateId, startTime, endTime', // 建立臨時表 (UUID)
      sessions: 'id, templateId, startTime, status' // 保持一致
    }).upgrade(async (trans: any) => {
        // 從已刪除的 history 表讀取舊資料 (Dexie 允許在 upgrade 中讀取被 null 掉的表)
        const oldHistory = await trans.table('history').toArray();
        if (oldHistory.length > 0) {
            const newHistory = oldHistory.map((rec: any) => ({
                ...rec,
                // 將數字 ID 轉換為 UUID，若已是字串則保留
                id: typeof rec.id === 'number' ? generateId() : rec.id
            }));
            await trans.table('history_migration').bulkAdd(newHistory);
        }
    });

    // Version 6: 完成遷移 (History PK Change Step 2)
    // 將資料從臨時表移回原本的 history 表 (現在是 New Schema)
    (this as any).version(6).stores({
        history_migration: null, // 刪除臨時表
        history: 'id, templateId, startTime, endTime' // 重建 history 表 (UUID)
    }).upgrade(async (trans: any) => {
        const migratedRecords = await trans.table('history_migration').toArray();
        if (migratedRecords.length > 0) {
            await trans.table('history').bulkAdd(migratedRecords);
        }
    });
  }
}

export const db = new ScorePadDatabase();
