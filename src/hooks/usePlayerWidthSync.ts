
import { useEffect, useRef } from 'react';
import { Player } from '../types';

/**
 * 佈局同步 Hook
 * 解決 Flexbox "Auto-fill" 與 "Column Alignment" 的衝突。
 */
export const usePlayerWidthSync = (players: Player[]) => {
  const observerRef = useRef<ResizeObserver | null>(null);

  // [關鍵優化]
  // 建立一個僅包含 "ID" 與 "名稱" 的特徵字串。
  // 我們不希望 useEffect 在 `players` 內的 `scores` 或 `totalScore` 改變時執行 (這會導致輸入分數時頻閃)，
  // 只有當玩家 "數量改變" 或 "改名" (這些才會影響 Header 寬度) 時，才需要重置佈局。
  const layoutSignature = players.map(p => `${p.id}:${p.name}`).join('|');

  useEffect(() => {
    // 定義重置邏輯：清除所有由 JS 設定的強制寬度
    const resetWidths = () => {
      players.forEach(p => {
        const cells = document.querySelectorAll(`.player-col-${p.id}`);
        cells.forEach((c) => {
           const el = c as HTMLElement;
           // 清空寬度，讓它回歸 CSS 定義的預設值 (flex-auto 或 min-content)
           el.style.width = '';
           el.style.minWidth = '';
           el.style.maxWidth = '';
        });
      });
    };

    // 1. 當佈局特徵改變 (改名/增減人) 時，立即重置寬度，讓 flex-auto 重新計算
    resetWidths();

    // 2. 處理視窗縮放 (Zoom/Resize)
    window.addEventListener('resize', resetWidths, { capture: true });

    // 3. 建立 Observer 監聽表頭寬度
    observerRef.current = new ResizeObserver((entries) => {
      // 使用 requestAnimationFrame 避免 "Loop completed with undelivered notifications"
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          
          // 取得 Header 目前由瀏覽器計算出的精確寬度 (包含 Flex 伸展後)
          const exactWidth = target.getBoundingClientRect().width;
          const pixelWidth = `${exactWidth}px`;
          
          const playerId = target.getAttribute('data-player-header-id');
          
          if (playerId && exactWidth > 0) {
            const cells = document.querySelectorAll(`.player-col-${playerId}`);
            cells.forEach((cell) => {
               const el = cell as HTMLElement;
               // 將 Header 的寬度同步鎖定給所有下方的 Cells
               // 只有當數值真的改變時才寫入，減少 DOM 操作與頻閃
               if (el.style.width !== pixelWidth) {
                   el.style.width = pixelWidth;
                   el.style.minWidth = pixelWidth;
                   el.style.maxWidth = pixelWidth;
               }
            });
          }
        }
      });
    });

    // 開始監聽所有玩家的表頭
    players.forEach(p => {
        const headerEl = document.getElementById(`header-${p.id}`);
        if (headerEl && observerRef.current) {
            observerRef.current.observe(headerEl);
        }
    });

    return () => {
        window.removeEventListener('resize', resetWidths, { capture: true });
        if (observerRef.current) observerRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSignature]); // 關鍵：僅依賴佈局特徵字串，忽略 players 內的分數變動
};
