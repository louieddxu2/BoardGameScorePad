import Fuse, { FuseResult } from 'fuse.js';

// --- Helper: 中文分詞與標準化 ---
// 使用瀏覽器原生的 Intl.Segmenter 進行中文分詞
const tokenize = (text: string): string[] => {
  if (!text) return [];

  // 1. 嘗試使用 Intl.Segmenter (現代瀏覽器支援)
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('zh-TW', { granularity: 'word' });
    const segments = Array.from(segmenter.segment(text));
    // 過濾掉純標點符號或空白
    return segments
      .map((s: any) => s.segment)
      .filter((s: string) => s.trim().length > 0);
  }

  // 2. Fallback: 簡單的空白切割 (相容舊環境)
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
    const dynamicThreshold = queryLen <= 3 ? 0.5 : 0.3;

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
      $or: tokens.map(term => ({
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
