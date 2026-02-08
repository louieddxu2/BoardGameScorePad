
import Fuse from 'fuse.js';

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
   * 通用 Fuse 搜尋函式
   * @param list 資料陣列
   * @param query 使用者輸入的搜尋字串
   * @param keys 要搜尋的欄位名稱，支援字串陣列或權重物件陣列
   */
  search<T>(list: T[], query: string, keys: (string | { name: string; weight: number })[]): T[] {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) return list;

    // 判斷是否使用權重模式
    const isWeighted = keys.length > 0 && typeof keys[0] !== 'string';

    // 1. 進行分詞
    const tokens = tokenize(trimmedQuery);
    if (tokens.length === 0) return list;

    // 2. 建構 Fuse 實例
    const fuse = new Fuse(list, {
      keys: keys as any, // Fuse type definition is flexible enough
      // 0.0 (完全一致) ~ 1.0 (完全不一致)
      threshold: 0.3, // 稍微調低閾值以減少雜訊
      
      // [Modified] 優先匹配字首設定
      ignoreLocation: false, // 啟用位置權重 (關鍵修改)
      location: 0,           // 預期匹配位置在字串開頭 (Index 0)
      distance: 100,         // 距離開頭越遠扣分越重 (100字元內有效，超過則大幅降低相關性)
      
      useExtendedSearch: false, 
      shouldSort: true, // 依關聯度排序結果
    });

    // 3. 執行搜尋
    // 簡單的 Logical Query 策略：
    // 如果使用者輸入多個詞 (例如 "卡坦 台北")，我們希望結果「至少包含其中一個詞」
    const finalQuery = {
        $or: tokens.map(term => ({
            $or: isWeighted 
                ? (keys as {name: string}[]).map(k => ({ [k.name]: term }))
                : (keys as string[]).map(k => ({ [k]: term }))
        }))
    };

    return fuse.search(finalQuery as any).map(result => result.item);
  }
};
