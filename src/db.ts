import Dexie, { Table } from 'dexie';
import { GameTemplate, GameSession, TemplatePreference, HistoryRecord, SavedListItem, LocalImage, AnalyticsLog, BggGame } from './types';
import { generateId } from './utils/idGenerator';
import { DATA_LIMITS } from './dataLimits';

export class ScorePadDatabase extends Dexie {
  templates!: Table<GameTemplate>;
  builtins!: Table<GameTemplate>; // 內建遊戲表
  sessions!: Table<GameSession>;
  templatePrefs!: Table<TemplatePreference>; // 模板偏好設定表
  history!: Table<HistoryRecord>; // 歷史紀錄表
  savedPlayers!: Table<SavedListItem>; // [v4] 儲存的玩家清單
  savedLocations!: Table<SavedListItem>; // [v4] 儲存的地點清單
  savedGames!: Table<SavedListItem>; // [v12] 儲存的遊戲清單 (使用者習慣)
  bggGames!: Table<BggGame>; // [v19] BGG 資料庫 (獨立架構)
  savedWeekdays!: Table<SavedListItem>; // [v12] 星期維度 (0-6)
  savedTimeSlots!: Table<SavedListItem>; // [v12] 時段維度 (0-7, 3hr/slot)
  savedPlayerCounts!: Table<SavedListItem>; // [v15] 玩家人數維度 (1-24)
  savedGameModes!: Table<SavedListItem>; // [v23] 遊戲模式維度 (HIGHEST_WINS, etc.)
  images!: Table<LocalImage>; // [v7] 離線圖片儲存
  analyticsLogs!: Table<AnalyticsLog>; // [v14] 統計處理記錄表

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
    (this as any).version(5).stores({
      history: null, // 刪除舊表 (Auto-inc)
      history_migration: 'id, templateId, startTime, endTime', // 建立臨時表 (UUID)
      sessions: 'id, templateId, startTime, status' // 保持一致
    }).upgrade(async (trans: any) => {
        const oldHistory = await trans.table('history').toArray();
        if (oldHistory.length > 0) {
            const newHistory = oldHistory.map((rec: any) => ({
                ...rec,
                id: typeof rec.id === 'number' ? generateId() : rec.id
            }));
            await trans.table('history_migration').bulkAdd(newHistory);
        }
    });

    // Version 6: 完成遷移 (History PK Change Step 2)
    (this as any).version(6).stores({
        history_migration: null, // 刪除臨時表
        history: 'id, templateId, startTime, endTime' // 重建 history 表 (UUID)
    }).upgrade(async (trans: any) => {
        const migratedRecords = await trans.table('history_migration').toArray();
        if (migratedRecords.length > 0) {
            await trans.table('history').bulkAdd(migratedRecords);
        }
    });

    // Version 7: 新增 images 表
    (this as any).version(7).stores({
        images: 'id, relatedId, relatedType, createdAt' // 索引：ID, 關聯ID (查詢用), 類型, 時間
    });

    // Version 8: 新增 lastUpdatedAt 至 sessions 表
    (this as any).version(8).stores({
        sessions: 'id, templateId, startTime, lastUpdatedAt, status' // 新增 lastUpdatedAt 索引
    }).upgrade(async (trans: any) => {
        await trans.table('sessions').toCollection().modify((session: GameSession) => {
            if (!session.lastUpdatedAt) {
                session.lastUpdatedAt = session.startTime;
            }
        });
    });

    // Version 9: 新增 updatedAt 至 history 表
    (this as any).version(9).stores({
        history: 'id, templateId, startTime, endTime, updatedAt'
    }).upgrade(async (trans: any) => {
        await trans.table('history').toCollection().modify((record: HistoryRecord) => {
            if (!record.updatedAt) {
                record.updatedAt = record.endTime;
            }
        });
    });

