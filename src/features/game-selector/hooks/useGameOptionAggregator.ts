
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
 * 注意：完全捨棄外部圖片連結 (coverUrl 保持 undefined)，以確保效能與避免破圖。
 */
export const useGameOptionAggregator = (
  templates: GameTemplate[],
  savedGames: SavedListItem[],
  bggGames: BggGameSummary[] = []
) => {
  const allOptions = useMemo<GameOption[]>(() => {
    const map = new Map<string, GameOption>();

    // Helper: Generate Normalized Key (去除前後空白、轉小寫)
    const getKey = (name: string) => name.trim().toLowerCase();

    // --- 1. Base Layer: SavedGames (已存遊戲) ---
    savedGames.forEach(g => {
      const key = getKey(g.name);
      
      const searchTokens = [g.name];
      // 嘗試讀取別名 (如果 SavedGame 有快取的話，通常沒有，主要靠 BGG 補完)
      if ((g as any).altName) searchTokens.push((g as any).altName);

      const option: GameOption = {
        uid: g.id,
        templateId: undefined, // 預設無模板
        savedGameId: g.id,
        bggId: g.bggId,
        displayName: g.name,
        coverUrl: undefined, // [Policy] No external images
        lastUsed: g.lastUsed || 0,
        usageCount: g.usageCount || 0,
        isPinned: false, 
        defaultPlayerCount: 4,
        defaultScoringRule: 'HIGHEST_WINS',
        _searchTokens: searchTokens
      };
      map.set(key, option);
    });

    // --- 2. Overlay Layer: Templates (模板) ---
    templates.forEach(t => {
      const key = getKey(t.name);
      const existing = map.get(key);

      if (existing) {
          // Merge: 既有遊戲庫資料又有模板
          existing.templateId = t.id;
          existing.isPinned = t.isPinned || false;
          existing.lastUsed = Math.max(existing.lastUsed, t.updatedAt || 0);
          
          existing.defaultPlayerCount = t.lastPlayerCount || 4;
          existing.defaultScoringRule = t.defaultScoringRule || 'HIGHEST_WINS';

          if (t.bggId) {
             existing.bggId = t.bggId;
          }
      } else {
          // Create: 純模板 (尚未玩過)
          const searchTokens = [t.name];

          const option: GameOption = {
              uid: t.id,
              templateId: t.id,
              savedGameId: undefined,
              bggId: t.bggId,
              displayName: t.name,
              coverUrl: undefined, // [Policy] No external images
              lastUsed: t.updatedAt || 0,
              usageCount: 0,
              isPinned: t.isPinned || false,
              defaultPlayerCount: t.lastPlayerCount || 4,
              defaultScoringRule: t.defaultScoringRule || 'HIGHEST_WINS',
              _searchTokens: searchTokens
          };
          map.set(key, option);
      }
    });

    // --- 3. Dictionary Layer: BGG Games (字典補完) ---
    bggGames.forEach(bgg => {
        const key = getKey(bgg.name);
        let existing = map.get(key);

        // 嘗試透過別名匹配現有項目 (例如：使用者存了 "卡坦島"，但 BGG 是 "Catan")
        if (!existing && bgg.altNames) {
            for (const alt of bgg.altNames) {
                const altKey = getKey(alt);
                if (map.has(altKey)) {
                    existing = map.get(altKey);
                    break;
                }
            }
        }

        if (existing) {
            // Enrich: 補充現有項目的搜尋關鍵字與 BGG ID
            if (!existing.bggId) existing.bggId = bgg.id;
            
            // 將 BGG 的名稱與別名都加入搜尋索引
            if (!existing._searchTokens.includes(bgg.name)) existing._searchTokens.push(bgg.name);
            if (bgg.altNames) {
                bgg.altNames.forEach(n => {
                    if (!existing!._searchTokens.includes(n)) existing!._searchTokens.push(n);
                });
            }
        } else {
            // Create: 字典中的新遊戲 (使用者沒存過，也沒模板)
            // 讓使用者可以搜尋到並直接建立
            const searchTokens = [bgg.name, ...(bgg.altNames || [])];
            
            // [Smart Default] 使用 BGG 統計的最佳人數，若無則使用最小人數，保底為 4
            const smartPlayerCount = bgg.bestPlayers?.[0] || (bgg.minPlayers ? Math.max(2, bgg.minPlayers) : 4);

            const option: GameOption = {
                uid: `bgg_${bgg.id}`, // 特殊 ID 格式
                templateId: undefined,
                savedGameId: undefined,
                bggId: bgg.id,
                displayName: bgg.name, // 使用 BGG 正式名稱 (通常是英文)
                coverUrl: undefined, // [Policy] No external images
                lastUsed: 0, // 排序最後
                usageCount: 0,
                isPinned: false,
                defaultPlayerCount: smartPlayerCount,
                defaultScoringRule: 'HIGHEST_WINS',
                _searchTokens: searchTokens
            };
            map.set(key, option);
        }
    });

    return Array.from(map.values());
  }, [templates, savedGames, bggGames]);

  return allOptions;
};
