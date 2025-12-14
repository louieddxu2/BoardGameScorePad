
import { useEffect, useRef } from 'react';
import { Player } from '../types';

/**
 * 佈局同步 Hook
 * 解決 Flexbox "Auto-fill" 與 "Column Alignment" 的衝突。
 */
export const usePlayerWidthSync = (players: Player[]) => {
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    // 1. 處理視窗縮放 (Zoom/Resize)
    // 這是解決「無法縮小」的關鍵：在重繪前，先釋放下方欄位的寬度限制，
    // 讓容器能自然縮小，接著 ResizeObserver 才會抓到正確縮小後的 Header 寬度。
    const handleResize = () => {
      // 這裡不需擔心效能，因為只有在改變視窗大小時觸發
      players.forEach(p => {
        const cells = document.querySelectorAll(`.player-col-${p.id}`);
        cells.forEach((c) => {
           const el = c as HTMLElement;
           // 清空寬度，讓它回歸 min-content 或 flex 預設，允許容器收縮
           el.style.width = '';
           el.style.minWidth = '';
           el.style.maxWidth = '';
        });
      });
    };
    
    // 使用 capture 確保盡早觸發
    window.addEventListener('resize', handleResize, { capture: true });

    // 2. 建立 Observer 監聽表頭寬度
    observerRef.current = new ResizeObserver((entries) => {
      // 使用 requestAnimationFrame 解決 "Loop completed with undelivered notifications"
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          // 取得精確的像素寬度 (包含小數點)
          const width = entry.contentRect.width; 
          const playerId = target.getAttribute('data-player-header-id');
          
          if (playerId && width > 0) {
            // 加上 padding/border 的補償 (因為 contentRect 不含 border，但 style.width 通常指 border-box)
            // 這裡簡單使用 getBoundingClientRect 來獲取最準確的渲染寬度
            const exactWidth = target.getBoundingClientRect().width;
            const pixelWidth = `${exactWidth}px`;

            const cells = document.querySelectorAll(`.player-col-${playerId}`);
            cells.forEach((cell) => {
               const el = cell as HTMLElement;
               // 只有當數值真的改變時才寫入，減少 DOM 操作
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
        window.removeEventListener('resize', handleResize, { capture: true });
        if (observerRef.current) observerRef.current.disconnect();
    };
  }, [players]); // 當玩家列表改變時重新綁定
};