    // Version 10: Migrate savedPlayers/Locations to UUID PK
    (this as any).version(10).stores({
        savedPlayers: null,
        savedLocations: null,
        savedPlayers_v2: 'id, &name, lastUsed, usageCount', // New UUID Schema
        savedLocations_v2: 'id, &name, lastUsed, usageCount' // New UUID Schema
    }).upgrade(async (trans: any) => {
        // Migrate Players
        const oldPlayers = await trans.table('savedPlayers').toArray();
        if (oldPlayers.length > 0) {
            const newPlayers = oldPlayers.map((p: any) => ({
                ...p,
                id: p.meta?.uuid || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT), 
            }));
            await trans.table('savedPlayers_v2').bulkAdd(newPlayers);
        }

        // Migrate Locations
        const oldLocations = await trans.table('savedLocations').toArray();
        if (oldLocations.length > 0) {
            const newLocations = oldLocations.map((l: any) => ({
                ...l,
                id: l.meta?.uuid || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT),
            }));
            await trans.table('savedLocations_v2').bulkAdd(newLocations);
        }
    });

    // Version 11: Finalize Rename (savedPlayers_v2 -> savedPlayers)
    (this as any).version(11).stores({
        savedPlayers_v2: null,
        savedLocations_v2: null,
        savedPlayers: 'id, &name, lastUsed, usageCount', // UUID PK
        savedLocations: 'id, &name, lastUsed, usageCount' // UUID PK
    }).upgrade(async (trans: any) => {
        const players = await trans.table('savedPlayers_v2').toArray();
        if (players.length > 0) await trans.table('savedPlayers').bulkAdd(players);

        const locations = await trans.table('savedLocations_v2').toArray();
        if (locations.length > 0) await trans.table('savedLocations').bulkAdd(locations);
    });

    // Version 12: Add Games, Weekdays, TimeSlots
    (this as any).version(12).stores({
        savedGames: 'id, &name, lastUsed, usageCount',
        savedWeekdays: 'id, &name, lastUsed, usageCount',
        savedTimeSlots: 'id, &name, lastUsed, usageCount'
    }).upgrade(async (trans: any) => {
        const weekdays = Array.from({length: 7}, (_, i) => ({
            id: `weekday_${i}`,
            name: i.toString(),
            lastUsed: Date.now(),
            usageCount: 0,
            meta: {} 
        }));
        await trans.table('savedWeekdays').bulkAdd(weekdays);

        const timeSlots = Array.from({length: 8}, (_, i) => {
            const startH = String(i * 3).padStart(2, '0');
            const endH = String((i + 1) * 3).padStart(2, '0');
            return {
                id: `timeslot_${i}`,
                name: `${startH}-${endH}`,
                lastUsed: Date.now(),
                usageCount: 0,
                meta: {} 
            };
        });
        await trans.table('savedTimeSlots').bulkAdd(timeSlots);
    });

    // Version 14: Add analyticsLogs table (Skip v13)
    (this as any).version(14).stores({
        analyticsLogs: 'historyId, status' 
    }).upgrade(async (trans: any) => {
        const allHistory = await trans.table('history').toArray();
        if (allHistory.length > 0) {
            const logs: AnalyticsLog[] = allHistory.map((rec: HistoryRecord) => ({
                historyId: rec.id,
                status: rec.location ? 'processed' : 'missing_location',
                lastProcessedAt: Date.now()
            }));
            await trans.table('analyticsLogs').bulkAdd(logs);
        }
    });

    // Version 15: Add savedPlayerCounts table
    (this as any).version(15).stores({
        savedPlayerCounts: 'id, &name, lastUsed, usageCount'
    }).upgrade(async (trans: any) => {
        const counts = Array.from({length: 24}, (_, i) => {
            const count = i + 1;
            return {
                id: `count_${count}`,
                name: count.toString(),
                lastUsed: Date.now(),
                usageCount: 0,
                meta: {}
            };
        });
        await trans.table('savedPlayerCounts').bulkAdd(counts);
    });

    // Version 16: Add location to sessions schema
    (this as any).version(16).stores({
        sessions: 'id, templateId, startTime, lastUpdatedAt, status' 
    });

    // Version 17: Drop systemOverrides (Cleanup)
    (this as any).version(17).stores({
        systemOverrides: null
    });

    // Version 18: Prepare for BGStats/BGG Import (Add Explicit ID Mapping)
    (this as any).version(18).stores({
        savedPlayers: 'id, &name, lastUsed, usageCount, bgStatsId', 
        savedLocations: 'id, &name, lastUsed, usageCount, bgStatsId', 
        savedGames: 'id, &name, lastUsed, usageCount, bgStatsId, bggId', 
        history: 'id, templateId, startTime, endTime, updatedAt, bgStatsId', 
        templates: 'id, name, updatedAt, bgStatsId' 
    });

    // Version 19: Add dedicated BGG Games table
    (this as any).version(19).stores({
        bggGames: 'id, name' // Primary Key: BGG ID
    });
    
    // Version 20: Add altName (English Name) Index
    (this as any).version(20).stores({
        savedGames: 'id, &name, altName, lastUsed, usageCount, bgStatsId, bggId', 
        templates: 'id, name, altName, updatedAt, bgStatsId'
    });

    // Version 21: Add *altNames multi-entry index to BggGame
    (this as any).version(21).stores({
        bggGames: 'id, name, *altNames' 
    });

    // Version 22: Remove altName from savedGames/templates (Consolidated into BggGame)
    (this as any).version(22).stores({
        savedGames: 'id, &name, lastUsed, usageCount, bgStatsId, bggId', 
        templates: 'id, name, updatedAt, bgStatsId'
    }).upgrade(async (trans: any) => {
        // Data cleaning optional, schema change is sufficient for index removal
    });

    // Version 23: Add savedGameModes table (ScoringRule Dimension)
    (this as any).version(23).stores({
        savedGameModes: 'id, &name, lastUsed, usageCount'
    }).upgrade(async (trans: any) => {
        // Seed standard game modes
        const modes = [
            'HIGHEST_WINS',
            'LOWEST_WINS',
            'COOP',
            'COMPETITIVE_NO_SCORE',
            'COOP_NO_SCORE'
        ];
        
        const seedData = modes.map(mode => ({
            id: mode, // ID is the enum key itself
            name: mode, // Name matches ID, translation handles display
            lastUsed: Date.now(),
            usageCount: 0,
            meta: {}
        }));
        
        await trans.table('savedGameModes').bulkAdd(seedData);
    });
  }
}

export const db = new ScorePadDatabase();