
import { useLayoutEffect, useRef } from 'react';
import { Player, ScoreColumn } from '../types';

/**
 * 佈局同步 Hook
 * 解決 Flexbox "Auto-fill" 與 "Column Alignment" 的衝突。
 */
export const usePlayerWidthSync = (players: Player[], columns: ScoreColumn[], zoomLevel: number) => {
  const observerRef = useRef<ResizeObserver | null>(null);
  
  // 記錄上一次的視窗寬度，用來過濾掉「只改變高度」(如手機鍵盤彈出) 的 resize 事件
  const prevWindowWidth = useRef(typeof window !== 'undefined' ? window.innerWidth : 0);

  // [關鍵優化]
  // 建立一個僅包含 "ID" 與 "名稱" 的特徵字串。
  const layoutSignature = players.map(p => `${p.id}:${p.name}`).join('|');
  const columnSignature = columns.map(c => c.id).join('|');

  useLayoutEffect(() => {
    // 定義重置邏輯：清除所有由 JS 設定的強制寬度
    const resetWidths = () => {
      players.forEach(p => {
        // [關鍵修正]
        // 我們不再重置 .player-col-{id} (內容格) 的寬度。
        // 只重置 Header (領頭羊)，讓 Header 根據 Flexbox/Zoom 自然伸縮。
        // Observer 偵測到 Header 變化後，會直接把新寬度覆蓋到內容格上。
        // 這樣可以避免內容格在「重置->重算」的瞬間發生寬度塌陷 (Flicker)。
        
        /* 
        const cells = document.querySelectorAll(`.player-col-${p.id}`);
        cells.forEach((c) => {
           const el = c as HTMLElement;
           el.style.width = '';
           el.style.minWidth = '';
           el.style.maxWidth = '';
        });
        */

        // 只重置 Header，這是佈局的 Source of Truth
        const headerEl = document.getElementById(`header-${p.id}`);
        if (headerEl) {
           headerEl.style.width = '';
           headerEl.style.minWidth = '';
           headerEl.style.maxWidth = '';
        }
      });
    };

    // 1. 當佈局特徵改變 (改名/增減人/增減欄) 或縮放等級改變時，無條件立即重置
    resetWidths();

    // 2. 處理視窗縮放 (Zoom/Resize)
    // 關鍵修正：加入寬度檢查，忽略手機鍵盤彈出造成的垂直 resize
    const handleResize = () => {
        const currentWidth = window.innerWidth;
        // 只有當寬度發生變化 (縮放、旋轉螢幕) 時才重置
        if (currentWidth !== prevWindowWidth.current) {
            resetWidths();
            prevWindowWidth.current = currentWidth;
        }
    };

    window.addEventListener('resize', handleResize, { capture: true });

    // 3. 建立 Observer 監聽表頭寬度
    observerRef.current = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          
          const exactWidth = target.getBoundingClientRect().width;
          const pixelWidth = `${exactWidth}px`;
          
          const playerId = target.getAttribute('data-player-header-id');
          
          if (playerId && exactWidth > 0) {
            const cells = document.querySelectorAll(`.player-col-${playerId}`);
            cells.forEach((cell) => {
               const el = cell as HTMLElement;
               // 直接應用新寬度，不經過 auto 狀態
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSignature, columnSignature, zoomLevel]); 
};
