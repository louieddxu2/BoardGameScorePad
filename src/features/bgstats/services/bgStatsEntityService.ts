
import { db } from '../../../db';
import { BgStatsGame } from '../types';
import { SavedListItem, BggGame } from '../../../types';

/**
 * BG Stats Entity Service
 * 負責執行資料庫的「寫入」操作。
 */
export class BgStatsEntityService {

  // --- History Backfill: Scenario 1 (Template) ---
  /**
   * 情境 A: 當計分板 (Template) 寫入 BGG ID 時
   * 這是最強的關聯，因為 History 直接記錄了 templateId。
   * 直接更新所有使用該 Template ID 的歷史紀錄。
   */
  async updateHistoryByTemplateId(bggId: string, templateId: string): Promise<number> {
      if (!bggId || !templateId) return 0;
      
      try {
          return await db.history
              .where('templateId').equals(templateId)
              .filter(r => !r.bggId) // 只更新還沒有 BGG ID 的
              .modify({ bggId, updatedAt: Date.now() });
      } catch (e) {
          console.error(`[Backfill] Failed for Template ${templateId}`, e);
          return 0;
      }
  }

  // --- History Backfill: Scenario 2 (SavedGame) ---
  /**
   * 情境 B: 當 SavedGame 寫入 BGG ID 時
   * 因為 History 紀錄中並沒有 savedGameId，我們必須透過「名稱匹配」來尋找關聯的歷史紀錄。
   * 邏輯：
   * 1. 讀取 SavedGame 取得主名稱。
   * 2. 讀取 BGG Dictionary 取得別名 (因為 SavedGame 已經連結 BGG)。
   * 3. 掃描 History，若 gameName 符合上述任一名稱且尚未有 BGG ID，則更新。
   */
  async updateHistoryBySavedGame(bggId: string, savedGameId: string): Promise<number> {
      if (!bggId || !savedGameId) return 0;

      try {
          // 1. 取得 SavedGame 名稱
          const savedGame = await db.savedGames.get(savedGameId);
          if (!savedGame) return 0;

          // 2. 收集所有可能的名稱 (Name Set)
          const nameSet = new Set<string>();
          nameSet.add(savedGame.name.trim().toLowerCase());
          
          // 嘗試取得 BGG 別名增強匹配率
          const bggEntry = await db.bggGames.get(bggId);
          if (bggEntry) {
              nameSet.add(bggEntry.name.trim().toLowerCase());
              if (bggEntry.altNames) {
                  bggEntry.altNames.forEach(n => nameSet.add(n.trim().toLowerCase()));
              }
          }

          const searchNames = Array.from(nameSet);

          // 3. 執行更新 (掃描)
          // 由於 gameName 沒有索引，必須使用 filter 掃描全表 (Client-side filtering)
          // 若歷史紀錄量大，這可能會稍慢，但在匯入操作中可接受。
          return await db.history
              .filter(r => {
                  if (r.bggId) return false; // 已有 ID 則跳過
                  if (!r.gameName) return false;
                  const hName = r.gameName.trim().toLowerCase();
                  return searchNames.includes(hName);
              })
              .modify({ bggId, updatedAt: Date.now() });
              
      } catch (e) {
          console.error(`[Backfill] Failed for SavedGame ${savedGameId}`, e);
          return 0;
      }
  }

  // --- Players ---

  async bindPlayer(localId: string, bgStatsId: string): Promise<void> {
    // No-op for Unified UUID Strategy: If localId == bgStatsId, no action needed.
    // If different (manual link), we rely on the ManualLink logic to use the existing ID.
    // We do NOT update a bgStatsId field anymore.
  }

  async createPlayer(name: string, bgStatsId: string): Promise<string> {
    // Use bgStatsId as the primary key
    const newId = bgStatsId; 
    const newPlayer: SavedListItem = {
      id: newId,
      name: name.trim(),
      lastUsed: 0,
      usageCount: 0,
      meta: { relations: {}, confidence: {} }
    };
    await db.savedPlayers.put(newPlayer); // Put handles idempotent create
    return newId;
  }

  // --- Locations ---

  async bindLocation(localId: string, bgStatsId: string): Promise<void> {
     // No-op
  }

  async createLocation(name: string, bgStatsId: string): Promise<string> {
    const newId = bgStatsId;
    const newLocation: SavedListItem = {
      id: newId,
      name: name.trim(),
      lastUsed: 0,
      usageCount: 0,
      meta: { relations: {}, confidence: {} }
    };
    await db.savedLocations.put(newLocation);
    return newId;
  }

  // --- Games ---

