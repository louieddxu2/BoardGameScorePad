
import { useState, useEffect } from 'react';

interface KeyboardStatus {
  /** 鍵盤是否已開啟（封裝了平台差異與閾值判定） */
  isKeyboardOpen: boolean;
  /** 底部被遮擋的 px 數，用於 CSS 佈局補償（如 bottom / paddingBottom） */
  offset: number;
}

/**
 * 鍵盤偵測的安全閾值 (px)。
 * 大於所有已知行動裝置工具列高度（通常 40-70px），
 * 但遠小於任何虛擬鍵盤（通常 > 200px）。
 */
const KEYBOARD_THRESHOLD = 80;

/**
 * innerHeight 縮減量閾值 (px)。
 * 主要用於 Android：當 Layout Viewport 高度因鍵盤而銳減超過此值時，視為鍵盤已開啟。
 */
const RESIZE_THRESHOLD = 150;

/**
 * 封裝所有鍵盤偵測邏輯的 Hook。
 *
 * 內部整合兩套偵測機制：
 * 1. Visual Viewport offset 監聽（主要用於 iOS Overlay 模式）
 * 2. window.innerHeight resize 監聽（主要用於 Android Layout Viewport 重排模式）
 *
 * 外部組件不需要知道任何平台差異細節。
 */
export const useKeyboardStatus = (): KeyboardStatus => {
  const [offset, setOffset] = useState(0);
  const [isResizedByKeyboard, setIsResizedByKeyboard] = useState(false);

  // Visual Viewport 監聽 (主要用於 iOS)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handler = () => {
      const vv = window.visualViewport!;
      // 使用 documentElement.clientHeight 通常比 window.innerHeight 更穩定反映 Layout Viewport 高度
      const layoutHeight = document.documentElement.clientHeight;
      const visualHeight = vv.height;
      const visualTop = vv.offsetTop;

      // 計算公式：
      // 偏移量 = 版面總高度 - (可視高度 + 目前捲動位置)
      // 這代表了「螢幕底部」被遮擋(或捲動出視線)的高度
      const raw = Math.max(0, layoutHeight - (visualHeight + visualTop));

      // 設定一個小門檻 (5px) 避免因為瀏覽器網址列伸縮造成的微小抖動
      setOffset(Math.abs(raw) < 5 ? 0 : raw);
    };

    // 監聽 resize (鍵盤彈出) 與 scroll (使用者移動畫面)
    window.visualViewport.addEventListener('resize', handler);
    window.visualViewport.addEventListener('scroll', handler);

    // 初始化執行一次
    handler();

    return () => {
      window.visualViewport?.removeEventListener('resize', handler);
      window.visualViewport?.removeEventListener('scroll', handler);
    };
  }, []);

  // innerHeight resize 監聯 (主要用於 Android)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initialHeight = window.innerHeight;
    const handleResize = () =>
      setIsResizedByKeyboard(initialHeight - window.innerHeight > RESIZE_THRESHOLD);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isKeyboardOpen: offset > KEYBOARD_THRESHOLD || isResizedByKeyboard,
    offset,
  };
};

/** @deprecated 改用 useKeyboardStatus() */
export const useVisualViewportOffset = () => useKeyboardStatus().offset;
