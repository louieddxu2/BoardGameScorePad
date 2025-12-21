
import { useState, useEffect } from 'react';

/**
 * 這是一個專門為了解決 Mobile Web 鍵盤遮擋問題的 Hook。
 * 它會偵測 Visual Viewport 的變化，計算出「Layout Viewport」底部與「Visual Viewport」底部之間的距離。
 * 
 * 在 Android 上 (支援 resize)，這個值通常為 0 (因為 Layout 會隨鍵盤縮小)。
 * 在 iOS 上 (Overlay 模式)，這個值會等於鍵盤的高度 (加上捲動偏移)。
 */
export const useVisualViewportOffset = () => {
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    // 伺服器端渲染或不支援 API 則略過
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handler = () => {
      const visualViewport = window.visualViewport!;
      // 使用 documentElement.clientHeight 通常比 window.innerHeight 更穩定反映 Layout Viewport 高度
      const layoutHeight = document.documentElement.clientHeight;
      const visualHeight = visualViewport.height;
      const visualTop = visualViewport.offsetTop;

      // 計算公式：
      // 偏移量 = 版面總高度 - (可視高度 + 目前捲動位置)
      // 這代表了「螢幕底部」被遮擋(或捲動出視線)的高度
      const offset = Math.max(0, layoutHeight - (visualHeight + visualTop));
      
      // 設定一個小門檻 (5px) 避免因為瀏覽器網址列伸縮造成的微小抖動
      setBottomOffset(Math.abs(offset) < 5 ? 0 : offset);
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

  return bottomOffset;
};
