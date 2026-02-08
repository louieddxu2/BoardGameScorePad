
import { GameOption } from '../types';

/**
 * 比較器函式簽名
 * 回傳負數表示 a 排在 b 前面，正數表示 b 排在 a 前面，0 表示平手
 */
type Comparator = (a: GameOption, b: GameOption) => number;

/**
 * 策略：有釘選的優先
 */
export const byPinned: Comparator = (a, b) => {
  if (a.isPinned === b.isPinned) return 0;
  return a.isPinned ? -1 : 1;
};

/**
 * 策略：依最近使用時間 (越新越前)
 * 保留原本的邏輯：若差異小於 1 秒 (1000ms)，視為同時，交給下一個策略處理
 */
export const byRecency: Comparator = (a, b) => {
  const diff = b.lastUsed - a.lastUsed;
  return Math.abs(diff) > 1000 ? diff : 0;
};

/**
 * 策略：依使用次數 (越多越前)
 */
export const byUsage: Comparator = (a, b) => {
  return b.usageCount - a.usageCount;
};

/**
 * 策略：有計分板模板的優先 (相對於僅有歷史紀錄的項目)
 */
export const byTemplateExistence: Comparator = (a, b) => {
  const aHas = !!a.templateId;
  const bHas = !!b.templateId;
  if (aHas === bHas) return 0;
  return aHas ? -1 : 1;
};

/**
 * 組合工具：應用一系列排序策略
 * @param items 原始陣列
 * @param strategies 比較器列表 (優先權由高到低)
 * @returns 排序後的新陣列
 */
export const applySort = (items: GameOption[], ...strategies: Comparator[]): GameOption[] => {
  return [...items].sort((a, b) => {
    for (const strategy of strategies) {
      const result = strategy(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
};

/**
 * 推薦函式 (Recommendation Logic)
 * 邏輯：取「使用時間最新」的前 2 筆，剩下的取「使用次數最多」的前 3 筆。
 * 總共回傳最多 5 筆，不需再額外排序。
 */
export const getRecommendations = (options: GameOption[]): GameOption[] => {
    if (options.length === 0) return [];

    // 1. 取出最新的 2 筆 (Recent)
    // 復用 applySort 與 byRecency
    const sortedByTime = applySort(options, byRecency);
    const recents = sortedByTime.slice(0, 2);
    
    // 用 Set 紀錄 ID 以便排除
    const recentIds = new Set(recents.map(r => r.uid));

    // 2. 從剩下的項目中，取出最常用的 3 筆 (Popular)
    const remaining = options.filter(r => !recentIds.has(r.uid));
    // 復用 applySort 與 byUsage
    const sortedByUsage = applySort(remaining, byUsage);
    const populars = sortedByUsage.slice(0, 3);

    // 3. 合併結果
    return [...recents, ...populars];
};

/**
 * 搜尋結果處理函式 (Search Results Pipeline)
 * 邏輯：
 * 1. 取搜尋結果前 5 筆。
 * 2. 優先顯示有 Template 的項目。
 * 3. 若無完全匹配的名稱，則在最後加入「建立新遊戲」的虛擬選項。
 */
export const getSearchResults = (options: GameOption[], searchQuery: string): GameOption[] => {
    // 1. 基礎列表：取前 5 筆並排序 (Fuse 已經根據關聯度排過一次，這裡微調優先權)
    // 我們可以信任 Fuse 的結果，但可以將有 Template 的往上提一點，或保持原樣。
    // 使用 byTemplateExistence 讓有模板的優先顯示在前面 (比較好點選)
    const topResults = options.slice(0, 5);
    const sorted = applySort(topResults, byTemplateExistence);

    // 2. 注入「建立」選項
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
        const normalizedQuery = trimmedQuery.toLowerCase();
        
        // 檢查是否已有完全匹配的項目 (忽略大小寫)
        const hasExactMatch = sorted.some(opt => opt.displayName.trim().toLowerCase() === normalizedQuery);

        if (!hasExactMatch) {
             const virtualOption: GameOption = {
                uid: '__CREATE_NEW__', // 特殊 ID 用於 UI 識別
                displayName: trimmedQuery, // 使用者輸入的名稱
                
                // 關鍵：這兩個 ID 為 undefined 會觸發 useGameLauncher 的 "Case B" (建立新遊戲)
                templateId: undefined,
                savedGameId: undefined,
                bggId: undefined,
                
                // 預設值
                lastUsed: 0,
                usageCount: 0,
                isPinned: false,
                defaultPlayerCount: 4,
                defaultScoringRule: 'HIGHEST_WINS',
                _searchTokens: []
             };
             // 加在最後面
             sorted.push(virtualOption);
        }
    }

    return sorted;
};
