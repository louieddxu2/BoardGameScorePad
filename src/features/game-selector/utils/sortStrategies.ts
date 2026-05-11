
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
 * 策略：依遊戲出版年份 (越新越前)
 */
export const byYearPublished: Comparator = (a, b) => {
  const yearA = a.year ?? 0;
  const yearB = b.year ?? 0;
  return yearB - yearA;
};

/**
 * 計算選項在特定篩選條件下的匹配狀態與分數
 * 依據「未知即非否定 (Unknown is not Negative)」與「寬鬆認定」原則：
 * - 當某項資料在資料庫中為 undefined (未知) 時，不視為否定，即不予剔除 (isExplicitNo = false)
 * - 當某項資料明確不符合條件時，才視為否定並剔除 (isExplicitNo = true)
 * - 當某項資料明確符合條件時，累加 matchScore + 1，用於後續「符合優先、未知居後」的排序
 */
export const getOptionFilterScore = (
  opt: GameOption,
  filters: import('../types').SearchFilters,
  playerCount: number
): { isExplicitNo: boolean; matchScore: number } => {
  let isExplicitNo = false;
  let matchScore = 0;

  // 1. 人數過濾 (playerFilter)
  if (filters.playerFilter === 'playable') {
    const minP = opt.minPlayers;
    const maxP = opt.maxPlayers;
    if (minP !== undefined && maxP !== undefined) {
      if (playerCount >= minP && playerCount <= maxP) {
        matchScore += 1;
      } else {
        isExplicitNo = true;
      }
    }
  } else if (filters.playerFilter === 'best') {
    const best = opt.bestPlayers;
    if (best !== undefined) {
      if (best.includes(playerCount)) {
        matchScore += 1;
      } else {
        isExplicitNo = true;
      }
    }
  }

  // 2. 評分過濾 (rating) - 優先使用真實 Rating，無 Rating 則回退至 Rank 智能降級 (8+ 為前 1000, 7+ 為前 5000, 6+ 為前 15000)
  if (filters.rating !== null) {
    if (opt.rating !== undefined) {
      if (opt.rating >= filters.rating) matchScore += 1;
      else isExplicitNo = true;
    } else if (opt.rank !== undefined) {
      const rank = opt.rank;
      if (filters.rating === 8 && rank <= 1000) matchScore += 1;
      else if (filters.rating === 7 && rank <= 5000) matchScore += 1;
      else if (filters.rating === 6 && rank <= 15000) matchScore += 1;
      else isExplicitNo = true;
    }
  }

  // 3. 複雜度過濾 (complexity) - 輕量 (complexity <= 2.0), 中等 (2.0 < complexity <= 3.5), 重量 (complexity > 3.5)
  if (filters.complexity !== null) {
    const comp = opt.complexity;
    if (comp !== undefined) {
      if (filters.complexity === 'light' && comp <= 2.0) matchScore += 1;
      else if (filters.complexity === 'mid' && comp > 2.0 && comp <= 3.5) matchScore += 1;
      else if (filters.complexity === 'heavy' && comp > 3.5) matchScore += 1;
      else isExplicitNo = true;
    }
  }

  // 4. 遊戲時長過濾 (duration) - playingTime <= d
  if (filters.duration !== null) {
    const time = opt.playingTime;
    if (time !== undefined) {
      if (time <= filters.duration) matchScore += 1;
      else isExplicitNo = true;
    }
  }

  // 5. 情境過濾組 (Scenarios) - 採獨立切換開關，互不相干
  
  // [5A] 合作 (isCoop)
  if (filters.isCoop) {
    if (opt.cooperative === true) matchScore += 1;
    else isExplicitNo = true;
  }

  // [5B] 派對 (isParty)
  if (filters.isParty) {
    // 合併檢索 Domain 與 Categories
    const combinedTags = [...(opt.domains || []), ...(opt.categories || [])].join(' ').toLowerCase();
    const isPartyGame = combinedTags.includes('party');
    if (isPartyGame) matchScore += 1;
    else isExplicitNo = true;
  }

  // [5C] 家庭 (isFamily)
  if (filters.isFamily) {
    const combinedTags = [...(opt.domains || []), ...(opt.categories || [])].join(' ').toLowerCase();
    const isFamilyGame = combinedTags.includes('family');
    if (isFamilyGame) matchScore += 1;
    else isExplicitNo = true;
  }

  // [5D] 小桌子 (smallTable) V2 - 高寬容智慧物理演算法
  if (filters.smallTable) {
    // 安全網檢查：如果有抓到配件清單、系列或機制
    const rawFamilies = (opt.families || []).join(' ');
    const rawMechanisms = (opt.mechanisms || []).join(' ');
    const rawCategories = (opt.categories || []).join(' ');
    
    const combinedMeta = `${rawFamilies} ${rawMechanisms} ${rawCategories}`.toLowerCase();

    // 🚫 絕對死刑區 (剃除)：只殺絕對巨無霸
    const isMapGiant = combinedMeta.includes('map (continental') || combinedMeta.includes('map (national');
    const isUltraHeavy = opt.complexity !== undefined && opt.complexity > 3.8;
    
    if (isMapGiant || isUltraHeavy) {
      isExplicitNo = true; // 確定佔超大空間，剃除
    } else {
      // 沒死刑，就看有沒有黃金資格拿高亮勳章
      
      // ✨ 金牌小巨人 (高亮)：官方認證
      const hasDirectTag = combinedMeta.includes('pocket game') || 
                           combinedMeta.includes('small box') || 
                           combinedMeta.includes('compact') || 
                           combinedMeta.includes('traveller') ||
                           rawCategories.toLowerCase().includes('travel');
                           
      // ✨ 極速微型 (高亮)：極輕極快
      const isUltraFastMicro = opt.complexity !== undefined && opt.complexity <= 1.8 && opt.playingTime !== undefined && opt.playingTime <= 30;

      if (hasDirectTag || isUltraFastMicro) {
        matchScore += 1; // 獲得黃金 ⛺ 標章並置頂
      }
      // 其餘狀況 (不符合高亮但未達死刑)：保持原樣，不剃除也不標記
    }
  }

  return { isExplicitNo, matchScore };
};

