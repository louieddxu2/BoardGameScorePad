
import { useCallback } from 'react';
import { db } from '../db';
import { generateId } from '../utils/idGenerator';
import { SavedListItem } from '../types';
import { Table } from 'dexie';
import { DATA_LIMITS } from '../dataLimits';

export const useLibrary = (onSystemDirty?: () => void) => {
  
  /**
   * [編輯階段] - 輸入名稱時呼叫
   * 功能：確保資料庫有這個人/地點/遊戲。
   * 邏輯：
   * - 若存在：只回傳 ID，不更新 lastUsed (避免在編輯時不斷變動排序)。
   * - 若不存在：建立新項目，usageCount 設為 0，lastUsed 設為 0 (避免新項目直接跳到列表頂端)。
   */
  const ensureLibraryItem = useCallback(async (table: Table<SavedListItem>, name: string, uuid?: string): Promise<string> => {
      if (!name.trim()) return '';
      const cleanName = name.trim();

      try {
          return await (db as any).transaction('rw', table, async () => {
              const existing = await table.where('name').equals(cleanName).first();
              
              if (existing) {
                  // [Modified] 根據需求，在選擇/輸入階段不更新 lastUsed，統一在遊戲結束時處理。
                  // await table.update(existing.id, { lastUsed: Date.now() }); 
                  return existing.id;
              } else {
                  // 建立新項目
                  // [關鍵] usageCount 設為 0 (等待結算時才 +1)
                  // [關鍵] lastUsed 設為 0 (確保新名字排在列表最後，直到遊戲結算更新時間)
                  const newId = uuid || generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
                  await table.add({ 
                      id: newId,
                      name: cleanName, 
                      lastUsed: 0, 
                      usageCount: 0, 
                      predictivePower: 1.0, // [New] 物件本身的預測權重 (預設 1.0)
                      meta: { 
                          relations: {},
                          confidence: {} // [New] 各維度的可信度 (預設為空，由 RelationshipService 填入)
                      } 
                  });
                  return newId;
              }
          });
          
      } catch (error) {
          console.error(`Failed to ensure library item [${name}]:`, error);
          return '';
      } finally {
          if (onSystemDirty) onSystemDirty();
      }
  }, [onSystemDirty]);

  /**
   * [結算階段] - 遊戲結束或儲存歷史紀錄時呼叫
   * 功能：正式確認使用。
   * 邏輯：
   * - usageCount + 1
   * - (未來) 更新關聯權重
   */
  const commitUsage = useCallback(async (table: Table<SavedListItem>, id: string, timestamp: number) => {
      try {
          await (db as any).transaction('rw', table, async () => {
              const item = await table.get(id);
              if (!item) return;

              // 1. 增加總次數 (僅在此時增加)
              const newCount = (item.usageCount || 0) + 1;
              
              await table.update(id, { 
                  usageCount: newCount,
                  lastUsed: timestamp, // Update timestamp to match the record time
                  // [Future] Update relations here
              });
          });
      } catch (error) {
          console.error(`Failed to commit usage for [${id}]:`, error);
      } finally {
          if (onSystemDirty) onSystemDirty();
      }
  }, [onSystemDirty]);

  // --- Public Interface ---

  // 1. Player
  const updatePlayer = useCallback((name: string, uuid?: string) => {
      return ensureLibraryItem(db.savedPlayers, name, uuid);
  }, [ensureLibraryItem]);

  const commitPlayerStats = useCallback((id: string, timestamp: number) => {
      return commitUsage(db.savedPlayers, id, timestamp);
  }, [commitUsage]);

  // 2. Location
  const updateLocation = useCallback((name: string, uuid?: string) => {
      return ensureLibraryItem(db.savedLocations, name, uuid);
  }, [ensureLibraryItem]);

  const commitLocationStats = useCallback((id: string, timestamp: number) => {
      return commitUsage(db.savedLocations, id, timestamp);
  }, [commitUsage]);

  // 3. Game
  const updateGame = useCallback((name: string, uuid?: string) => {
      return ensureLibraryItem(db.savedGames, name, uuid);
  }, [ensureLibraryItem]);

  const commitGameStats = useCallback((id: string, timestamp: number) => {
      return commitUsage(db.savedGames, id, timestamp);
  }, [commitUsage]);

  // 4. Time (Weekday & TimeSlot)
  // 這是特殊函數，因為使用者不會手動輸入「星期五」，而是根據時間戳自動歸類
  const commitTimeStats = useCallback(async (timestamp: number) => {
      const date = new Date(timestamp);
      const dayIndex = date.getDay(); // 0 (Sun) - 6 (Sat)
      const hour = date.getHours();
      const timeSlotIndex = Math.floor(hour / 3); // 0-7 (24h / 3h = 8 slots)

      // 更新星期幾的統計
      await commitUsage(db.savedWeekdays, `weekday_${dayIndex}`, timestamp);
      
      // 更新時段的統計
      await commitUsage(db.savedTimeSlots, `timeslot_${timeSlotIndex}`, timestamp);
  }, [commitUsage]);

  return {
      updatePlayer,        
      updateLocation,
      updateGame,          // [New]
      commitPlayerStats,   
      commitLocationStats,
      commitGameStats,     // [New]
      commitTimeStats      // [New]
  };
};
