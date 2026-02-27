
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
 * [New] 若顯示名稱與 BGG 原名不同，自動格式化為 "顯示名稱 (BGG原名)"。
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
  const results = [...recents, ...populars];

  // 4. [New] 格式化顯示名稱
  return results.map(opt => {
    // 若有 BGG 原名，且與顯示名稱不同，則格式化為 "顯示名稱 (BGG原名)"
    if (opt.bggName && opt.displayName.toLowerCase() !== opt.bggName.toLowerCase()) {
      return {
        ...opt,
        cleanName: opt.displayName, // 原始顯示名稱即為純淨名稱
        displayName: `${opt.displayName} (${opt.bggName})`
      };
    }
    return opt;
  });
};

/**
 * 搜尋結果處理函式 (Search Results Pipeline)
 * 邏輯：
 * 1. 取搜尋結果前 5 筆。
 * 2. [New] 若搜尋關鍵字命中別名，優先顯示該別名。
 * 3. [New] 若命中的別名與 BGG 原名不同，則在後方括號補充 BGG 原名。
 * 4. [Remove] 移除「優先顯示有 Template 的項目」排序，保持 Fuse 相關性排序。
 * 5. 若無完全匹配的名稱，則在最後加入「建立新遊戲」的虛擬選項。
 */
export const getSearchResults = (options: GameOption[], searchQuery: string): GameOption[] => {
  const trimmedQuery = searchQuery.trim();

  // 1. 基礎列表：取前 5 筆
  // 由於 Fuse 已經根據相關性排序，這裡直接取前 5 筆即可保留該排序
  let topResults = options.slice(0, 5);

  // 2. [Removed] 排序：不再強制優先顯示有 Template 的項目，保留 Fuse 分數排序。
  // const sorted = applySort(topResults, byTemplateExistence);
  const sorted = topResults;

  // 3. 注入「建立」選項
  if (trimmedQuery) {
    const normalizedQuery = trimmedQuery.toLowerCase();

    // 檢查是否已有完全匹配的項目 (忽略大小寫)
    // 這裡檢查 cleanName 或 displayName
    const hasExactMatch = sorted.some(opt =>
      (opt.cleanName || opt.displayName).trim().toLowerCase() === normalizedQuery
    );

    if (!hasExactMatch) {
      const virtualOption: GameOption = {
        uid: '__CREATE_NEW__', // 特殊 ID 用於 UI 識別
        displayName: trimmedQuery, // 使用者輸入的名稱
        cleanName: trimmedQuery,

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
