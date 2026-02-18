import { BgStatsExport, BgStatsGame, BgStatsPlayer, BgStatsLocation, ImportAnalysisReport, ImportCategoryData, ManualLink, ImportManualLinks } from '../types';
import { HistoryRecord, GameTemplate, Player, SavedListItem, ScoringRule } from '../../../types';
import { generateId } from '../../../utils/idGenerator';
import { db } from '../../../db';
import { importStrategies } from './importStrategies';
import { bgStatsEntityService } from './bgStatsEntityService';

class BgStatsImportService {
  
  public async analyzeData(data: BgStatsExport): Promise<ImportAnalysisReport> {
      console.log("[BgStatsImportService] Analyzing data...");

      // 1. 讀取所有本地資料
      const savedGames = await db.savedGames.toArray();
      const savedPlayers = await db.savedPlayers.toArray();
      const savedLocations = await db.savedLocations.toArray();
      
      // [New] 讀取 BGG 字典以支援別名匹配
      const bggDict = await db.bggGames.toArray();
      const aliasToBggId = new Map<string, string>();
      
      bggDict.forEach(entry => {
          // 將主名稱與所有別名都映射到 BGG ID
          const id = entry.id;
          if (entry.name) aliasToBggId.set(entry.name.toLowerCase().trim(), id);
          if (entry.altNames) {
              entry.altNames.forEach(alt => aliasToBggId.set(alt.toLowerCase().trim(), id));
          }
      });

      // 2. 準備遊戲候選清單 (Game Identities)
      const gameIdentityMap = new Map<string, SavedListItem>();

      savedGames.forEach(g => {
          gameIdentityMap.set(g.name.trim().toLowerCase(), g);
      });

      const localGameCandidates = Array.from(gameIdentityMap.values());

      const analyzeCategory = <TLocal extends SavedListItem, TImport extends { id: number, uuid: string, name: string, bggId?: number }>(
          localItems: TLocal[],
          importItems: TImport[] = [],
          type: 'game' | 'player' | 'location'
      ): ImportCategoryData => {
          
          const matchedImportIds = new Set<number>();
          const matchedLocalIds = new Set<string>();

          const localByUuid = new Map<string, TLocal>();
          const localByBggId = new Map<string, TLocal>(); 
          const localByName = new Map<string, TLocal>();

          localItems.forEach(local => {
              if (local.bgStatsId) localByUuid.set(local.bgStatsId, local);
              if (type === 'game' && local.bggId) localByBggId.set(local.bggId.toString(), local);
              
              const cleanName = local.name.trim().toLowerCase();
              if (cleanName) localByName.set(cleanName, local);
          });

          importItems.forEach(imp => {
              let matchFound = false;

              // 1. UUID Match (Strongest)
              if (imp.uuid) {
                  const match = localByUuid.get(imp.uuid);
                  if (match) {
                      matchedImportIds.add(imp.id);
                      matchedLocalIds.add(match.id);
                      matchFound = true;
                  }
              }

              // 2. BGG ID Match (Explicit)
              if (!matchFound && type === 'game' && imp.bggId && imp.bggId > 0) {
                  const match = localByBggId.get(imp.bggId.toString());
                  if (match) {
                      matchedImportIds.add(imp.id);
                      matchedLocalIds.add(match.id);
                      matchFound = true;
                  }
              }

              // 3. Name Match (Exact)
              if (!matchFound && imp.name) {
                  const match = localByName.get(imp.name.trim().toLowerCase());
                  if (match) {
                      matchedImportIds.add(imp.id);
                      matchedLocalIds.add(match.id);
                      matchFound = true;
                  }
              }

              // 4. [New] Dictionary Alias Match (Indirect via BGG Dictionary)
              // 邏輯：ImportName -> BGG Dictionary -> BGG ID -> Local Game (w/ BGG ID)
              if (!matchFound && type === 'game' && imp.name) {
                  const cleanName = imp.name.trim().toLowerCase();
                  const dictBggId = aliasToBggId.get(cleanName);
                  
                  if (dictBggId) {
                      // 字典說這個名字對應到某個 BGG ID，檢查本地是否有遊戲綁定此 ID
                      const match = localByBggId.get(dictBggId);
                      if (match) {
                          matchedImportIds.add(imp.id);
                          matchedLocalIds.add(match.id);
                          matchFound = true;
                      }
                  }
              }
          });

          const localUnmatched = localItems.filter(l => {
              if (matchedLocalIds.has(l.id)) return false;
              if (l.bgStatsId) return false;
              if (type === 'game' && l.bggId) return false;
              return true;
          });
          
          const importUnmatched = importItems.filter(i => !matchedImportIds.has(i.id));

          return { localUnmatched, importUnmatched, matchedCount: matchedImportIds.size };
      };

      const validSourcePlayers = (data.players || []).filter(p => !p.isAnonymous);

      return {
          games: analyzeCategory(localGameCandidates, data.games, 'game'),
          players: analyzeCategory(savedPlayers, validSourcePlayers, 'player'),
          locations: analyzeCategory(savedLocations, data.locations, 'location'),
          sourceData: data
      };
  }

