import Fuse, { FuseResult } from 'fuse.js';

// --- Helper: 中文分詞與標準化 ---
// 使用瀏覽器原生的 Intl.Segmenter 進行中文分詞
const tokenize = (text: string): string[] => {
  if (!text) return [];
  // Only split by whitespace to support multi-word intersection while letting Fuse handle intra-string fuzzy matching
  return text.split(/\s+/).filter(t => t.trim().length > 0);
};

export const searchService = {

  /**
   * 內部共用核心搜尋邏輯
   */
  _coreSearch<T>(list: T[], query: string, keys: (string | { name: string; weight: number })[], includeMatches: boolean): FuseResult<T>[] {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) return list.map((item, refIndex) => ({ item, refIndex }));

    const isWeighted = keys.length > 0 && typeof keys[0] !== 'string';
    const queryLen = trimmedQuery.length;
    const dynamicThreshold = queryLen <= 3 ? 0.5 : 0.4;

    const tokens = tokenize(trimmedQuery);
    if (tokens.length === 0) return list.map((item, refIndex) => ({ item, refIndex }));

    const fuse = new Fuse(list, {
      keys: keys as any,
      threshold: dynamicThreshold,
      ignoreLocation: false,
      location: 0,
      distance: 100,
      useExtendedSearch: false,
      shouldSort: true,
      includeMatches,
    });

    const finalQuery = {
      $and: tokens.map(term => ({
        $or: isWeighted
          ? (keys as { name: string }[]).map(k => ({ [k.name]: term }))
          : (keys as string[]).map(k => ({ [k]: term }))
      }))
    };

    return fuse.search(finalQuery as any);
  },

  /**
   * 通用 Fuse 搜尋函式
   */
  search<T>(list: T[], query: string, keys: (string | { name: string; weight: number })[]): T[] {
    return this._coreSearch(list, query, keys, false).map(result => result.item);
  },

  /**
   * 帶有高亮/匹配資訊的搜尋函式
   */
  searchWithMatches<T>(list: T[], query: string, keys: (string | { name: string; weight: number })[]): FuseResult<T>[] {
    return this._coreSearch(list, query, keys, true);
  }
};
