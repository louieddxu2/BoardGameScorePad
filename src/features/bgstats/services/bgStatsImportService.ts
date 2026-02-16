
import { BgStatsExport, BgStatsGame, BgStatsPlayer, BgStatsLocation, ImportAnalysisReport, ImportCategoryData, ManualLink, ImportManualLinks } from '../types';
import { HistoryRecord, GameTemplate, Player, SavedListItem, ScoringRule } from '../../../types';
import { generateId } from '../../../utils/idGenerator';
import { db } from '../../../db';
import { importStrategies } from './importStrategies';

class BgStatsImportService {
  
  public async analyzeData(data: BgStatsExport): Promise<ImportAnalysisReport> {
      console.log("[BgStatsImportService] Analyzing data...");

      // 1. 讀取所有本地資料
      const savedGames = await db.savedGames.toArray();
      const savedPlayers = await db.savedPlayers.toArray();
      const savedLocations = await db.savedLocations.toArray();

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

              // 1. UUID Match
              if (imp.uuid) {
                  const match = localByUuid.get(imp.uuid);
                  if (match) {
                      matchedImportIds.add(imp.id);
                      matchedLocalIds.add(match.id);
                      matchFound = true;
                  }
              }

              // 2. BGG ID Match
              if (!matchFound && type === 'game' && imp.bggId && imp.bggId > 0) {
                  const match = localByBggId.get(imp.bggId.toString());
                  if (match) {
                      matchedImportIds.add(imp.id);
                      matchedLocalIds.add(match.id);
                      matchFound = true;
                  }
              }

              // 3. Name Match
              if (!matchFound && imp.name) {
                  const match = localByName.get(imp.name.trim().toLowerCase());
                  if (match) {
                      matchedImportIds.add(imp.id);
                      matchedLocalIds.add(match.id);
                      matchFound = true;
                  }
              }
          });

          const localUnmatched = localItems.filter(l => {
              // 1. 已配對 -> 隱藏
              if (matchedLocalIds.has(l.id)) return false;
              // 2. 已綁定 BGStats UUID -> 隱藏
              if (l.bgStatsId) return false;
              // 3. [New] 遊戲且已綁定 BGG ID -> 隱藏 (視為已識別)
              if (type === 'game' && l.bggId) return false;
              
              return true;
          });
          
          const importUnmatched = importItems.filter(i => !matchedImportIds.has(i.id));

          return { localUnmatched, importUnmatched, matchedCount: matchedImportIds.size };
      };

      // [Filter] 預先過濾掉匿名玩家，不讓其進入分析報告，避免使用者看到並嘗試連結
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

      // 0. Prepare Source Maps (Int ID -> Object) for fast lookup during history processing
      const sourceGames = new Map<number, BgStatsGame>();
      (data.games || []).forEach(g => sourceGames.set(g.id, g));

      const sourcePlayers = new Map<number, BgStatsPlayer>();
      // 注意：這裡必須包含所有玩家(含匿名)，以便後續在 History Processing 階段查閱其 isAnonymous 屬性
      (data.players || []).forEach(p => sourcePlayers.set(p.id, p));

      const sourceLocations = new Map<number, BgStatsLocation>();
      (data.locations || []).forEach(l => sourceLocations.set(l.id, l));

      // --- Phase 1: Entity Resolution (Writes to DB) ---
      // This phase ensures all entities exist in DB with correct bgStatsId (UUID)
      
      // 1.1 Locations
      if (onProgress) onProgress(`正在同步地點...`);
      for (const loc of (data.locations || [])) {
          try {
              const link = links.locations.get(loc.id);
              await importStrategies.resolveLocation(loc.name, loc.uuid, link);
          } catch (e) {
              console.warn(`Skipping location ${loc.name}`, e);
          }
      }

      // 1.2 Players
      if (onProgress) onProgress(`正在同步玩家...`);
      for (const p of (data.players || [])) {
          // [Logic Change] 忽略匿名玩家，不建立實體
          if (p.isAnonymous) continue;

          try {
              const link = links.players.get(p.id);
              await importStrategies.resolvePlayer(p.name, p.uuid, link);
          } catch (e) {
              console.warn(`Skipping player ${p.name}`, e);
          }
      }

      // 1.3 Games
      if (onProgress) onProgress(`正在同步遊戲資料...`);
      for (const g of (data.games || [])) {
          try {
              const link = links.games.get(g.id);
              await importStrategies.resolveGame(g, link);
          } catch (e) {
              console.warn(`Failed to sync game ${g.name}`, e);
          }
      }

      // --- Phase 2: Build Lookup Maps (Read from DB) ---
      // Instead of relying on return values from Phase 1, we trust the DB now.
      // We load all entities that have a bgStatsId into memory for O(1) lookup.
      
      if (onProgress) onProgress("正在建立索引...");
      
      // Map: BgStats UUID -> Local Entity
      const gameLookup = new Map<string, SavedListItem>();
      const playerLookup = new Map<string, SavedListItem>();
      const locationLookup = new Map<string, SavedListItem>();

      // Fetch all SavedGames with bgStatsId
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
          // Check duplication
          if (play.uuid) {
             const existing = await db.history.where('bgStatsId').equals(play.uuid).first();
             if (existing) continue; 
          }

          // Resolve Game
          // Play(Int) -> Source(UUID) -> Lookup(LocalEntity)
          const sourceGame = sourceGames.get(play.gameRefId);
          if (!sourceGame) continue; // Should not happen if data is consistent

          const localGame = gameLookup.get(sourceGame.uuid);
          if (!localGame) {
              // Can't find linked local game, skip play
              continue; 
          }

          // Resolve Location
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
                      // Fallback to name if not found in DB (Graceful degradation)
                      localLocationName = sourceLoc.name;
                  }
              }
          }

          // Resolve Players & Scores
          const players: Player[] = [];
          const winnerIds: string[] = [];
          
          if (Array.isArray(play.playerScores)) {
              play.playerScores.forEach((ps: any, index: number) => {
                  const sourcePlayer = sourcePlayers.get(ps.playerRefId);
                  
                  // Default fallback name (if anonymous or missing)
                  let name = `玩家 ${index + 1}`;
                  let localPlayerId: string | undefined = undefined;

                  if (sourcePlayer) {
                      // [Logic Change] 檢查是否為匿名玩家
                      if (sourcePlayer.isAnonymous) {
                          // 匿名玩家：強制使用「玩家 n」，不連結 ID (防止污染統計)
                          name = `玩家 ${index + 1}`;
                          localPlayerId = undefined;
                      } else {
                          // 具名玩家：嘗試連結本地資料庫
                          const localP = playerLookup.get(sourcePlayer.uuid);
                          if (localP) {
                              localPlayerId = localP.id;
                              name = localP.name; // Use local name if available
                          } else {
                              // 若找不到本地連結 (極少見，除非 Phase 1 失敗)，暫時使用來源名稱
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
                      linkedPlayerId: localPlayerId, // Link to DB player (undefined for Anonymous)
                      isStarter: ps.startPlayer === true || ps.startPlayer === 1
                  };
                  
                  players.push(playerObj);

                  if (ps.winner === true || ps.winner === 1) {
                      winnerIds.push(sessionPlayerId);
                  }
              });
          }

          // Create Snapshot Template
          const snapshotTemplate = this.createEmptySnapshot(sourceGame);
          
          // Determine Scoring Rule
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
              templateId: localGame.id, // Use Local Game ID
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
              scoringRule: scoringRule // [New]
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

      // --- Phase 4: Post-Processing ---
      if (onProgress) onProgress("正在更新計分板資訊...");
      await this.propagateBggIds();
      
      return successCount;
  }

  private parseDate(dateStr: string): number {
      try {
          // BG Stats format: "YYYY-MM-DD HH:mm:ss"
          const d = new Date(dateStr.replace(' ', 'T'));
          if (!isNaN(d.getTime())) return d.getTime();
      } catch(e) {}
      return Date.now();
  }

  private createEmptySnapshot(sourceGame: BgStatsGame): GameTemplate {
      // Determine Scoring Rule
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
          columns: [], // 空欄位，確保不依賴本地欄位設定
          createdAt: Date.now(),
          updatedAt: Date.now(),
          description: "Imported from BG Stats",
          // [重要] 使用 BG Stats 的勝負規則設定
          defaultScoringRule: scoringRule
      };
  }

  private async propagateBggIds() {
      try {
          const templates = await db.templates.toArray();
          const builtins = await db.builtins.toArray();
          const savedGames = await db.savedGames.toArray();
          
          // 建立 SavedGame Lookup (Name -> BGG ID)
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
  }
}

export const bgStatsImportService = new BgStatsImportService();