  public async importData(
      data: BgStatsExport, 
      links: ImportManualLinks, 
      onProgress?: (msg: string) => void
  ): Promise<number> {
      
      console.log("[BgStatsImportService] Starting import...");

      // 0. Prepare Source Maps
      const sourceGames = new Map<number, BgStatsGame>();
      (data.games || []).forEach(g => sourceGames.set(g.id, g));

      const sourcePlayers = new Map<number, BgStatsPlayer>();
      (data.players || []).forEach(p => sourcePlayers.set(p.id, p));

      const sourceLocations = new Map<number, BgStatsLocation>();
      (data.locations || []).forEach(l => sourceLocations.set(l.id, l));

      // [Cache for Phase 5] Map BGG ID to Set of Local IDs (Templates or SavedGames)
      // 這解決了 templates 表格中 bggId 沒有索引導致無法反查的問題
      const bggToLocalIdMap = new Map<string, Set<string>>();

      // --- Phase 1: Entity Resolution (Writes to DB) ---
      
      if (onProgress) onProgress(`正在同步地點...`);
      for (const loc of (data.locations || [])) {
          try {
              const link = links.locations.get(loc.id);
              await importStrategies.resolveLocation(loc.name, loc.uuid, link);
          } catch (e) {
              console.warn(`Skipping location ${loc.name}`, e);
          }
      }

      if (onProgress) onProgress(`正在同步玩家...`);
      for (const p of (data.players || [])) {
          if (p.isAnonymous) continue;
          try {
              const link = links.players.get(p.id);
              await importStrategies.resolvePlayer(p.name, p.uuid, link);
          } catch (e) {
              console.warn(`Skipping player ${p.name}`, e);
          }
      }

      if (onProgress) onProgress(`正在同步遊戲資料...`);
      const processedBggIds = new Set<string>();

      for (const g of (data.games || [])) {
          try {
              const link = links.games.get(g.id);
              // 批次匯入時關閉即時回溯，統一在 Phase 5 處理
              const localId = await importStrategies.resolveGame(g, link, { backfillHistory: false });
              
              if (g.bggId) {
                  const bggIdStr = g.bggId.toString();
                  processedBggIds.add(bggIdStr);

                  // 記錄這個 BGG ID 對應到的 Local ID (可能是 Template 或 SavedGame)
                  if (!bggToLocalIdMap.has(bggIdStr)) {
                      bggToLocalIdMap.set(bggIdStr, new Set());
                  }
                  bggToLocalIdMap.get(bggIdStr)!.add(localId);
              }
          } catch (e) {
              console.warn(`Failed to sync game ${g.name}`, e);
          }
      }

      // --- Phase 2: Build Lookup Maps ---
      if (onProgress) onProgress("正在建立索引...");
      const gameLookup = new Map<string, SavedListItem>();
      const playerLookup = new Map<string, SavedListItem>();
      const locationLookup = new Map<string, SavedListItem>();

      await db.savedGames.where('bgStatsId').notEqual('').each(g => {
          if (g.bgStatsId) gameLookup.set(g.bgStatsId, g);
      });
      await db.savedPlayers.where('bgStatsId').notEqual('').each(p => {
          if (p.bgStatsId) playerLookup.set(p.bgStatsId, p);
      });
      await db.savedLocations.where('bgStatsId').notEqual('').each(l => {
          if (l.bgStatsId) locationLookup.set(l.bgStatsId, l);
      });

      // --- Phase 3: History Processing ---
      const plays = data.plays || [];
      if (onProgress) onProgress(`正在匯入 ${plays.length} 筆遊玩紀錄...`);
      
      let successCount = 0;
      const historyBatch: HistoryRecord[] = [];
      const BATCH_SIZE = 100;

      for (const play of plays) {
          if (play.uuid) {
             const existing = await db.history.where('bgStatsId').equals(play.uuid).first();
             if (existing) continue; 
          }

          const sourceGame = sourceGames.get(play.gameRefId);
          if (!sourceGame) continue; 

          const localGame = gameLookup.get(sourceGame.uuid);
          if (!localGame) continue; 

          let localLocationName: string | undefined = undefined;
          let localLocationId: string | undefined = undefined;
          if (play.locationRefId) {
              const sourceLoc = sourceLocations.get(play.locationRefId);
              if (sourceLoc) {
                  const localLoc = locationLookup.get(sourceLoc.uuid);
                  if (localLoc) {
                      localLocationName = localLoc.name;
                      localLocationId = localLoc.id;
                  } else {
                      localLocationName = sourceLoc.name;
                  }
              }
          }

          const players: Player[] = [];
          const winnerIds: string[] = [];
          
          if (Array.isArray(play.playerScores)) {
              play.playerScores.forEach((ps: any, index: number) => {
                  const sourcePlayer = sourcePlayers.get(ps.playerRefId);
                  let name = `玩家 ${index + 1}`;
                  let localPlayerId: string | undefined = undefined;

                  if (sourcePlayer) {
                      if (sourcePlayer.isAnonymous) {
                          name = `玩家 ${index + 1}`;
                          localPlayerId = undefined;
                      } else {
                          const localP = playerLookup.get(sourcePlayer.uuid);
                          if (localP) {
                              localPlayerId = localP.id;
                              name = localP.name; 
                          } else {
                              name = sourcePlayer.name;
                          }
                      }
                  }

                  const scoreStr = ps.score || "0";
                  const scoreNum = parseFloat(scoreStr);
                  const validScore = isNaN(scoreNum) ? 0 : scoreNum;
                  const sessionPlayerId = `player_${index + 1}`;

                  const playerObj: Player = {
                      id: sessionPlayerId,
                      name: name,
                      color: 'transparent',
                      scores: {}, 
                      totalScore: validScore,
                      linkedPlayerId: localPlayerId,
                      isStarter: ps.startPlayer === true || ps.startPlayer === 1
                  };
                  
                  players.push(playerObj);

                  if (ps.winner === true || ps.winner === 1) {
                      winnerIds.push(sessionPlayerId);
                  }
              });
          }

          const snapshotTemplate = this.createEmptySnapshot(sourceGame);
          
          let scoringRule: ScoringRule = 'HIGHEST_WINS';
          if (sourceGame.cooperative) {
              scoringRule = sourceGame.noPoints ? 'COOP_NO_SCORE' : 'COOP';
          } else if (sourceGame.noPoints) {
              scoringRule = 'COMPETITIVE_NO_SCORE';
          } else if (!sourceGame.highestWins) {
              scoringRule = 'LOWEST_WINS';
          }

          const record: HistoryRecord = {
              id: generateId(), 
              bgStatsId: play.uuid, 
              templateId: localGame.id, 
              gameName: localGame.name,
              bggId: (sourceGame.bggId && sourceGame.bggId > 0) ? sourceGame.bggId.toString() : undefined,
              startTime: this.parseDate(play.playDate),
              endTime: this.parseDate(play.playDate) + (play.durationMin || 0) * 60000,
              updatedAt: Date.now(),
              players: players,
              winnerIds: winnerIds,
              snapshotTemplate: snapshotTemplate, 
              location: localLocationName,
              locationId: localLocationId,
              note: play.comments || "",
              scoringRule: scoringRule
          };

          historyBatch.push(record);
          successCount++;

          if (historyBatch.length >= BATCH_SIZE) {
              await db.history.bulkAdd(historyBatch);
              historyBatch.length = 0;
          }
      }

      if (historyBatch.length > 0) {
          await db.history.bulkAdd(historyBatch);
      }

      // --- Phase 4: Propagate BGG IDs ---
      if (onProgress) onProgress("正在更新計分板資訊...");
      await this.propagateBggIds();

      // --- Phase 5: Backfill History ---
      if (processedBggIds.size > 0) {
          if (onProgress) onProgress(`正在連結 ${processedBggIds.size} 款遊戲的歷史紀錄...`);
          
          for (const bggId of processedBggIds) {
              try {
                  // Strategy 1: ID Match (Preferred)
                  // 直接使用 Phase 1 建立的對照表，解決 Templates 表格 bggId 無索引的問題
                  const localIds = bggToLocalIdMap.get(bggId);
                  if (localIds) {
                      for (const localId of localIds) {
                          // updateHistoryByTemplateId 會執行：UPDATE history SET bggId WHERE templateId = localId
                          await bgStatsEntityService.updateHistoryByTemplateId(bggId, localId);
                      }
                  }

                  // Strategy 2: Name Match via SavedGames (Fallback)
                  // SavedGames 表格有 bggId 索引，所以這裡的查詢是有效的
                  // 用於捕捉那些 ID 已經遺失但名稱相符的歷史紀錄
                  const linkedSavedGames = await db.savedGames.where('bggId').equals(bggId).toArray();
                  for (const g of linkedSavedGames) {
                      await bgStatsEntityService.updateHistoryBySavedGame(bggId, g.id);
                  }

              } catch (e) {
                  console.warn(`History backfill failed for BGG ID ${bggId}`, e);
              }
          }
      }
      
      return successCount;
  }

