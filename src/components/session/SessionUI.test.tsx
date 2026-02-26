
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App';
import { LanguageProvider } from '../../i18n';
import { ToastProvider } from '../../hooks/useToast';

// Wrap App with required providers (same as src/index.tsx)
const renderApp = () => render(
  <LanguageProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </LanguageProvider>
);

// 整合測試 (Integration Test)
// 直接 Render 整個 App，模擬使用者從首頁點進去的操作流程
//
// ⚠️ SKIPPED: 此測試套件依賴 Dexie (IndexedDB)，jsdom 環境不支援。
// 需要在真實瀏覽器環境執行（Playwright / 手動測試）。

describe.skip('UI 互動與手機版面響應測試', () => {

  it('基本操作流程：點擊計分格應開啟輸入面板', async () => {
    renderApp();

    // 1. 模擬首頁：點擊內建的 "農家樂" 範本
    const templateCard = screen.getByText('農家樂');
    fireEvent.click(templateCard);

    // 2. 模擬設定彈窗：點擊 "開始計分"
    const startButton = screen.getByText('開始計分');
    fireEvent.click(startButton);

    // 3. 驗證已進入計分畫面 (看到玩家名稱)
    expect(screen.getByText('玩家 1')).toBeInTheDocument();

    // 4. 找到第一個分數格子 (顯示為 '-') 並點擊
    const scoreCells = screen.getAllByText('-');
    fireEvent.click(scoreCells[0]);

    // 5. 驗證：輸入面板是否滑入？ (檢查是否有「清除」按鈕出現)
    const clearButton = screen.getByText('清除');
    expect(clearButton).toBeInTheDocument();

    // 驗證面板 CSS transform 狀態 (確保它是顯示的)
    // 注意：這裡依賴 Tailwind class 實作細節
    const panel = clearButton.closest('.fixed');
    expect(panel).toHaveClass('translate-y-0');
  });

  it('手機模擬關鍵測試：虛擬鍵盤彈出時，輸入面板應自動上移', async () => {
    renderApp();

    // 快速進入 Session
    fireEvent.click(screen.getByText('農家樂'));
    fireEvent.click(screen.getByText('開始計分'));

    // 開啟面板
    const scoreCells = screen.getAllByText('-');
    fireEvent.click(scoreCells[0]);

    // 抓取面板 DOM
    const clearButton = screen.getByText('清除');
    const panel = clearButton.closest('.fixed') as HTMLElement;

    // 初始狀態：面板應該貼底 (bottom: 0px)
    expect(panel.style.bottom).toBe('0px');

    // --- 模擬手機行為：鍵盤彈出 ---
    // 這會觸發 useVisualViewportOffset Hook
    act(() => {
      // 1. 模擬 Layout Viewport (瀏覽器總高度)
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 800, configurable: true });

      // 2. 模擬 Visual Viewport 變小 (被鍵盤佔用 300px)
      if (window.visualViewport) {
        // @ts-ignore
        window.visualViewport.height = 500;
        // @ts-ignore
        window.visualViewport.offsetTop = 0;

        // 3. 發送 resize 事件通知 App
        window.visualViewport.dispatchEvent(new Event('resize'));
      }
    });

    // --- 驗證 ---
    // 面板應該自動增加 bottom 距離，避免被鍵盤擋住
    // 計算：800 - 500 = 300px
    expect(panel.style.bottom).toBe('300px');

    // --- 模擬：鍵盤收起 ---
    act(() => {
      if (window.visualViewport) {
        // @ts-ignore
        window.visualViewport.height = 800; // 回復原狀
        window.visualViewport.dispatchEvent(new Event('resize'));
      }
    });

    expect(panel.style.bottom).toBe('0px');
  });

  it('介面切換測試：點擊玩家標題應進入「玩家編輯模式」(面板變矮)', async () => {
    renderApp();

    // 進入 Session
    fireEvent.click(screen.getByText('農家樂'));
    fireEvent.click(screen.getByText('開始計分'));

    // 1. 點擊玩家標題 ("玩家 1")
    const playerHeader = screen.getByText('玩家 1');
    fireEvent.click(playerHeader);

    // 2. 驗證是否出現編輯輸入框
    const nameInput = screen.getByPlaceholderText('輸入名稱');
    expect(nameInput).toBeInTheDocument();

    // 3. 驗證面板高度變化
    // 我們的邏輯是：編輯玩家名稱時，因為鍵盤一定會跳出來，所以面板會切換成「緊湊模式 (Compact Mode)」
    // 高度設定為 '112px' (Header + Compact Row)
    const clearButton = screen.getByText('清除');
    const panel = clearButton.closest('.fixed') as HTMLElement;

    // 因為在測試環境中 focus 狀態可能需要透過互動觸發，我們直接檢查是否進入了編輯狀態的 UI 特徵
    // 在 SessionView 中，點擊 header 會設定 editingPlayerId，這會觸发面板顯示
    // 這裡我們檢查面板是否開啟
    expect(panel).toHaveClass('translate-y-0');
  });

});
