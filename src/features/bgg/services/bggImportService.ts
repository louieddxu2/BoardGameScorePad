
import { db } from '../../../db';
import { BggGame, SavedListItem } from '../../../types';
import { parseCSV } from '../../../utils/csv';
import { 
    BgStatsExport, BgStatsGame, ImportAnalysisReport, ImportCategoryData, ImportManualLinks 
} from '../../bgstats/types';

export const bggImportService = {
  
  /**
   * 解析 CSV 並將其轉換為 "偽" BGStats 格式以供分析器使用
   */
  async analyzeData(csvText: string, onProgress?: (msg: string) => void): Promise<ImportAnalysisReport> {
    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error("CSV 為空或格式錯誤");

    // 1. Parse Header
    const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const findIdx = (candidates: string[]) => {
        for (const c of candidates) {
            const idx = header.indexOf(c);
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idx = {
      id: findIdx(['objectid', 'bggid', 'id']),
      name: findIdx(['objectname', 'name', 'title', 'primaryname']), 
      year: findIdx(['yearpublished', 'year']),
      minPlayers: findIdx(['minplayers']),
      maxPlayers: findIdx(['maxplayers']),
      playingTime: findIdx(['playingtime', 'maxplaytime', 'duration']), 
      minAge: findIdx(['minage', 'age']),
      rank: findIdx(['rank', 'gamerank']),
      weight: findIdx(['averageweight', 'avgweight', 'gameweight', 'weight', 'complexity']),
      bestPlayers: findIdx(['bestplayers', 'bggbestplayers']),
      designers: findIdx(['designers', 'designer']),
    };

    if (idx.id === -1 || idx.name === -1) {
      throw new Error("Invalid CSV: Missing 'objectid' or 'objectname' column");
    }

    if (onProgress) onProgress(`正在解析 ${rows.length} 筆資料...`);

    const importGames: BgStatsGame[] = [];
    const seenIds = new Set<number>();
    
    // 2. Convert CSV Rows to Pseudo-BgStatsGame objects
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const getVal = (index: number) => (index !== -1 && index < row.length) ? row[index] : undefined;
      const idStr = getVal(idx.id);
      const name = getVal(idx.name);
      
      if (!idStr || !name) continue;

      const bggId = parseInt(idStr, 10);

      // [Fix] Duplication Check: BGG CSV might contain duplicate rows or React Key collisions if ID is not unique.
      if (isNaN(bggId) || seenIds.has(bggId)) continue;
      seenIds.add(bggId);

      const getNum = (index: number) => {
        const valStr = getVal(index);
        return valStr ? parseFloat(valStr) || 0 : 0;
      };
      
      // Parse Best Players string if exists
      let bestPlayers: number[] = [];
      const bestPlayersStr = getVal(idx.bestPlayers);
      if (bestPlayersStr) {
          bestPlayers = bestPlayersStr.replace(/[\[\]"']/g, '').split(/[,;]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      }

      // 建立一個 "偽" BgStatsGame 物件
      // 注意：我們將 BGG CSV 的資料塞入 BgStatsGame 的擴充欄位或標準欄位中
      const game: BgStatsGame = {
        id: bggId, // 使用 BGG ID 作為暫時 ID
        uuid: `bgg:${bggId}`, // 偽造 UUID
        name: name,
        bggId: bggId,
        bggName: name,
        bggYear: getNum(idx.year),
        designers: getVal(idx.designers),
        minPlayerCount: getNum(idx.minPlayers),
        maxPlayerCount: getNum(idx.maxPlayers),
        maxPlayTime: getNum(idx.playingTime),
        minAge: getNum(idx.minAge),
        averageWeight: getNum(idx.weight),
        rank: getNum(idx.rank),
        bestPlayers: bestPlayers, // Custom field, not standard BgStats but carried over
        // Defaults
        modificationDate: new Date().toISOString(),
        cooperative: false
      };
      
      importGames.push(game);
    }

    // 3. Analyze against Local Database
    // 這部分邏輯複製自 bgStatsImportService，但簡化為只處理遊戲
    
    const savedGames = await db.savedGames.toArray();
    
    // 準備 Local Candidates (移除已設定 bgStatsId 的項目?? 不，這裡是 BGG 匯入，我們主要看 bggId)
    // 策略：找出所有 SavedGames，無論是否已有 BGG ID (我們允許重新連結/修正)
    
    const matchedImportIds = new Set<number>();
    const matchedLocalIds = new Set<string>();

    const localByBggId = new Map<string, SavedListItem>(); 
    const localByName = new Map<string, SavedListItem>();

    savedGames.forEach(local => {
        if (local.bggId) localByBggId.set(local.bggId.toString(), local);
        const cleanName = local.name.trim().toLowerCase();
        if (cleanName) localByName.set(cleanName, local);
    });

    importGames.forEach(imp => {
        let matchFound = false;

        // 1. BGG ID Match (Strongest)
        if (imp.bggId) {
            const match = localByBggId.get(imp.bggId.toString());
            if (match) {
                matchedImportIds.add(imp.id);
                matchedLocalIds.add(match.id);
                matchFound = true;
            }
        }

        // 2. Name Match (Fallback)
        if (!matchFound && imp.name) {
            const match = localByName.get(imp.name.trim().toLowerCase());
            if (match) {
                matchedImportIds.add(imp.id);
                matchedLocalIds.add(match.id);
                matchFound = true;
            }
        }
    });

    // 定義 Unmatched 列表
    // Local Unmatched: 還沒連到 BGG ID 的遊戲 (這是我們主要想解決的)
    // 或者是雖然有 BGG ID 但不在這次 CSV 裡的 (忽略)
    // 這裡我們列出「所有」本地遊戲供使用者選擇，但標記出未配對的
    // 為求簡單，我們列出「沒有被本次 CSV 自動配對到」的本地遊戲
    const localUnmatched = savedGames.filter(l => !matchedLocalIds.has(l.id));
    
    // Import Unmatched: CSV 裡面的遊戲，沒對應到本地遊戲
    const importUnmatched = importGames.filter(i => !matchedImportIds.has(i.id));

    // 建構空的報告結構 (因為只匯入遊戲)
    const emptyCategory: ImportCategoryData = { localUnmatched: [], importUnmatched: [], matchedCount: 0 };
    
    return {
        games: {
            localUnmatched,
            importUnmatched,
            matchedCount: matchedImportIds.size
        },
        players: emptyCategory,
        locations: emptyCategory,
        sourceData: { games: importGames } // 只需要保留 games
    };
  },

  /**
   * 執行匯入
   * 1. 針對有 Link 的：更新 SavedGames (填入 BGG ID)
   * 2. 針對所有 CSV 資料：更新 BggGames (字典)
   * 3. [Fix] Post-Processing: 將 SavedGames 的 BGG ID 擴散到 Templates/Builtins
   */
  async importData(
      sourceData: BgStatsExport, 
      links: ImportManualLinks,
      onProgress?: (msg: string) => void
  ): Promise<number> {
      
      const sourceGames = sourceData.games || [];
      if (sourceGames.length === 0) return 0;

      if (onProgress) onProgress(`正在處理 ${sourceGames.length} 筆資料...`);

      // 1. Build Map of Links for fast lookup
      // Link: ImportID (int) -> LocalID (uuid)
      const gameLinks = links.games;

      // 2. Process Games
      let linkedCount = 0;
      const bggUpdates: BggGame[] = [];
      const savedGameUpdates: Promise<any>[] = [];

      for (const srcGame of sourceGames) {
          if (!srcGame.bggId) continue;
          
          const bggIdStr = srcGame.bggId.toString();

          // A. 處理字典 (BggGame) - 總是執行
          const bggData: BggGame = {
              id: bggIdStr,
              name: srcGame.name,
              altNames: [], 
              year: srcGame.bggYear,
              designers: srcGame.designers,
              minPlayers: srcGame.minPlayerCount,
              maxPlayers: srcGame.maxPlayerCount,
              playingTime: srcGame.maxPlayTime,
              minAge: srcGame.minAge,
              rank: srcGame.rank,
              complexity: srcGame.averageWeight,
              bestPlayers: (srcGame as any).bestPlayers,
              updatedAt: Date.now()
          };
          
          bggUpdates.push(bggData);

          // B. 處理連結 (SavedGame)
          let targetLocalId: string | undefined = undefined;

          // 1. 手動連結
          if (gameLinks.has(srcGame.id)) {
              targetLocalId = gameLinks.get(srcGame.id)!.targetId;
          } 
          // 2. 自動連結 (在 analyze 階段有找到，但 UI 沒顯示出來因為是 matched)
          else {
               const match = await db.savedGames.where('name').equals(srcGame.name).first();
               if (match) {
                   targetLocalId = match.id;
               } else if (srcGame.bggId) {
                   const matchById = await db.savedGames.where('bggId').equals(bggIdStr).first();
                   if (matchById) targetLocalId = matchById.id;
               }
          }

          if (targetLocalId) {
              // 更新 SavedGame
              savedGameUpdates.push(db.savedGames.update(targetLocalId, { bggId: bggIdStr }));
              linkedCount++;
          }
      }

      // 3. Batch Execute Bgg Updates (Safe Merge)
      await (db as any).transaction('rw', db.bggGames, async () => {
          // 讀取現有資料以保留 altNames
          const ids = bggUpdates.map(g => g.id);
          const existingGames = await db.bggGames.bulkGet(ids);
          
          const finalBggGames = bggUpdates.map((newG, i) => {
              const oldG = existingGames[i];
              if (oldG) {
                  // Merge: 保留舊有的別名
                  // 如果名稱變了，把舊名稱加到別名
                  let altNames = new Set(oldG.altNames || []);
                  if (oldG.name && oldG.name !== newG.name) {
                      altNames.add(oldG.name);
                  }
                  // 移除與新名稱重複的別名
                  altNames.delete(newG.name);

                  return {
                      ...newG,
                      altNames: Array.from(altNames),
                      // Prefer new data, fallback to old
                      year: newG.year || oldG.year,
                      minPlayers: newG.minPlayers || oldG.minPlayers,
                  };
              }
              return newG;
          });

          await db.bggGames.bulkPut(finalBggGames);
      });

      // 4. Batch Execute SavedGame Updates
      if (savedGameUpdates.length > 0) {
          await Promise.all(savedGameUpdates);
      }

      // 5. [Post-Processing] Propagate BGG IDs to Templates & Built-ins
      // 這是 BGStats 匯入成功的關鍵，我們在這裡補上
      if (onProgress) onProgress("正在更新計分板連結...");
      await this.propagateBggIds();

      return linkedCount;
  },

  /**
   * 將 SavedGames 中的 BGG ID 同步到 Templates 和 Builtins 表中
   * 這是確保內建模板能顯示封面圖的關鍵步驟
   */
  async propagateBggIds() {
      try {
          const templates = await db.templates.toArray();
          const builtins = await db.builtins.toArray();
          const savedGames = await db.savedGames.toArray();
          
          // 建立 SavedGame Lookup (Name (lowercase) -> BGG ID)
          const gameBggMap = new Map<string, string>();
          savedGames.forEach(g => {
              if (g.bggId && g.name) {
                  gameBggMap.set(g.name.trim().toLowerCase(), g.bggId);
              }
          });

          const updates: Promise<any>[] = [];

          // 1. Process Custom Templates
          for (const t of templates) {
              if (!t.bggId) {
                  const matchBggId = gameBggMap.get(t.name.trim().toLowerCase());
                  if (matchBggId) {
                      updates.push(db.templates.update(t.id, { bggId: matchBggId }));
                  }
              }
          }

          // 2. Process Built-in Templates
          for (const t of builtins) {
              if (!t.bggId) {
                  const matchBggId = gameBggMap.get(t.name.trim().toLowerCase());
                  if (matchBggId) {
                      updates.push(db.builtins.update(t.id, { bggId: matchBggId }));
                  }
              }
          }

          if (updates.length > 0) {
              await Promise.all(updates);
          }
      } catch (e) {
          console.warn("Failed to propagate BGG IDs", e);
      }
  },

  // 保留相容性
  async importFromCsv(csvText: string): Promise<number> {
      // 這是舊的方法，為了讓舊程式碼不報錯，我們進行轉接
      const report = await this.analyzeData(csvText);
      const links: ImportManualLinks = { games: new Map(), players: new Map(), locations: new Map() };
      return await this.importData(report.sourceData, links);
  },

  async clearBggDatabase() {
    await db.bggGames.clear();
  }
};