  private parseDate(dateStr: string): number {
      try {
          const d = new Date(dateStr.replace(' ', 'T'));
          if (!isNaN(d.getTime())) return d.getTime();
      } catch(e) {}
      return Date.now();
  }

  private createEmptySnapshot(sourceGame: BgStatsGame): GameTemplate {
      let scoringRule: ScoringRule = 'HIGHEST_WINS';
      if (sourceGame.cooperative) {
          scoringRule = sourceGame.noPoints ? 'COOP_NO_SCORE' : 'COOP';
      } else if (sourceGame.noPoints) {
          scoringRule = 'COMPETITIVE_NO_SCORE';
      } else if (!sourceGame.highestWins) {
          scoringRule = 'LOWEST_WINS';
      }

      return {
          id: generateId(), 
          name: sourceGame.name,
          bggId: (sourceGame.bggId && sourceGame.bggId > 0) ? sourceGame.bggId.toString() : undefined, 
          bgStatsId: sourceGame.uuid, 
          columns: [], 
          createdAt: Date.now(),
          updatedAt: Date.now(),
          description: "Imported from BG Stats",
          defaultScoringRule: scoringRule
      };
  }

  private async propagateBggIds() {
      try {
          const templates = await db.templates.toArray();
          const builtins = await db.builtins.toArray();
          const savedGames = await db.savedGames.toArray();
          
          const gameBggMap = new Map<string, string>();
          savedGames.forEach(g => {
              if (g.bggId && g.name) {
                  gameBggMap.set(g.name.trim().toLowerCase(), g.bggId);
              }
          });

          const updates: Promise<any>[] = [];

          for (const t of templates) {
              if (!t.bggId) {
                  const matchBggId = gameBggMap.get(t.name.trim().toLowerCase());
                  if (matchBggId) {
                      updates.push(db.templates.update(t.id, { bggId: matchBggId }));
                  }
              }
          }

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
  }
}

export const bgStatsImportService = new BgStatsImportService();