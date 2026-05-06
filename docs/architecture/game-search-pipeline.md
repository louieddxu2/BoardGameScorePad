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
         │   ├─ 有關鍵字 ──► 於當前過濾池中做「模糊搜尋」 │
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
* `GameOption` 介面：新增 `year?: number`（出版年份）。
* `SearchFilters` 介面：新增 `playableOnly: boolean`（人數可玩篩選開關）。

### B. 資料聚合層：[useGameOptionAggregator.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameOptionAggregator.ts)
* 負責將 `templates`、`savedGames` 與 `bggGames` 三個非關聯表依據 BGG ID 與 Name 進行高性能聚合，且將 `bgg.year` 寫入 `option.year`。

### C. 排序與過濾策略：[sortStrategies.ts](file:///c:/board-game-score-pad/src/features/game-selector/utils/sortStrategies.ts)
* 存放所有的比較器 `Comparator`（如 `byYearPublished`、`byPinned`）以及進階過濾器 `filterOptionsByCriteria`：
  * **人數篩選邏輯優化**：
    * 若 `playableOnly === true`：檢查 `playerCount >= minPlayers && playerCount <= maxPlayers`。
    * 若 `bestOnly === true`：檢查 `opt.bestPlayers` 包含 `playerCount`（若此條件開啟，自動滿足並涵蓋 playableOnly）。
* 模糊搜尋 `getSearchResults` 亦在此實作，支援傳入 dynamic `limit` 參數以適應不同寬度介面，並保證虛擬建立選項 `__CREATE_NEW__` 正確追加。

### D. 狀態衍生與管線：[useGameSelectorLogic.ts](file:///c:/board-game-score-pad/src/features/game-selector/hooks/useGameSelectorLogic.ts)
* 管理進階面板展開狀態、篩選器狀態（新增 `playableOnly` 的預設值與重置處理）。
* 實作三階段過濾與搜尋管線的序列調度，向組件層提供 `processedOptions` 與 `predictionTarget`。

### E. UI 控制與同步橋接：[StartGamePanel.tsx](file:///c:/board-game-score-pad/src/features/game-selector/components/StartGamePanel.tsx)
* 提供「開始遊戲」面板。
* **雙按鈕 UI 設計**：將原本單一的「最佳 n 人」按鈕，替換為**並排（grid grid-cols-2）的雙按鈕**——**「n 人可玩」與「n 人最佳」**。
* 負責解耦 `playerCount`（中介狀態傳遞），並在 `playableOnly` 或 `bestOnly` 被勾選時觸發自動人數鎖定。
