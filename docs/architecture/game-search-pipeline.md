# 📋 萬用桌遊計分板 — 遊戲搜尋、進階篩選與預測鎖定架構說明書

本文件定義了「Board Game ScorePad」中**遊戲搜尋、資料聚合、智慧預測與進階篩選**的核心架構與資料流向。旨在作為本專案的永久維護文檔，供所有後續開發人員（與 AI 夥伴）閱讀與遵循。

---

## 🏗️ 1. 資料源頭與聚合設計 (Data Sources & Aggregator)

系統中的遊戲選項由 [useGameOptionAggregator.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameOptionAggregator.ts) 在執行期動態將以下三個資料層進行**「多維度雙重索引聚合（以 Name & BGG ID 進行合併）」**而來：

```
                    ┌─────────────────────────┐
                    │ 1. Base Layer (已存遊戲) │ ──► 使用者實際玩過、有遊玩次數與時間統計的遊戲。
                    └─────────────────────────┘
                                 │
                                 ▼ (依 BGG ID / 名稱合併覆蓋)
                    ┌─────────────────────────┐
                    │2. Overlay Layer (模板)  │ ──► 使用者自訂或系統內建的計分板模板。
                    └─────────────────────────┘
                                 │
                                 ▼ (補全中英文別名、封面、出版年份、適合人數等 Metadata)
                    ┌─────────────────────────┐
                    │3. Dictionary Layer (BGG)│ ──► 本地 BGG 字典資料，用於搜尋補完與欄位補充。
                    └─────────────────────────┘
                                 │
                                 ▼
                     【 統一 GameOption 選項清單 】
```

---

## 🔍 1.5 搜尋索引「底線隔離」與資料轉換設計 (Search Index & Isolation)

