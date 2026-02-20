
import { useState, useEffect } from 'react';

/**
 * Custom Hook: useDebounce
 * 延遲更新數值，直到指定的時間 (delay) 內沒有新的變化。
 * 用於搜尋欄，避免每打一個字就觸發繁重的搜尋運算。
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // 設定計時器，延遲更新
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 如果 value 在 delay 時間內又改變了，或是組件卸載，
    // 清除上一個計時器 (取消更新)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
