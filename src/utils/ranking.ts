
/**
 * 分數排名 (Dense Rank): 100(1), 100(1), 90(2)
 * 相同分數並列，下一名次緊接在後。
 */
export const getScoreRank = (targetValue: number, allValues: number[]): number => {
  if (!allValues || allValues.length === 0) return 1;
  const uniqueSorted = Array.from(new Set(allValues)).sort((a, b) => b - a);
  const rank = uniqueSorted.indexOf(targetValue);
  return rank === -1 ? uniqueSorted.length + 1 : rank + 1;
};

/**
 * 玩家排名 (Standard Competition Rank): 100(1), 100(1), 90(3)
 * 相同分數並列，下一名次跳號。
 */
export const getPlayerRank = (targetValue: number, allValues: number[]): number => {
  if (!allValues || allValues.length === 0) return 1;
  // 計算有多少人的分數「大於」自己
  const betterCount = allValues.filter(v => v > targetValue).length;
  return betterCount + 1;
};

/**
 * 平手人數: 計算與自己分數相同的人數 (包含自己)
 * 若只有自己，回傳 1
 */
export const getTieCount = (targetValue: number, allValues: number[]): number => {
  if (!allValues || allValues.length === 0) return 1;
  return allValues.filter(v => v === targetValue).length;
};
