import { useLayoutEffect, useRef } from 'react';
import { Player, ScoreColumn } from '../types';

/**
 * 佈局同步 Hook
 * 解決 Flexbox "Auto-fill" 與 "Column Alignment" 的衝突。
 */
export const usePlayerWidthSync = (players: Player[], columns: ScoreColumn[]) => {
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
        const cells = document.querySelectorAll(`.player-col-${p.id}`);
        cells.forEach((c) => {
           const el = c as HTMLElement;
           el.style.width = '';
           el.style.minWidth = '';
           el.style.maxWidth = '';
        });
      });
    };

    // 1. 當佈局特徵改變 (改名/增減人/增減欄) 時，無條件立即重置
    // 這是由依賴項觸發的
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
  }, [layoutSignature, columnSignature]); 
};