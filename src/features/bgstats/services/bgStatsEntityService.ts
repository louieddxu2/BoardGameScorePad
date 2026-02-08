

import { db } from '../../../db';
import { BgStatsGame } from '../types';
import { generateId } from '../../../utils/idGenerator';
import { SavedListItem, BggGame } from '../../../types';
import { DATA_LIMITS } from '../../../dataLimits';

/**
 * BG Stats Entity Service
 * 負責執行資料庫的「寫入」操作：包含「綁定現有」與「建立新項目」。
 * 
 * 核心原則：
 * 1. Bind: 將 bgStatsId 寫入現有的本地資料。對於遊戲，確保 SavedGame 紀錄存在。
 * 2. Create: 僅建立 SavedListItem (列表記錄)，不建立 Template (計分板)。
 */
export class BgStatsEntityService {

  // --- Players ---

  async bindPlayer(localId: string, bgStatsId: string): Promise<void> {
    try {
      await db.savedPlayers.update(localId, { bgStatsId });
    } catch (e) {
      console.warn(`[Binding] Failed to bind player ${localId}`, e);
    }
  }

  async createPlayer(name: string, bgStatsId: string): Promise<string> {
    const newId = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
    const newPlayer: SavedListItem = {
      id: newId,
      name: name.trim(),
      lastUsed: 0,
      usageCount: 0,
      bgStatsId: bgStatsId,
      meta: { relations: {}, confidence: {} }
    };
    await db.savedPlayers.add(newPlayer);
    return newId;
  }

  // --- Locations ---

  async bindLocation(localId: string, bgStatsId: string): Promise<void> {
    try {
      await db.savedLocations.update(localId, { bgStatsId });
    } catch (e) {
      console.warn(`[Binding] Failed to bind location ${localId}`, e);
    }
  }

