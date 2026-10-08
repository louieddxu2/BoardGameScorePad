
import { db } from '../../../db';
import { BgStatsGame } from '../types';
import { SavedListItem } from '../../../types';
import { fillHistoryBggId, normalizeBggId } from './bgStatsBggData';
import { enrichBggDictionary } from './bgStatsBggDictionary';

export interface BgStatsGameWriteOptions {
  backfillHistory?: boolean;
  deferDictionary?: boolean;
}

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
              .filter(record => !normalizeBggId(record.bggId))
              .modify(record => fillHistoryBggId(record, bggId, Date.now()) || false);
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
                  if (normalizeBggId(r.bggId)) return false;
                  if (!r.gameName) return false;
                  const hName = r.gameName.trim().toLowerCase();
                  return searchNames.includes(hName);
              })
              .modify(record => fillHistoryBggId(record, bggId, Date.now()) || false);
              
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

  async bindGame(localId: string, sourceGame: BgStatsGame, options: BgStatsGameWriteOptions = {}): Promise<string | undefined> {
    const bggId = normalizeBggId(sourceGame.bggId);
    if (!bggId) return;

    let localName: string | undefined;
    let compatible = true;
    await db.transaction('rw', db.savedGames, db.templates, db.builtins, async () => {
      const [game, template, builtin] = await Promise.all([
        db.savedGames.get(localId), db.templates.get(localId), db.builtins.get(localId)
      ]);
      const rows = [game, template, builtin].filter(row => !!row);
      compatible = rows.every(row => !normalizeBggId(row?.bggId) || normalizeBggId(row?.bggId) === bggId);
      if (!compatible) return; // A known conflicting ID is not a missing field.
      localName = game?.name || template?.name || builtin?.name || sourceGame.name.trim();

      if (game) {
        if (!normalizeBggId(game.bggId)) await db.savedGames.update(localId, { bggId });
      } else {
        await db.savedGames.put({
          id: localId, name: localName, bggId, lastUsed: 0, usageCount: 0,
          meta: { relations: {}, confidence: {} }
        });
      }
      const now = Date.now();
      if (template && !normalizeBggId(template.bggId)) {
        await db.templates.update(localId, { bggId, updatedAt: now });
      }
      if (builtin && !normalizeBggId(builtin.bggId)) {
        await db.builtins.update(localId, { bggId, updatedAt: now });
      }
    });

    if (!options.deferDictionary) {
      await enrichBggDictionary([sourceGame], localName ? new Map([[sourceGame.id, localName]]) : undefined);
    }
    if (compatible && options.backfillHistory !== false) {
      await this.updateHistoryByTemplateId(bggId, localId);
      await this.updateHistoryBySavedGame(bggId, localId);
    }
    return localName;
  }

  async createGame(sourceGame: BgStatsGame, options: BgStatsGameWriteOptions = {}): Promise<string> {
    const newId = sourceGame.uuid;
    const bggIdStr = normalizeBggId(sourceGame.bggId);

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
        if (!options.deferDictionary) await enrichBggDictionary([sourceGame]);

        // [單一操作時] 立即觸發歷史補完
        if (options.backfillHistory !== false) {
             await this.updateHistoryBySavedGame(bggIdStr, newId);
        }
    }

    return newId;
  }

}

export const bgStatsEntityService = new BgStatsEntityService();
