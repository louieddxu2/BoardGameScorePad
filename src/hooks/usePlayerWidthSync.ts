
import { useEffect, useRef } from 'react';
import { Player } from '../types';

/**
 * 這是一個佈局同步 Hook。
 * 它的作用是：
 * 1. 監聽「玩家表頭 (Header)」的寬度變化。
 * 2. 當表頭因為名字變長而被撐開時，取得其精確像素寬度。
 * 3. 尋找所有屬於該玩家的「分數格 (Cell)」與「總分格 (Total)」。
 * 4. 直接設定 style.width / minWidth / maxWidth，強制它們與表頭同寬。
 * 
 * 這比純 CSS (Flex/Grid) 更可靠，因為它能跨越不同的捲動容器 (Scroll Container) 進行對齊。
 */
export const usePlayerWidthSync = (players: Player[]) => {
  // 用來存放 ResizeObserver 的 Ref，確保元件卸載時能斷開連結
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    // 建立 Observer
    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // 1. 取得表頭目前的精確寬度
        const width = entry.borderBoxSize?.[0]?.inlineSize || entry.contentRect.width;
        
        // 2. 從 DOM 屬性取得 Player ID
        const target = entry.target as HTMLElement;
        const playerId = target.getAttribute('data-player-header-id');
        
        if (playerId && width > 0) {
          // 3. 找出所有屬於這個玩家的欄位 (分數格 + 總分格)
          // 我們使用 Class Selector 來選取，因為這最快且不受 React Render Cycle 影響
          const cells = document.querySelectorAll(`.player-col-${playerId}`);
          
          // 4. 強制同步寬度
          const pixelWidth = `${width}px`;
          cells.forEach((cell) => {
             const el = cell as HTMLElement;
             if (el.style.width !== pixelWidth) {
                 el.style.width = pixelWidth;
                 el.style.minWidth = pixelWidth;
                 el.style.maxWidth = pixelWidth;
             }
          });
        }
      }
    });

    // 開始監聽所有玩家的表頭
    players.forEach(p => {
        const headerEl = document.getElementById(`header-${p.id}`);
        if (headerEl && observerRef.current) {
            observerRef.current.observe(headerEl);
        }
    });

    return () => {
        if (observerRef.current) observerRef.current.disconnect();
    };
  }, [players.length]); // 當玩家數量改變時，重新綁定
};