/**
 * 依據匹配分數(matchScore)由高到低進行排序的比較器 (符合優先，未知居後)
 */
export const byMatchScore = (filters: import('../types').SearchFilters, playerCount: number): Comparator => {
  return (a, b) => {
    const scoreA = getOptionFilterScore(a, filters, playerCount).matchScore;
    const scoreB = getOptionFilterScore(b, filters, playerCount).matchScore;
    return scoreB - scoreA; // 降序：分數高者排在前面
  };
};

/**
 * 進階過濾器 (Advanced Filtering)
 * 根據使用者在介面中設定的 8 大進階過濾器條件，對 GameOption 池進行精準過濾。
 */
export const filterOptionsByCriteria = (
  options: GameOption[],
  filters: import('../types').SearchFilters,
  playerCount: number
): GameOption[] => {
  return options.filter(opt => {
    const { isExplicitNo } = getOptionFilterScore(opt, filters, playerCount);
    return !isExplicitNo;
  });
};

/**
 * 搜尋結果處理函式 (Search Results Pipeline)
 * 邏輯：
 * 1. 取搜尋結果前 limit 筆。
 * 2. 若無完全匹配的名稱，則在最後加入「建立新遊戲」的虛擬選項。
 */
export const getSearchResults = (options: GameOption[], searchQuery: string, limit: number = 5): GameOption[] => {
  const trimmedQuery = searchQuery.trim();

  // 1. 基礎列表：取前 limit 筆
  let topResults = options.slice(0, limit);
  const sorted = topResults;

  // 2. 注入「建立」選項
  if (trimmedQuery) {
    const normalizedQuery = trimmedQuery.toLowerCase();

    // 檢查是否已有完全匹配的項目 (忽略大小寫)
    const hasExactMatch = sorted.some(opt =>
      (opt.cleanName || opt.displayName).trim().toLowerCase() === normalizedQuery
    );

    if (!hasExactMatch) {
      const virtualOption: GameOption = {
        uid: '__CREATE_NEW__',
        displayName: trimmedQuery,
        cleanName: trimmedQuery,
        templateId: undefined,
        savedGameId: undefined,
        bggId: undefined,
        lastUsed: 0,
        usageCount: 0,
        isPinned: false,
        defaultPlayerCount: 4,
        defaultScoringRule: 'HIGHEST_WINS',
        _searchTokens: []
      };
      sorted.push(virtualOption);
    }
  }

  return sorted;
};
