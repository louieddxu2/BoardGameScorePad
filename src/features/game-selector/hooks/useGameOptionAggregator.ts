
import { useMemo } from 'react';
import { GameTemplate, SavedListItem } from '../../../types';
import { BggGameSummary } from '../../../utils/extractDataSummaries';
import { GameOption } from '../types';

/**
 * Game Option Aggregator
 * 
 * 職責：將來自不同來源 (Templates, SavedGames, BggGames) 的資料「聚合」為統一的 GameOption 列表。
 * 
 * 策略：
 * 1. Base Layer (SavedGames): 使用者玩過的遊戲 (最優先)。
 * 2. Overlay Layer (Templates): 模板設定 (覆蓋 SavedGames)。
 * 3. Dictionary Layer (BggGames): BGG 字典 (補完搜尋結果)。
 * 
 * 優化 (v25):
 * 引入雙重索引 (Name Map & ID Map)，優先使用 BGG ID 進行合併，
 * 解決了「已存遊戲有名稱與 ID，但 BGG 字典名稱不同」導致的分身問題。
 */
export const useGameOptionAggregator = (
  templates: GameTemplate[],
  savedGames: SavedListItem[],
  bggGames: BggGameSummary[] = [],
  pinnedIds: string[] = [] // [New] Pass pinned list
) => {
  const allOptions = useMemo<GameOption[]>(() => {
    // Primary Index: Name -> Option
    const nameMap = new Map<string, GameOption>();
    // Secondary Index: BGG ID -> Option (For reliable merging)
    const bggIdMap = new Map<string, GameOption>();

    // Helper: Generate Normalized Key (去除前後空白、轉小寫)
    const getKey = (name: string) => name.trim().toLowerCase();

    // Helper: Register option to maps
    const registerOption = (key: string, option: GameOption) => {
        nameMap.set(key, option);
        if (option.bggId) {
            bggIdMap.set(option.bggId, option);
        }
    };

    // --- 1. Base Layer: SavedGames (已存遊戲) ---
    savedGames.forEach(g => {
      const key = getKey(g.name);
      
      const searchTokens = [g.name];
      // 嘗試讀取別名
      if ((g as any).altName) searchTokens.push((g as any).altName);

      const option: GameOption = {
        uid: g.id,
        templateId: undefined, // 預設無模板
        savedGameId: g.id,
        bggId: g.bggId,
        displayName: g.name,
        // [New] 嘗試將已存的別名(通常是匯入時的英文名)設為 BGG Name 初值
        bggName: (g as any).altName, 
        coverUrl: undefined, 
        lastUsed: g.lastUsed || 0,
        usageCount: g.usageCount || 0,
        isPinned: pinnedIds.includes(g.id),
        defaultPlayerCount: 4,
        defaultScoringRule: 'HIGHEST_WINS',
        _searchTokens: searchTokens
      };
      
      registerOption(key, option);
    });

    // --- 2. Overlay Layer: Templates (模板) ---
    templates.forEach(t => {
      const key = getKey(t.name);
      
      // Try find existing by ID first, then Name
      let existing: GameOption | undefined;
      if (t.bggId) existing = bggIdMap.get(t.bggId);
      if (!existing) existing = nameMap.get(key);

      if (existing) {
          // Merge: 既有遊戲庫資料又有模板
          existing.templateId = t.id;
          // Use pinnedIds to determine status
          existing.isPinned = pinnedIds.includes(t.id);
          existing.lastUsed = Math.max(existing.lastUsed, t.updatedAt || 0);
          
          existing.defaultPlayerCount = t.lastPlayerCount || 4;
          existing.defaultScoringRule = t.defaultScoringRule || 'HIGHEST_WINS';

          if (t.bggId && !existing.bggId) {
             existing.bggId = t.bggId;
             // Update ID map with new info
             bggIdMap.set(t.bggId, existing);
          }
          
          // Ensure name map is consistent if merged by ID but names differed
          if (!nameMap.has(key)) nameMap.set(key, existing);

      } else {
          // Create: 純模板 (尚未玩過)
          const searchTokens = [t.name];

          const option: GameOption = {
              uid: t.id,
              templateId: t.id,
              savedGameId: undefined,
              bggId: t.bggId,
              displayName: t.name,
              // [New] Template doesn't strictly have bggName info locally, leave undefined
              bggName: undefined, 
              coverUrl: undefined,
              lastUsed: t.updatedAt || 0,
              usageCount: 0,
              isPinned: pinnedIds.includes(t.id),
              defaultPlayerCount: t.lastPlayerCount || 4,
              defaultScoringRule: t.defaultScoringRule || 'HIGHEST_WINS',
              _searchTokens: searchTokens
          };
          registerOption(key, option);
      }
    });

    // --- 3. Dictionary Layer: BGG Games (字典補完) ---
    bggGames.forEach(bgg => {
        // [Crucial Upgrade] Priority 1: Merge by BGG ID
        let existing = bggIdMap.get(bgg.id);

        const key = getKey(bgg.name);

        // Priority 2: Merge by Name or Alias (if ID didn't match)
        if (!existing) {
            existing = nameMap.get(key);
            
            // 嘗試透過別名匹配
            if (!existing && bgg.altNames) {
                for (const alt of bgg.altNames) {
                    const altKey = getKey(alt);
                    if (nameMap.has(altKey)) {
                        existing = nameMap.get(altKey);
                        break;
                    }
                }
            }
        }

        if (existing) {
            // Enrich: 補充現有項目的搜尋關鍵字與 BGG ID
            if (!existing.bggId) {
                existing.bggId = bgg.id;
                bggIdMap.set(bgg.id, existing);
            }
            
            // [New] Update BGG Name from the authoritative dictionary
            existing.bggName = bgg.name;
            
            // Enrich: Stats
            if (!existing.minPlayers) existing.minPlayers = bgg.minPlayers;
            if (!existing.maxPlayers) existing.maxPlayers = bgg.maxPlayers;
            if (!existing.playingTime) existing.playingTime = bgg.playingTime;
            if (!existing.complexity) existing.complexity = bgg.complexity;
            if (!existing.bestPlayers) existing.bestPlayers = bgg.bestPlayers;
            
            // 將 BGG 的名稱與別名都加入搜尋索引
            if (!existing._searchTokens.includes(bgg.name)) existing._searchTokens.push(bgg.name);
            if (bgg.altNames) {
                bgg.altNames.forEach(n => {
                    if (!existing!._searchTokens.includes(n)) existing!._searchTokens.push(n);
                });
            }
        } else {
            // Create: 字典中的新遊戲
            const searchTokens = [bgg.name, ...(bgg.altNames || [])];
            const smartPlayerCount = bgg.bestPlayers?.[0] || (bgg.minPlayers ? Math.max(2, bgg.minPlayers) : 4);

            const option: GameOption = {
                uid: `bgg_${bgg.id}`,
                templateId: undefined,
                savedGameId: undefined,
                bggId: bgg.id,
                displayName: bgg.name,
                bggName: bgg.name, // [New] BGG Item's primary name IS the bggName
                coverUrl: undefined,
                lastUsed: 0,
                usageCount: 0,
                isPinned: false,
                defaultPlayerCount: smartPlayerCount,
                defaultScoringRule: 'HIGHEST_WINS',
                minPlayers: bgg.minPlayers,
                maxPlayers: bgg.maxPlayers,
                playingTime: bgg.playingTime,
                complexity: bgg.complexity,
                bestPlayers: bgg.bestPlayers,
                _searchTokens: searchTokens
            };
            
            // Register only to Name Map (ID map not strictly needed as this is the last layer)
            registerOption(key, option);
        }
    });

    // Return unique values
    return Array.from(new Set(nameMap.values()));
  }, [templates, savedGames, bggGames, pinnedIds]);

  return allOptions;
};