  async bindGame(localId: string, sourceGame: BgStatsGame, options: { backfillHistory?: boolean } = {}): Promise<void> {
    const bggIdStr = (sourceGame.bggId && sourceGame.bggId > 0) ? sourceGame.bggId.toString() : undefined;
    
    // Only BGG ID updates are relevant now
    const updates: any = {};
    if (bggIdStr) {
      updates.bggId = bggIdStr;
    } else {
      return; // Nothing to update
    }

    try {
      // 1. 更新 Template (如果存在)
      await db.templates.update(localId, updates).catch(() => {});
      
      // 2. 更新 SavedGame (如果存在)
      const existingGame = await db.savedGames.get(localId);
      let localName = existingGame?.name;
      
      if (existingGame) {
          await db.savedGames.update(localId, updates);
      } else {
          // If binding to an ID that is not a SavedGame (e.g. a Template ID), we might want to create a SavedGame for it
          // But only if we are treating this as a game record.
          if (!localName) {
             const tmpl = await db.templates.get(localId);
             const builtin = await db.builtins.get(localId);
             localName = tmpl?.name || builtin?.name || sourceGame.name.trim();
          }

          const newGameRecord: SavedListItem = {
              id: localId,
              name: localName,
              lastUsed: 0,
              usageCount: 0,
              bggId: bggIdStr,
              meta: { relations: {}, confidence: {} }
          };
          await db.savedGames.put(newGameRecord);
      }
      
      // [單一操作時] 立即觸發歷史補完
      if (options.backfillHistory !== false && bggIdStr) {
          await this.upsertBggData(sourceGame, localName);
          
          // 嘗試兩條路徑更新歷史
          // A. 透過 Template ID (如果 localId 其實是 Template)
          await this.updateHistoryByTemplateId(bggIdStr, localId);
          
          // B. 透過 SavedGame (如果 localId 是 SavedGame)
          await this.updateHistoryBySavedGame(bggIdStr, localId);
      } else if (bggIdStr) {
          // 批次匯入時，只更新 BGG 字典，不跑歷史掃描
          await this.upsertBggData(sourceGame, localName);
      }

    } catch (e) {
      console.warn(`[Binding] Failed to bind game ${localId}`, e);
    }
  }

  async createGame(sourceGame: BgStatsGame, options: { backfillHistory?: boolean } = {}): Promise<string> {
    const newId = sourceGame.uuid; // Use Source UUID as Primary Key
    const bggIdStr = (sourceGame.bggId && sourceGame.bggId > 0) ? sourceGame.bggId.toString() : undefined;

    const newGame: SavedListItem = {
        id: newId,
        name: sourceGame.name.trim(),
        lastUsed: 0,
        usageCount: 0,
        bggId: bggIdStr,
        meta: { relations: {}, confidence: {} }
    };
    await db.savedGames.put(newGame);

    if (bggIdStr) {
        await this.upsertBggData(sourceGame);

        // [單一操作時] 立即觸發歷史補完
        if (options.backfillHistory !== false) {
             await this.updateHistoryBySavedGame(bggIdStr, newId);
        }
    }

    return newId;
  }

  // Helper: 更新 BGG 資料表 (Dictionary)
  private async upsertBggData(sourceGame: BgStatsGame, localNameAlias?: string) {
      if (!sourceGame.bggId) return;
      const id = sourceGame.bggId.toString();

      const existing = await db.bggGames.get(id);
      const altNames = new Set<string>(existing?.altNames || []);
      
      const primaryName = sourceGame.bggName || existing?.name || sourceGame.name;
      
      if (sourceGame.name && sourceGame.name !== primaryName) {
          altNames.add(sourceGame.name);
      }
      if (localNameAlias && localNameAlias !== primaryName) {
          altNames.add(localNameAlias);
      }

      const bggData: BggGame = {
          id: id,
          name: primaryName,
          altNames: Array.from(altNames),
          year: sourceGame.bggYear ?? existing?.year,
          designers: sourceGame.designers || existing?.designers,
          minPlayers: sourceGame.minPlayerCount || existing?.minPlayers,
          maxPlayers: sourceGame.maxPlayerCount || existing?.maxPlayers,
          playingTime: sourceGame.maxPlayTime || existing?.playingTime, 
          minAge: sourceGame.minAge || existing?.minAge,
          complexity: sourceGame.averageWeight || existing?.complexity,
          rank: sourceGame.rank || existing?.rank,
          bestPlayers: existing?.bestPlayers,
          updatedAt: Date.now()
      };
      await db.bggGames.put(bggData);
  }
}

export const bgStatsEntityService = new BgStatsEntityService();
