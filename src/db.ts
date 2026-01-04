
import Dexie, { Table } from 'dexie';
import { GameTemplate, GameSession, TemplatePreference } from './types';

export class ScorePadDatabase extends Dexie {
  templates!: Table<GameTemplate>;
  systemOverrides!: Table<GameTemplate>;
  builtins!: Table<GameTemplate>; // 內建遊戲表
  sessions!: Table<GameSession>;
  templatePrefs!: Table<TemplatePreference>; // 新增：模板偏好設定表

  constructor() {
    super('BoardGameScorePadDB');
    
    // 定義資料庫結構
    // 注意：Dexie 的 version 升級是累加的，但為了簡化，若您還在開發階段，可以直接修改這裡
    // 若已上線，應使用 .version(2).stores(...)
    (this as any).version(1).stores({
      templates: 'id, name, updatedAt', 
      systemOverrides: 'id', 
      builtins: 'id, name', 
      sessions: 'id, templateId, startTime, status',
      templatePrefs: 'templateId' // 新表，以 templateId 為主鍵
    });
  }
}

export const db = new ScorePadDatabase();
