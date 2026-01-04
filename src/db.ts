
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
    
    // Version 1: 初始結構 (保留歷史紀錄)
    this.version(1).stores({
      templates: 'id, name, updatedAt', 
      systemOverrides: 'id', 
      builtins: 'id, name', 
      sessions: 'id, templateId, startTime, status'
    });

    // Version 2: 新增 templatePrefs 表
    // Dexie 的 version 是累加的，這裡只需要定義新增或修改的表
    this.version(2).stores({
      templatePrefs: 'templateId' 
    });
  }
}

export const db = new ScorePadDatabase();