  async createLocation(name: string, bgStatsId: string): Promise<string> {
    const newId = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT);
    const newLocation: SavedListItem = {
      id: newId,
      name: name.trim(),
      lastUsed: 0,
      usageCount: 0,
      bgStatsId: bgStatsId,
      meta: { relations: {}, confidence: {} }
    };
    await db.savedLocations.add(newLocation);
    return newId;
  }

  // --- Games ---

  /**
   * 綁定遊戲：
   * 1. 順手更新 Template 的 BGG ID (如果存在)。
   * 2. [關鍵] 確保 SavedGame 紀錄存在並更新連結 (Upsert 邏輯)。
   */
  async bindGame(localId: string, sourceGame: BgStatsGame): Promise<void> {
    const updates: any = { bgStatsId: sourceGame.uuid };
    const bggIdStr = (sourceGame.bggId && sourceGame.bggId > 0) ? sourceGame.bggId.toString() : undefined;
    
    if (bggIdStr) {
      updates.bggId = bggIdStr;
    }

    try {
      // 1. 嘗試更新 Template (Side Effect: 順手補資料)
      // 如果這個 ID 是內建遊戲或不存在於 Templates 表，這裡會被忽略，不影響後續流程
      await db.templates.update(localId, updates).catch(() => {});
      
      // 2. 確保 SavedGame 存在並更新連結 (Main Logic)
      const existingGame = await db.savedGames.get(localId);
      let localName = existingGame?.name; // 暫存本地名稱
      
      if (existingGame) {
          // 如果已存在於清單，單純更新連結
          await db.savedGames.update(localId, updates);
      } else {
          // 如果不存在 (例如連結到內建遊戲 Template，但尚未加入過清單)，則建立一筆新的 SavedGame 紀錄
          // 這樣確保了 BGG ID 和 BGStats UUID 有地方存放
          
          // 嘗試從 Template 獲取名稱，因為 SavedGame 不存在
          if (!localName) {
             const tmpl = await db.templates.get(localId);
             const builtin = await db.builtins.get(localId);
             localName = tmpl?.name || builtin?.name || sourceGame.name.trim();
          }

          const newGameRecord: SavedListItem = {
              id: localId, // 使用相同的 ID 連結 Template
              name: localName,
              lastUsed: 0, // 保持為 0，直到真正玩過
              usageCount: 0,
              bgStatsId: sourceGame.uuid,
              bggId: bggIdStr,
              meta: { relations: {}, confidence: {} }
          };
          await db.savedGames.put(newGameRecord);
      }
      
      // [BGG Data] 補充 BGG 資料庫 (百科全書)
      if (sourceGame.bggId) {
          // 將本地名稱傳入，以便註冊為別名
          await this.upsertBggData(sourceGame, localName);
      }
    } catch (e) {
      console.warn(`[Binding] Failed to bind game ${localId}`, e);
    }
  }

  /**
   * 建立遊戲紀錄：只在 SavedGames 建立條目，不建立 Template
   */
  async createGame(sourceGame: BgStatsGame): Promise<string> {
    // 使用預設長度 ID (與其他列表項目一致)
    const newId = generateId(DATA_LIMITS.ID_LENGTH.DEFAULT); 
    const bggIdStr = (sourceGame.bggId && sourceGame.bggId > 0) ? sourceGame.bggId.toString() : undefined;

    // 1. 建立 SavedGame 項目 (僅作為關聯實體)
    const newGame: SavedListItem = {
        id: newId,
        name: sourceGame.name.trim(),
        lastUsed: 0,
        usageCount: 0,
        bgStatsId: sourceGame.uuid,
        bggId: bggIdStr,
        meta: { relations: {}, confidence: {} }
    };
    await db.savedGames.add(newGame);

    // 2. 更新 BGG 資料庫
    if (sourceGame.bggId) {
        await this.upsertBggData(sourceGame);
    }

    return newId;
  }

  // Helper: 更新 BGG 資料表
  // [Fix] 新增 localNameAlias 參數，用於手動綁定時注入本地名稱
  private async upsertBggData(sourceGame: BgStatsGame, localNameAlias?: string) {
      if (!sourceGame.bggId) return;
      const id = sourceGame.bggId.toString();

      // 1. Get existing data to preserve altNames
      const existing = await db.bggGames.get(id);
      const altNames = new Set<string>(existing?.altNames || []);
      
      // 2. Determine Primary Name & Alias
      // sourceGame.name is the name in the user's BG Stats list (e.g. "水壩")
      // sourceGame.bggName is the BGG name (e.g. "Barrage")
      
      // If we have a BGG Name, that is the Source of Truth Name.
      // Otherwise keep existing primary name or fallback to local name.
      const primaryName = sourceGame.bggName || existing?.name || sourceGame.name;
      
      // Case A: Import Source Name differs from Official Name (e.g. BGStats says "水壩", BGG says "Barrage")
      if (sourceGame.name && sourceGame.name !== primaryName) {
          altNames.add(sourceGame.name);
      }

      // Case B: Local Name differs from Official Name (e.g. Local says "強國爭壩", BGG says "Barrage")
      // 這是修復手動連結問題的關鍵：把手動指定的本地名稱也加進去
      if (localNameAlias && localNameAlias !== primaryName) {
          altNames.add(localNameAlias);
      }

      const bggData: BggGame = {
          id: id,
          name: primaryName,
          altNames: Array.from(altNames),
          year: sourceGame.bggYear,
          imageUrl: sourceGame.urlImage || sourceGame.image,
          thumbnailUrl: sourceGame.urlThumb || sourceGame.thumbnail,
          designers: sourceGame.designers,
          minPlayers: sourceGame.minPlayerCount,
          maxPlayers: sourceGame.maxPlayerCount,
          playingTime: sourceGame.maxPlayTime,
          minAge: sourceGame.minAge,
          updatedAt: Date.now()
      };
      await db.bggGames.put(bggData);
  }
}

export const bgStatsEntityService = new BgStatsEntityService();