
import Dexie, { Table } from 'dexie';
import { GameTemplate, GameSession, TemplatePreference, HistoryRecord, SavedListItem } from './types';

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
    
    // Version 1: 初始結構 (保留歷史紀錄)
    (this as any).version(1).stores({
      templates: 'id, name, updatedAt', 
      systemOverrides: 'id', 
      builtins: 'id, name', 
      sessions: 'id, templateId, startTime, status'
    });

    // Version 2: 新增 templatePrefs 表
    (this as any).version(2).stores({
      templatePrefs: 'templateId' 
    });

    // Version 3: 新增 history 表
    (this as any).version(3).stores({
      history: '++id, templateId, startTime, endTime' 
    });

    // Version 4: 新增玩家與地點清單 (name 設為 unique index)
    (this as any).version(4).stores({
      savedPlayers: '++id, &name, lastUsed, usageCount',
      savedLocations: '++id, &name, lastUsed, usageCount'
    });

    // Version 5: History table PK change (Auto-inc -> UUID) to support Cloud Sync architecture
    (this as any).version(5).stores({
      history: 'id, templateId, startTime, endTime', // Removed ++, 'id' is now provided manually (UUID)
      sessions: 'id, templateId, startTime, status' // Ensure consistency
    });
  }
}

export const db = new ScorePadDatabase();