為了保障「模糊搜尋」的高性能與準確度，並將搜尋資料與顯示資料實施絕對隔離，本系統設計了一套專屬的**擷取與轉換流程**（實作於 [extractDataSummaries.ts](file:///c:/board-game-score-pad/src/utils/extractDataSummaries.ts) 與聚合層中）：

### 1. 底線命名絕對隔離原則 (Key Name Isolation)
* 透過 TypeScript 的型別定義，強制要求**所有搜尋索引專用欄位，命名必須以底線 `_` 開頭**（如 `_searchName`、`_altNames`、`_searchTokens`）。
* **優點**：確保搜尋引擎進行索引建立、比對時，完全不污染 or 干涉 UI 顯示用的乾淨欄位（如 `displayName`、`bggName`）。

### 2. 搜尋 Token 擷取與扁平化流程 (Token Extraction & Flattening)
在聚合各資料層時，系統會自動從實體中「擷取」中英文名稱、別名、作者、BGG ID 等關鍵字，整合成一個扁平化的 `_searchTokens: string[]` 欄位：

```
 [ 已存遊戲 SavedGame ] ──► 擷取 g.name ＋ 別名 g.altName ─────────┐
                                                                 ▼
 [ BGG 字典遊戲 BggGame ] ─► 擷取 bgg.name ＋ 別名 bgg.altNames ───┼─► 扁平化整合為 `_searchTokens` 欄位
                                                                 ▲
 [ 計分板模板 Template ] ──► 擷取 t.name ─────────────────────────┘
                                 │
                                 ▼ (Fuse.js 模糊搜尋引擎)
               【 精準作用於隔離的搜尋索引 `_searchTokens` 】
```

* **模糊搜尋命中機制**：當使用者輸入關鍵字時，Fuse.js 搜尋引擎會**直接比對 `_searchTokens` 中的所有扁平化別名**。一旦命中（例如輸入英文名命中別名），系統會優先展示該別名，並在後方括號中補完权威 BGG 原名，提供完美的人機交互。

---

## 🌊 2. 三階段資料處理管線 (Three-Stage Data Pipeline)

不論處於什麼模式，當統一選項清單產出後，都會流經一條清晰、單向的三階段水管進行過濾、排序與限額，最終呈現在 UI 列表上：

```
                    【 原始遊戲清單 options 】
                                │
                                ▼
         ┌───────────────────────────────────────────────┐
         │ 階段一：進階篩選 (Filter Criterion)            │
         │   ├─ 進階模式開啟 ──► 套用 8 大進階過濾器     │
         │   └─ 進階模式關閉 ──► 保持原始清單 (不執行過濾) │
         └───────────────────────────────────────────────┘
                                │
                                ▼
         ┌───────────────────────────────────────────────┐
         │ 階段二：搜尋與分流排序 (Scenario & Sorting)    │
         │   ├─ 有關鍵字 ──► 對模糊命中結果做近期優先重排 │
         │   ├─ 無關鍵字 ＋ 篩選開啟 ──► 年份排序 (最新優先)│
         │   └─ 無關鍵字 ＋ 篩選關閉 ──► 提取「智慧推薦」 │
         └───────────────────────────────────────────────┘
                                │
                                ▼
         ┌───────────────────────────────────────────────┐
         │ 階段三：動態限額與建立選項 (Output & Virtual) │
         │   ├─ 進階篩選開啟 ──► 限額前 20 筆            │
         │   └─ 進階篩選關閉 ──► 限額前 5 筆             │
         │   ★ 註：有輸入關鍵字時，雙重限額模式下均會在   │
         │     無精確匹配時，於列表最尾端追加虛擬建立選項 │
         │     `__CREATE_NEW__` 以利無縫建立新遊戲。      │
         └───────────────────────────────────────────────┘
                                │
                                ▼
                     【 UI 列表最終渲染呈現 】
```

---

### 2.1 近期遊戲搜尋重排

遊戲搜尋沿用 `useGameOptionsQuery` 的 Templates、SavedGames、BGG 聚合與 Fuse 設定；只為這條搜尋要求回傳分數。`_searchRanking` 是本次查詢的暫存資訊，不寫入資料庫，也不附加到未搜尋的 `allOptions`。

- 搜尋用的近期範圍為全局最近 **50 款不同遊戲**，依 savedGames 的實際 `lastUsed` 選取，先合併同款再取 50 款。搜尋字串與進階篩選不改變此範圍；釘選與進行中的遊戲仍可提升。首頁 5 款捷徑及未搜尋的推薦規則保持不變。
- 同款身分沿用 BGG ID、local ID 與名稱判斷；已知 BGG ID 衝突不合併。別名不多占名額，名稱有歧義時不擴張到另一個候選。
- Fuse 已完成比對後，先套進階篩選，再看前 3 筆分數。分數越低越好，近分門檻為 `max(0.01, 最佳分數 × 3)`：第 3 筆在門檻內則不保護前綴；否則第 2 筆在門檻內則保留前 2 筆；其餘保留第 1 筆。少於 3 筆按現有項目判斷，空結果略過。
- 可提升者必須屬於近期 50 款，且某一個未裝飾的正式名稱或既有別名連續包含整個查詢。忽略大小寫、統一空白，不拆詞、不跨欄位拼接、不以模糊命中取得近期優先資格。
- 輸出順序為「受保護前綴 → 其餘近期字面命中 → 其餘結果」，三組各自保留原 Fuse 順序，既有物件的 UID、templateId 與開局行為不變。不補入 Fuse 沒有命中的遊戲。
- 完成重排才取 5／20 筆，最後處理 `__CREATE_NEW__`。完全同名是否存在，使用完整的已篩選結果判斷，避免顯示上限造成重複建立入口。
- 前綴判斷為 O(1)，穩定重排為 O(n)。近期集合只隨來源資料更新，不新增資料庫讀取、第二次 Fuse 搜尋或計時器。分數缺失、不合法或不屬於目前查詢時保留原序，避免原始輸入超前 debounced 結果時混用查詢。

主要邏輯位於 `utils/searchRanking.ts`；共用的近期身分與選取邏輯位於 `utils/recentGameOptions.ts`，`sortStrategies.ts` 保留既有的 `getRecentOptions` 匯出。

## 🗳️ 3. 人數智慧預測與鎖定決策 (Prediction & Locks)

系統具備**「多方投票預測機制」**，會根據當前選取的遊戲、時間環境與遊玩歷史，智慧地推薦最可能的「玩家人數」與「遊戲地點」。

為了防止進階篩選與預測機制交互衝突，系統採用了以下**條件式鎖定決策**，**直接制止多方投票預測過程**：

```
                           [ 使用者切換了遊戲 ]
                                    │
                                    ▼
                        【 進階篩選面板是否展開？ 】
                          ├── 否 (Lite 模式) ──► 執行：依新遊戲執行多方投票預測
                          └── 是 ────────────────┐
                                                 ▼
                【 是否啟用「人數篩選」(playableOnly 或 bestOnly)？ 】
                          ├── 否 ──► 執行：依新遊戲執行多方投票預測
                          └── 是 ──► 啟動自動上鎖 ──► [直接制止多方投票預測過程]
```

### 💡 實務運作防呆共識：
當人數被用作於篩選的條件（如開啟 `可玩` 或 `最佳` 篩選）時，系統會直接制止多方投票預測，此時人數由使用者手動靜態主導，**實務上無任何循環更新或死循環問題**，與專案現行「手動調整人數即自動鎖定」的 UX 防呆機制在設計哲學上完全契合。

---

## 🛠️ 4. 模組架構說明 (Module Map)

後續進行維護或功能擴充時，請遵循以下模組分工：

### A. 資料結構與定義：[types.ts](file:///c:/board-game-score-pad/src/features/game-selector/types.ts)
* `GameOption` 介面：新增 `year?: number`（出版年份）、`cooperative?: boolean`（合作遊戲）、`rank?: number`（BGG 排名）。
* `SearchFilters` 介面：定義了 8 大過濾維度狀態（`playerFilter: 'none' | 'playable' | 'best'`、`rating: number | null`、`complexity: 'light' | 'mid' | 'heavy' | null`、`duration: number | null`、`gameType: 'competitive' | 'cooperative' | null`、`smallTable: boolean`、`recentOnly: boolean`）。

### B. 資料聚合層：[useGameOptionAggregator.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameOptionAggregator.ts)
* 負責將 `templates`、`savedGames` 與 `bggGames` 三個非關聯表依據 BGG ID 與 Name 進行高性能聚合，且將 `bgg.year` 寫入 `option.year`，`bgg.cooperative` 寫入 `option.cooperative`，`bgg.rank` 寫入 `option.rank`。

### C. 排序與過濾策略：[sortStrategies.ts](file:///c:/board-game-score-pad/src/features/game-selector/utils/sortStrategies.ts)
* 存放所有的比較器 `Comparator`（如 `byYearPublished`、`byPinned`）以及進階過濾器 `filterOptionsByCriteria`：
  * **人數篩選邏輯優化**：
    * 若 `playerFilter === 'playable'`：檢查 `playerCount >= minPlayers && playerCount <= maxPlayers`。
    * 若 `playerFilter === 'best'`：檢查 `opt.bestPlayers` 包含 `playerCount`（若此條件開啟，自動滿足並涵蓋 playable）。
  * **評分篩選智能降級**：
    * 利用 `rank` 進行智能對比：`9+` 評分對應前 100 名，`8+` 對應前 1000 名，`7+` 對應前 5000 名。
  * **自訂/本地模板防過濾保護**：
    * 對於無 BGG Metadata 的純本地模板，採取人性化的預設放寬或保護，避免過濾器（如 Rating/Complexity/Duration）啟用時，本地 custom templates 被無差別隱藏。
* 模糊搜尋 `getSearchResults` 亦在此實作，支援傳入 dynamic `limit` 參數以適應不同寬度介面，並保證虛擬建立選項 `__CREATE_NEW__` 正確追加。

### D. 狀態衍生與管線：[useGameSelectorLogic.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameSelectorLogic.ts)
* 管理進階面板展開狀態、篩選器狀態。
* 實作三階段過濾與搜尋管線的序列調度，接受 `playerCount` 參數，向組件層提供 `processedOptions` 與 `predictionTarget`。

### E. UI 控制與同步橋接：[StartGamePanel.tsx](file:///c:/board-game-score-pad/src/features/game-selector/components/StartGamePanel.tsx)
* 提供「開始遊戲」面板。
* **雙按鈕 UI 設計**：將原本單一的「最佳 n 人」按鈕，替換為**並排的雙按鈕**——**「n 人可玩」與「n 人最佳」**。
* **循環依賴橋接 (`activePredictionTarget`)**：在組件中聲明 `activePredictionTarget` 狀態。先調用 `useRecommendedGameSetup(activePredictionTarget)`，再調用 `useGameSelectorLogic(..., playerCount)`，最後透過 `useEffect` 同步兩者，解決 React 語法作用域的循環參考問題。
* **預測鎖定 (Decoupling)**：當 `playerFilter !== 'none'`（可玩或最佳篩選被啟用）時，自動觸發人數鎖定，制止多方投票預測，防範無窮更新死循環。
