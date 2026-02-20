import { db } from '../../../db';
import { BggGame, SavedListItem } from '../../../types';
import { parseCSV } from '../../../utils/csv';
import { 
    BgStatsExport, BgStatsGame, ImportAnalysisReport, ImportCategoryData, ImportManualLinks 
} from '../../bgstats/types';
import { bgStatsEntityService } from '../../bgstats/services/bgStatsEntityService';

export const bggImportService = {
  
  /**
   * 解析 CSV 並將其轉換為 "偽" BGStats 格式以供分析器使用
   */
  async analyzeData(csvText: string, onProgress?: (msg: string) => void): Promise<ImportAnalysisReport> {
    // 0. Safety Check: Is it HTML?
    if (csvText.trim().toLowerCase().startsWith('<!doctype html') || csvText.trim().toLowerCase().startsWith('<html')) {
        throw new Error("下載到的是網頁而非 CSV，請確認連結是否為公開且正確的 CSV 匯出連結。");
    }

    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error("CSV 為空或格式錯誤");

    // 1. Parse Header
    // Skip empty lines at the beginning
    let headerRowIndex = 0;
    while (headerRowIndex < rows.length && rows[headerRowIndex].length <= 1) {
        headerRowIndex++;
    }
    
    if (headerRowIndex >= rows.length) throw new Error("找不到有效的標題列");

    const header = rows[headerRowIndex].map(h => h.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')); // 保留中文
    console.log("[BGG Import] Detected Headers:", header); 

    const findIdx = (candidates: string[]) => {
        for (const c of candidates) {
            const cleanCand = c.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
            const idx = header.indexOf(cleanCand);
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idx = {
      // 支援中文欄位名稱
      id: findIdx(['Game ID', 'ObjectID', 'BGGID', 'id', 'gameid', '遊戲ID', '編號', 'bgg編號']),
      name: findIdx(['Name', 'ObjectName', 'Title', 'PrimaryName', 'objectname', '名稱', '遊戲名稱', '中文名稱']), 
      altNames: findIdx(['altnames', 'alternate names', '別名', '其他名稱', '英文名稱']), 
      year: findIdx(['YearPublished', 'Year', 'yearpublished', '年份', '出版年份']),
      minPlayers: findIdx(['Min Players', 'minplayers', '最小人數', '最少人數']),
      maxPlayers: findIdx(['Max Players', 'maxplayers', '最大人數', '最多人數']),
      minDuration: findIdx(['Min Duration', 'minduration', '最短時間']),
      maxDuration: findIdx(['Max Duration', 'MaxPlayTime', 'playingtime', 'duration', 'maxplaytime', '時間', '遊戲時間']), 
      minAge: findIdx(['Min Age', 'age', 'minage', '年齡', '適用年齡']),
      rank: findIdx(['Rank', 'GameRank', 'rank', '排名']),
      weight: findIdx(['Weight', 'AverageWeight', 'Complexity', 'averageweight', '重度', '複雜度']),
      bestPlayers: findIdx(['Best Players', 'Recommended Players', 'BGGBestPlayers', '最佳人數', '推薦人數']),
      designers: findIdx(['Designers', 'Designer', '設計師']),
    };

    if (idx.id === -1 || idx.name === -1) {
      throw new Error(`CSV 格式不相符：找不到必要的 'Game ID' 或 '名稱' (Name) 欄位。`);
    }

    if (onProgress) onProgress(`正在解析 ${rows.length - 1} 筆資料...`);

    const importGames: BgStatsGame[] = [];
    const seenIds = new Set<number>();

    // 2. Convert CSV Rows to Pseudo-BgStatsGame objects
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const getVal = (index: number) => (index !== -1 && index < row.length) ? row[index] : undefined;
      const idStr = getVal(idx.id);
      const name = getVal(idx.name);
      
      // [Strict Mode] 必須有 ID 且為有效正整數，否則跳過
      if (!idStr || !name) continue;
      
      const bggId = parseInt(idStr, 10);
      if (isNaN(bggId) || bggId <= 0) continue;

      if (seenIds.has(bggId)) continue;
      seenIds.add(bggId);

      const getNum = (index: number) => {
        const valStr = getVal(index);
        return valStr ? parseFloat(valStr.replace(/[^0-9.]/g, '')) || 0 : 0;
      };
      
      // 解析別名：支援 | 或 , 分隔
      let altNames: string[] = [];
      const rawAltNames = getVal(idx.altNames);
      if (rawAltNames) {
          altNames = rawAltNames.split(/[|,;]/).map(s => s.trim()).filter(s => s && s.toLowerCase() !== name.toLowerCase());
      }

      // 解析最佳人數
      let bestPlayers: number[] = [];
      const bestPlayersStr = getVal(idx.bestPlayers);
      if (bestPlayersStr) {
          const matches = bestPlayersStr.match(/\d+/g);
          if (matches) {
              bestPlayers = Array.from(new Set(matches.map(s => parseInt(s)))).sort((a, b) => a - b);
          }
      }

      const game: any = {
        id: bggId,
        uuid: `bgg:${bggId}`,
        name: name,
        bggId: bggId,
        bggName: name,
        altNames: altNames,
        bggYear: getNum(idx.year),
        designers: getVal(idx.designers),
        minPlayerCount: getNum(idx.minPlayers),
        maxPlayerCount: getNum(idx.maxPlayers),
        maxPlayTime: getNum(idx.maxDuration) || getNum(idx.minDuration),
        minAge: getNum(idx.minAge),
        averageWeight: getNum(idx.weight),
        rank: getNum(idx.rank),
        bestPlayers: bestPlayers,
        modificationDate: new Date().toISOString(),
        cooperative: false
      };
      
      importGames.push(game);
    }

    // 3. Analyze against Local Database
    const savedGames = await db.savedGames.toArray();
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
        // BGG ID Match
        if (imp.bggId && imp.bggId > 0) {
            const match = localByBggId.get(imp.bggId.toString());
            if (match) {
                matchedImportIds.add(imp.id);
                matchedLocalIds.add(match.id);
                matchFound = true;
            }
        }
        // Name Match
        if (!matchFound && imp.name) {
            const match = localByName.get(imp.name.trim().toLowerCase());
            if (match) {
                matchedImportIds.add(imp.id);
                matchedLocalIds.add(match.id);
                matchFound = true;
            }
        }
        
        // [New] Alt Name Match (CSV provided aliases vs Local Name)
        // 這是為了解決 CSV 中有 "Catan" 且別名欄有 "卡坦島"，而本地遊戲只有 "卡坦島" (無 ID) 的情況
        if (!matchFound && imp.altNames && imp.altNames.length > 0) {
            for (const alt of imp.altNames) {
                const match = localByName.get(alt.trim().toLowerCase());
                if (match) {
                    matchedImportIds.add(imp.id);
                    matchedLocalIds.add(match.id);
                    matchFound = true;
                    break; 
                }
            }
        }
    });

    // [Update] Also filter out local games that already have a BGG ID
    const localUnmatched = savedGames.filter(l => !matchedLocalIds.has(l.id) && !l.bggId);
    
    const importUnmatched = importGames.filter(i => !matchedImportIds.has(i.id));
    const emptyCategory: ImportCategoryData = { localUnmatched: [], importUnmatched: [], matchedCount: 0 };
    
    return {
        games: {
            localUnmatched,
            importUnmatched,
            matchedCount: matchedImportIds.size
        },
        players: emptyCategory,
        locations: emptyCategory,
        sourceData: { games: importGames }
    };
  },

  /**
   * 執行匯入
   */
  async importData(
      sourceData: BgStatsExport, 
      links: ImportManualLinks,
      onProgress?: (msg: string) => void
  ): Promise<number> {
      
      const sourceGames = sourceData.games || [];
      if (sourceGames.length === 0) return 0;

      if (onProgress) onProgress(`正在準備 ${sourceGames.length} 筆資料...`);

      const gameLinks = links.games;
      let linkedCount = 0;
      const bggUpdates: BggGame[] = [];
      const savedGameUpdates: { id: string, bggId: string }[] = [];

      const allSavedGames = await db.savedGames.toArray();
      const allTemplates = await db.templates.toArray();
      const allBuiltins = await db.builtins.toArray();
      
      const savedGamesByName = new Map<string, string>();
      const savedGamesByBggId = new Map<string, string>();
      
      const localNamesByBggId = new Map<string, Set<string>>();

      const harvestLocalNames = (items: { bggId?: string, name: string }[]) => {
          items.forEach(item => {
              if (item.bggId && item.name) {
                  const bggId = item.bggId;
                  if (!localNamesByBggId.has(bggId)) {
                      localNamesByBggId.set(bggId, new Set());
                  }
                  localNamesByBggId.get(bggId)!.add(item.name.trim());
              }
          });
      };

      harvestLocalNames(allSavedGames);
      harvestLocalNames(allTemplates);
      harvestLocalNames(allBuiltins);
      
      allSavedGames.forEach(g => {
          savedGamesByName.set(g.name.toLowerCase(), g.id);
          if (g.bggId) savedGamesByBggId.set(g.bggId, g.id);
      });

      for (const srcGame of sourceGames) {
          if (!srcGame.bggId) continue;
          
          const bggIdStr = srcGame.bggId.toString();
          const csvAltNames = new Set<string>((srcGame as any).altNames || []);

          // [Check 1] 檢查是否有手動連結或自動配對的 SavedGame
          let targetLocalId: string | undefined = undefined;
          if (gameLinks.has(srcGame.id)) {
              targetLocalId = gameLinks.get(srcGame.id)!.targetId;
          } else {
               const cleanName = srcGame.name.toLowerCase();
               if (savedGamesByName.has(cleanName)) {
                   targetLocalId = savedGamesByName.get(cleanName);
               } else if (savedGamesByBggId.has(bggIdStr)) {
                   targetLocalId = savedGamesByBggId.get(bggIdStr);
               }

               // 反向別名搜尋
               if (!targetLocalId && srcGame.bggId > 0 && csvAltNames.size > 0) {
                   for (const alt of Array.from(csvAltNames)) {
                       const cleanAlt = (alt as string).trim().toLowerCase();
                       const potentialId = savedGamesByName.get(cleanAlt);
                       if (potentialId) {
                           const localGame = allSavedGames.find(g => g.id === potentialId);
                           if (localGame && !localGame.bggId) {
                               targetLocalId = potentialId;
                               break; 
                           }
                       }
                   }
               }
          }

          if (targetLocalId) {
              savedGameUpdates.push({ id: targetLocalId, bggId: bggIdStr });
              const localGame = allSavedGames.find(g => g.id === targetLocalId);
              if (localGame && localGame.name.trim().toLowerCase() !== srcGame.name.trim().toLowerCase()) {
                  csvAltNames.add(localGame.name.trim());
              }
              linkedCount++;
          }

          const existingLocalNames = localNamesByBggId.get(bggIdStr);
          if (existingLocalNames) {
              existingLocalNames.forEach(name => {
                  if (name.toLowerCase() !== srcGame.name.trim().toLowerCase()) {
                      csvAltNames.add(name);
                  }
              });
          }

          const bggData: BggGame = {
              id: bggIdStr,
              name: srcGame.name,
              altNames: Array.from(csvAltNames), 
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
      }

      const CHUNK_SIZE = 2000;
      const totalBgg = bggUpdates.length;
      
      for (let i = 0; i < totalBgg; i += CHUNK_SIZE) {
          const chunk = bggUpdates.slice(i, i + CHUNK_SIZE);
          const currentProgress = Math.min(totalBgg, i + CHUNK_SIZE);
          if (onProgress) onProgress(`正在寫入 BGG 字典 (${currentProgress} / ${totalBgg})...`);

          await (db as any).transaction('rw', db.bggGames, async () => {
              const ids = chunk.map(g => g.id);
              const existingGames = await db.bggGames.bulkGet(ids);
              const finalChunk = chunk.map((newG, idx) => {
                  const oldG = existingGames[idx];
                  if (oldG) {
                      const oldAltNames = (oldG.altNames || []) as string[];
                      const newAltNames = (newG.altNames || []) as string[];
                      let altNames = new Set<string>([...oldAltNames, ...newAltNames]);
                      
                      if (oldG.name && oldG.name !== newG.name) altNames.add(oldG.name);
                      altNames.delete(newG.name);

                      return {
                          ...newG,
                          altNames: Array.from(altNames),
                          year: newG.year || oldG.year,
                          minPlayers: newG.minPlayers || oldG.minPlayers,
                          maxPlayers: newG.maxPlayers || oldG.maxPlayers,
                          playingTime: newG.playingTime || oldG.playingTime,
                          complexity: newG.complexity || oldG.complexity,
                          bestPlayers: newG.bestPlayers || oldG.bestPlayers
                      };
                  }
                  return newG;
              });
              await db.bggGames.bulkPut(finalChunk);
          });
          await new Promise(r => setTimeout(r, 0));
      }

      if (savedGameUpdates.length > 0) {
          if (onProgress) onProgress(`正在更新 ${savedGameUpdates.length} 個已存遊戲連結...`);
          for (let i = 0; i < savedGameUpdates.length; i += CHUNK_SIZE) {
              const chunk = savedGameUpdates.slice(i, i + CHUNK_SIZE);
              await (db as any).transaction('rw', db.savedGames, async () => {
                  const promises = chunk.map(update => db.savedGames.update(update.id, { bggId: update.bggId }));
                  await Promise.all(promises);
              });
              await new Promise(r => setTimeout(r, 0));
          }
      }

      if (onProgress) onProgress("正在更新計分板連結...");
      await this.propagateBggIds();
      return linkedCount;
  },

  async propagateBggIds() {
      try {
          const templates = await db.templates.toArray();
          const builtins = await db.builtins.toArray();
          const savedGames = await db.savedGames.toArray();
          const gameBggMap = new Map<string, string>();
          savedGames.forEach(g => {
              if (g.bggId && g.name) gameBggMap.set(g.name.trim().toLowerCase(), g.bggId);
          });

          const updates: Promise<any>[] = [];
          const processTemplates = async (list: any[], table: any) => {
              for (const t of list) {
                  if (!t.bggId) {
                      const cleanName = t.name.trim().toLowerCase();
                      
                      let matchBggId = gameBggMap.get(cleanName);
                      
                      if (!matchBggId) {
                          const bggMatch = await db.bggGames.where('name').equalsIgnoreCase(t.name.trim()).first();
                          if (bggMatch) matchBggId = bggMatch.id;
                      }

                      if (!matchBggId) {
                          const bggAltMatch = await db.bggGames.where('altNames').equals(t.name.trim()).first();
                          if (bggAltMatch) matchBggId = bggAltMatch.id;
                      }

                      if (matchBggId) {
                          updates.push(table.update(t.id, { bggId: matchBggId }));
                          // [Critical Fix] 同時觸發歷史紀錄的回溯更新
                          // 確保當計分板被賦予 BGG ID 時，舊的歷史紀錄也能連結上
                          updates.push(bgStatsEntityService.updateHistoryByTemplateId(matchBggId, t.id));
                      }
                  }
              }
          };
          await processTemplates(templates, db.templates);
          await processTemplates(builtins, db.builtins);
          if (updates.length > 0) await Promise.all(updates);
      } catch (e) {
          console.warn("Failed to propagate BGG IDs", e);
      }
  },

  async clearBggDatabase() {
    await db.bggGames.clear();
  }
};