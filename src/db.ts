
import Dexie, { Table } from 'dexie';
import { GameTemplate, GameSession } from './types';

export class ScorePadDatabase extends Dexie {
  templates!: Table<GameTemplate>;
  systemOverrides!: Table<GameTemplate>;
  builtins!: Table<GameTemplate>; // 新增：內建遊戲專用表
  sessions!: Table<GameSession>;

  constructor() {
    super('BoardGameScorePadDB');
    
    // 定義資料庫結構
    // 只有需要被搜尋 (Where) 或排序 (OrderBy) 的欄位才需要列在這裡
    (this as any).version(1).stores({
      templates: 'id, name, updatedAt', 
      systemOverrides: 'id', 
      builtins: 'id, name', // 內建遊戲表，只需索引 ID 和 Name 供列表使用
      sessions: 'id, templateId, startTime, status' 
    });
  }
}

export const db = new ScorePadDatabase();
