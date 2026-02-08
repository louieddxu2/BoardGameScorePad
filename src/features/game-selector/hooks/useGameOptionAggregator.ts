
import { useMemo } from 'react';
import { GameTemplate, SavedListItem } from '../../../types';
import { GameOption } from '../types';

/**
 * Game Option Aggregator
 * 
 * 職責：將來自不同來源 (Templates, SavedGames) 的資料「聚合」為統一的 GameOption 列表。
 * 
 * 核心邏輯：分層疊加 (Layered Overlay)
 * 1. Base Layer (SavedGames): 提供遊戲清單基礎數據 (遊玩次數、最後時間)
 * 2. Overlay Layer (Templates): 提供啟動設定 (人數、規則)、BGG 連結與優先顯示名稱
 */
export const useGameOptionAggregator = (
  templates: GameTemplate[],
  savedGames: SavedListItem[]
) => {
  const allOptions = useMemo<GameOption[]>(() => {
    const map = new Map<string, GameOption>();

    // Helper: Generate Normalized Key (去除前後空白、轉小寫)
    const getKey = (name: string) => name.trim().toLowerCase();

    // 1. Layer: SavedGames (Base Layer - 遊戲庫清單)
    savedGames.forEach(g => {
      const key = getKey(g.name);
      
      const searchTokens = [g.name];
      if (g.bggId) searchTokens.push(g.bggId);
      // 嘗試讀取別名 (如果有)
      if ((g as any).altName) searchTokens.push((g as any).altName);

      const option: GameOption = {
        uid: g.id,
        templateId: undefined, // 預設無模板
        savedGameId: g.id,
        bggId: g.bggId,
        displayName: g.name,
        coverUrl: undefined,
        lastUsed: g.lastUsed || 0,
        usageCount: g.usageCount || 0,
        isPinned: false, // 預設無置頂
        defaultPlayerCount: 4,
        defaultScoringRule: 'HIGHEST_WINS',
        _searchTokens: searchTokens
      };
      map.set(key, option);
    });

    // 2. Layer: Templates (Overlay Layer - 模板定義)
    // 模板具有較高優先權，若名稱相同，將覆蓋或合併至現有項目
    templates.forEach(t => {
      const key = getKey(t.name);
      const existing = map.get(key);

      if (existing) {
          // Merge: 既有遊戲庫資料又有模板
          existing.templateId = t.id;
          existing.isPinned = t.isPinned || false;
          // 時間取較新者 (模板修改時間 vs 遊戲庫最後遊玩時間)
          existing.lastUsed = Math.max(existing.lastUsed, t.updatedAt || 0);
          
          // 覆蓋預設值
          existing.defaultPlayerCount = t.lastPlayerCount || 4;
          existing.defaultScoringRule = t.defaultScoringRule || 'HIGHEST_WINS';

          // BGG ID: 若模板有，優先使用；若無，保留 SavedGame 的
          if (t.bggId) {
             existing.bggId = t.bggId;
             if (!existing._searchTokens.includes(t.bggId)) {
                 existing._searchTokens.push(t.bggId);
             }
          }
      } else {
          // Create: 純模板 (尚未玩過)
          const searchTokens = [t.name];
          if (t.bggId) searchTokens.push(t.bggId);

          const option: GameOption = {
              uid: t.id,
              templateId: t.id,
              savedGameId: undefined,
              bggId: t.bggId,
              displayName: t.name,
              coverUrl: undefined,
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

    // 回傳完整列表 (不排序，交由 UI 層處理)
    return Array.from(map.values());
  }, [templates, savedGames]);

  return allOptions;
};
