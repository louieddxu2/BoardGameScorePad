---
description: 維護與擴充遊戲搜尋、進階篩選與人數鎖定管線的標準作業流程 (SOP)，確保任何後續異動皆符合本專案的單向管線與預測鎖定哲學。
---
# 遊戲搜尋與進階篩選管線維護 (/maintain-search-pipeline) SOP

當需要修改、擴充或調試「遊戲搜尋、字典層、智慧推薦、進階過濾、人數上鎖、以及搜尋結果標籤呈現」等相關功能時，必須遵循此標準作業流程，以維持專案架構的健壯性與易維護性。

---

## ⚠️ 5 大核心架構原則

1. **單向管線原則 (Single-Direction Pipeline)**：
   * 任何新過濾條件必須落腳於 **階段一（進階篩選）**。
   * 篩選過濾必須完全在 **階段二（模糊搜尋）** 之前執行。模糊搜尋只能作用於已被篩選的子集，絕不允許先搜尋後篩選。
2. **底線命名與搜尋隔離原則 (Underline Isolation & Search Tokens)**：
   * 遵循 [extractDataSummaries.ts](file:///c:/board-game-score-pad/src/utils/extractDataSummaries.ts) 的命名規範：所有搜尋專用索引欄位必須以底線 `_` 開頭（如 `_searchTokens`）。
   * 所有新增別名或搜尋關鍵字，必須在聚合層擷取並扁平化匯入至 `_searchTokens: string[]` 中。模糊搜尋（Fuse.js）只能對比底線索引欄位，絕不允許直接對比顯示用欄位。
3. **動態限額與建立項保留 (Dynamic Limits & Virtual Option)**：
   * Lite 模式下列表限制為 5 筆；Advanced 進階模式下放寬限制為 20 筆。
   * 不論在何種限額下，只要有輸入關鍵字且無完全匹配，最尾端必須追加虛擬建立選項 `__CREATE_NEW__`。
4. **人數鎖定契合 (Prediction Decoupling)**：
   * 僅在進階篩選面板展開 **且** 啟用與人數相關的條件（如 `playerFilter !== 'none'`，即 OK 或 Best 按鈕）時，才啟動自動人數上鎖。
   * 自動上鎖的核心目的是**直接制止多方投票預測過程**，將人數轉為手動靜態主導，以徹底防範運行期的無窮更新死循環。若未啟用人數相關條件，則多方投票預測應保持正常運行。
5. **不含硬編碼中文與型別安全**：
   * 所有 UI 顯示字串與動態標籤翻譯必須自 `src/i18n/` 導入，禁止在 `src/i18n/` 之外的元件中硬編碼中文字串。

---

## 🎨 UI 徽章與標籤圖示化規範 (UI Badge & Iconography Specifications)

為了優化 UI 密度與使用者視覺體驗，本專案採取**「純圖示 ＋ 純數值」**的超輕量徽章設計，去除多餘的文字堆疊，讓整體介面更加現代、乾淨。

### 1. 標準搜尋結果附註列（由左至右排版）
* 🏆 **最佳人數 (Best Player Count)**：
  * **圖示**：`<Star size={12} className="fill-amber-400 text-amber-500 mr-0.5" />` (黃色實心星)
  * **數值**：例如 `3-4`（代表最推薦人數）
  * **膠囊樣式**：`bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15 px-1.5 py-0.5 rounded flex items-center text-[11px]`
* 👥 **支援人數 (Supported Player Count)**：
  * **圖示**：`<Users size={12} className="text-sky-500 mr-0.5" />` (藍色雙人頭)
  * **數值**：例如 `1-4`（代表物理盒裝人數）
  * **膠囊樣式**：`bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/15 px-1.5 py-0.5 rounded flex items-center text-[11px]`
* 🧠 **遊戲重度 (Weight / Complexity)**：
  * **圖示**：`<Brain size={12} className="text-purple-500 mr-0.5" />` (紫色大腦)
  * **數值**：例如 `2.2`（代表 BGG 重度，保留一位小數）
  * **膠囊樣式**：`bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15 px-1.5 py-0.5 rounded flex items-center text-[11px]`
* 📅 **發行年份 (Year Published)**：
  * **圖示**：`<Calendar size={12} className="text-emerald-500 mr-0.5" />` (綠色日曆)
  * **數值**：例如 `2020`
  * **膠囊樣式**：`bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15 px-1.5 py-0.5 rounded flex items-center text-[11px]`

### 2. 篩選搜尋下的特有標籤提示（待實作規劃）
當進階篩選模式處於作用中時，系統會在匹配的遊戲上呈現以下突出的特定亮點徽章：
* 🤝 **合作遊戲 (Cooperative)**：若為合作遊戲且此條件開啟或匹配，顯示特定合作徽章，伴隨溫和的呼吸效果。
* 🎪 **小桌面 (Small Table)**：符合 `複雜度 <= 2.2` 且 `時長 <= 45分` 時，顯示 `小品` / `小桌` 特色膠囊。

---

## 🛠️ 執行步驟

### 第一步：架構閱讀與確認 (Review Architecture)
在開始編寫代碼之前，必須先閱讀以下兩個權威檔案，以確認當前的最新實作狀態：
* 永久架構說明書：[docs/architecture/game-search-pipeline.md](file:///c:/board-game-score-pad/docs/architecture/game-search-pipeline.md)
* 搜尋摘要擷取規範：[extractDataSummaries.ts](file:///c:/board-game-score-pad/src/utils/extractDataSummaries.ts)
* 現行過濾策略實作：[sortStrategies.ts](file:///c:/board-game-score-pad/src/features/game-selector/utils/sortStrategies.ts)

### 第二步：依模組分工實施修改 (Modular Modifications)
遵循單一職責原則（Separation of Concerns），將修改精準落點：
* **新增欄位/資料結構** ➡️ [types.ts](file:///c:/board-game-score-pad/src/features/game-selector/types.ts)
* **修訂別名擷取、扁平化與 `_searchTokens` 匯入** ➡️ [useGameOptionAggregator.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameOptionAggregator.ts)
* **修訂篩選器或排序器比較邏輯** ➡️ [sortStrategies.ts](file:///c:/board-game-score-pad/src/features/game-selector/utils/sortStrategies.ts)
* **修訂搜尋調度與管線狀態** ➡️ [useGameSelectorLogic.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameSelectorLogic.ts)
* **修訂面板元件/預測上鎖同步** ➡️ [StartGamePanel.tsx](file:///c:/board-game-score-pad/src/features/game-selector/components/StartGamePanel.tsx)

### 第三步：標準驗證流程 (Verification)
修改完成後，必須執行以下驗證：

1. **靜態與測試檢測**：
   在 PowerShell 中執行以下指令，驗證型別與有無硬編碼中文：
   ```powershell
   powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"
   ```
2. **手動流程測試**：
   * 驗證 **Lite 模式** 下，遊戲更換時人數推薦能隨多方投票預測自動更新。
   * 驗證 **Advanced 模式** 下，切換「小桌遊戲」或「合作遊戲」篩選時，人數不應上鎖，且推薦仍能正常更新。
   * 驗證 **人數篩選（可玩 OK 或 最佳 Best）** 啟用時，人數輸入框立即轉綠，多方投票預測直接制止。
   * 驗證輸入關鍵字時，搜尋範圍限制在已篩選的遊戲中，且無匹配時，`__CREATE_NEW__` 依然正常顯示於最尾端。
