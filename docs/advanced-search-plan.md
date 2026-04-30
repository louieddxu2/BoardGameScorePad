# 進階搜尋與篩選系統 (Geekgroup 式實作) — 階段式藍圖

## 目標
將 `StartGamePanel` 從單純的搜尋框，升級為具備全螢幕視圖、多維度 BGG 元數據篩選（人數、時間、重度）的決策中心。

---

## 階段一：底層架構與佈局切換 (Layout Foundation)
**目標：實現「進階模式」的視覺切換與持久化，不改動搜尋邏輯。**

1.  **狀態持久化**：
    *   在 `StartGamePanel` 建立 `isAdvancedMode` 狀態。
    *   使用 `useEffect` 連結 `localStorage` (key: `pref_search_advanced`)。
2.  **動態佈局切換**：
    *   **容器高度**：`h-[220px]` (Lite) ↔ `inset-0 top-[56px]` (Advanced)。
    *   **動畫**：套用 Tailwind `transition-all duration-300 ease-in-out`。
3.  **UI 觸發鈕**：
    *   在搜尋列 right 側加入「切換圖示」（例如：`Maximize2` / `Minimize2`）。
4.  **驗證點**：點擊切換鈕後，面板能流暢地在「底部橫條」與「全螢幕」之間切換，且重整頁面後狀態不丟失。

---

## 階段二：進階篩選器 UI (Filter Side-panel)
**目標：在右側面版實作 Geekgroup 風格的篩選控件。**

1.  **內容切換邏輯**：
    *   若 `isAdvancedMode` 為 true，將原本的「地點/人數/規則」選單切換為「篩選器堆疊」。
2.  **實作篩選控件**：
    *   **人數選取**：包含 `Current Count` 以及一個 ✨ 星號切換鈕（切換「支援人數」與「最佳人數」）。
    *   **重度區間**：簡單的 1~3 級選取（輕度、中等、重度）。
    *   **時間桶 (Time Buckets)**：30, 60, 120 分鐘的快速選取按鈕。
3.  **驗證點**：右側面版在進階模式下顯示全新的篩選介面，UI 排版在各螢幕尺寸下皆穩定。

---

## 階段三：多維度搜尋引擎升級 (Filtering Engine)
**目標：將篩選器狀態與搜尋邏輯接線。**

1.  **篩選狀態整合**：
    *   建立 `filters` 物件狀態：`{ playerCount: number, bestOnly: boolean, complexity: number[], timeLimit: number }`。
2.  **邏輯注入**：
    *   修改 `useGameOptionAggregator`，將 `filters` 傳入。
    *   **過濾優先**：先執行 BGG 元數據過濾（例如：`if (bestOnly) return game.bestPlayers.includes(count)`）。
    *   **統計排序**：過濾後的結果再交由既有的 `getRecommendations` 進行排序。
3.  **驗證點**：調整人數或重度後，左側列表即時更新，且搜尋結果同時符合關鍵字與篩選條件。

---

## 階段四：列表資訊強化 (Enhanced List View)
**目標：讓使用者在列表中就能看到關鍵元數據，幫助決策。**

1.  **列表項修改 (`renderItem`)**：
    *   在 `isAdvancedMode` 下，列表項增加副標題列。
    *   顯示小圖示與數據：👥 人數、⏳ 時間、⚖️ 重度。
2.  **結果統計**：
    *   在列表頂部顯示「已過濾：12 / 150 款遊戲」。
3.  **驗證點**：進階模式下的列表資訊豐富，使用者能一眼看出為什麼某款遊戲被推薦。

---

## 階段五：細節打磨與 UX 優化 (UX Polish)
**目標：處理邊角案例，提升專業感。**

1.  **快速重設**：加入「清除所有篩選」按鈕。
2.  **空白狀態優化**：如果篩選太嚴格導致沒結果，顯示具體的提示（例如：「沒有符合重度 4.0 以上的 3 人遊戲」）。
3.  **效能優化**：確保大數據量下的篩選反應依然在 16ms 內。
4.  **驗證點**：整體操作流暢，無 Bug，文案專業且易懂。
