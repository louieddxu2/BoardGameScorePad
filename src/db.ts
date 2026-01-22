
import Dexie, { Table } from 'dexie';
import { GameTemplate, GameSession, TemplatePreference, HistoryRecord, SavedListItem, LocalImage, AnalyticsLog } from './types';
import { generateId } from './utils/idGenerator';
import { DATA_LIMITS } from './dataLimits';

export class ScorePadDatabase extends Dexie {
  templates!: Table<GameTemplate>;
  systemOverrides!: Table<GameTemplate>;
  builtins!: Table<GameTemplate>; // 內建遊戲表
  sessions!: Table<GameSession>;
  templatePrefs!: Table<TemplatePreference>; // 模板偏好設定表
  history!: Table<HistoryRecord>; // 歷史紀錄表
  savedPlayers!: Table<SavedListItem>; // [v4] 儲存的玩家清單
  savedLocations!: Table<SavedListItem>; // [v4] 儲存的地點清單
  savedGames!: Table<SavedListItem>; // [v12] 儲存的遊戲清單
  savedWeekdays!: Table<SavedListItem>; // [v12] 星期維度 (0-6)
  savedTimeSlots!: Table<SavedListItem>; // [v12] 時段維度 (0-7, 3hr/slot)
  savedPlayerCounts!: Table<SavedListItem>; // [v15] 玩家人數維度 (1-24)
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
    // 1. Delete old tables (auto-inc)
    // 2. Create new tables (uuid)
    // 3. Migrate data (convert old IDs to UUIDs)
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
                // Use existing UUID in meta if available, otherwise generate new one
                id: p.meta?.uuid || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT), 
                // Keep name at root
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

    // Version 12: Add Games, Weekdays, TimeSlots as First-Class Citizens
    (this as any).version(12).stores({
        savedGames: 'id, &name, lastUsed, usageCount',
        savedWeekdays: 'id, &name, lastUsed, usageCount',
        savedTimeSlots: 'id, &name, lastUsed, usageCount'
    }).upgrade(async (trans: any) => {
        // 1. Seed Weekdays (0=Sun, 6=Sat)
        const weekdays = Array.from({length: 7}, (_, i) => ({
            id: `weekday_${i}`,
            name: i.toString(), // 0-6
            lastUsed: Date.now(),
            usageCount: 0,
            meta: {} // Ready for relations
        }));
        await trans.table('savedWeekdays').bulkAdd(weekdays);

        // 2. Seed TimeSlots (8 slots per day, 3 hours each)
        // 0: 00-03, 1: 03-06, ..., 7: 21-24
        // [Modified] Use readable names "00-03" instead of "0"
        const timeSlots = Array.from({length: 8}, (_, i) => {
            const startH = String(i * 3).padStart(2, '0');
            const endH = String((i + 1) * 3).padStart(2, '0');
            return {
                id: `timeslot_${i}`,
                name: `${startH}-${endH}`,
                lastUsed: Date.now(),
                usageCount: 0,
                meta: {} // Ready for relations
            };
        });
        await trans.table('savedTimeSlots').bulkAdd(timeSlots);
    });

    // Version 13: Add analyticsStatus Index (REVERTED)
    // 我們改用外部表 (analyticsLogs)，所以移除 HistoryRecord 內部的索引
    // 但因為 Dexie 的升級是線性的，我們不能直接刪除 v13，而是覆蓋它或在 v14 做修正。
    // 在此為了保持乾淨，我們假設 v13 是一個過渡狀態，v14 才是正式實作。
    
    // Version 14: Add analyticsLogs table
    (this as any).version(14).stores({
        analyticsLogs: 'historyId, status' 
    }).upgrade(async (trans: any) => {
        // Initialization: Scan existing history records and create log entries
        const allHistory = await trans.table('history').toArray();
        
        if (allHistory.length > 0) {
            const logs: AnalyticsLog[] = allHistory.map((rec: HistoryRecord) => ({
                historyId: rec.id,
                // 假設舊資料在存檔當下都已經執行過 RelationshipService (這是 v12 以前的行為)
                // 所以如果有地點，狀態就是 processed。
                // 如果沒有地點，標記為 missing_location 以便未來補地點時觸發更新。
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
        // Seed Player Counts (1 to 24)
        // Cover most board games and party games
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

    // Version 16: Add location to sessions schema (optional for indexing, but good for structure)
    (this as any).version(16).stores({
        sessions: 'id, templateId, startTime, lastUpdatedAt, status' // schema unchanged in Dexie if not indexing new field, but version bump enforces clean state
    });
  }
}

export const db = new ScorePadDatabase();
