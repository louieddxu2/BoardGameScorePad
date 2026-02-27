# Board Game Score Pad 專案說明（Codex）

## 1. App 概述
Board Game Score Pad 是一個以 **行動裝置為主、離線優先（PWA）** 的桌遊計分與紀錄 App。核心目標是：
- 快速建立/使用遊戲計分板（Template）
- 在對局中高效率記分（Session）
- 將結果存入歷史（History）並支援後續分析與推薦
- 支援雲端備份（Google Drive）與外部資料整合（BGG / BG Stats）

主要入口在 `src/App.tsx`，並由 `useAppData` 聚合資料與操作流程。

## 2. 目前已具備的功能
依現有檔案判斷，已實作功能包含：
- 計分板模板管理：建立、編輯、刪除、匯入、釘選、系統模板還原
- 對局記分：多玩家、多欄位公式、分項/自動計算、不同勝負規則
- 歷史紀錄：儲存、瀏覽、刪除、還原
- 媒體功能：背景圖、相片、截圖、掃描相關元件
- 推薦系統：玩家、人數、地點、顏色推薦（權重可調）
- 雲端整合：Google Drive 登入與模板/進行中/歷史資料同步
- i18n：中英雙語架構與測試（`docs/i18n-todo.md` 顯示 UI 硬編碼已清空）
- 測試與型別檢查：Vitest + TypeScript

## 3. 技術架構摘要
- 前端：React 18 + TypeScript + Vite
- 樣式：Tailwind CSS
- 本地資料庫：Dexie (IndexedDB)
- 測試：Vitest + Testing Library
- PWA：Service Worker + manifest

資料模型核心在 `src/types.ts`；資料庫與 migration 在 `src/db.ts`（目前版本到 v25）。

## 4. 現行缺陷與風險
以下為「目前專案狀態下」可直接從檔案觀察到的問題：

1. README 已過時，與真實專案能力不一致  
- `README.md` 仍是 AI Studio 範本內容，缺少本專案實際功能、架構、資料模型、測試與部署說明。
- 風險：新開發者難以上手，操作流程誤解機率高。

2. 敏感設定寫死在原始碼中  
- `src/config.ts` 直接包含 `GOOGLE_CLIENT_ID`。
- 風險：環境切換困難（dev/staging/prod）、憑證管理不佳，且不利開源協作。

3. Service Worker 註冊邏輯分散且重複  
- `src/registerSW.ts` 與 `index.html` 都有 SW 註冊/更新相關流程。
- 風險：維護成本上升，若邏輯分歧易出現快取與更新行為不一致。

4. 推薦系統尚有未完成功能  
- `src/features/recommendation/RecommendationService.ts` 中 `getSuggestedGames()` 明確標註 TODO，現回傳空陣列。
- 風險：使用者感知「推薦不完整」，且產品承諾與實際功能可能有落差。

5. 關鍵 UI 整合測試被整組跳過  
- `src/components/session/SessionUI.test.tsx` 使用 `describe.skip`，3 個測試全數略過。
- 風險：高互動區（Session 記分流程）回歸時缺乏自動化保護網。

6. 文件編碼/管理一致性不足  
- 專案同時存在大量掃描與報告檔（`scan_*`, `verify_report_*`, `build_err.txt` 等）且部分文件易出現編碼判讀問題。
- 風險：主幹資訊被噪音淹沒，維運者很難快速辨識「哪份才是最新事實」。

## 5. 未來開發方向建議（分階段）

### 第一階段：穩定性與可維護性（優先）
1. 重寫 `README.md` 與補 `docs/architecture.md`  
- 補齊安裝、設定、資料流、測試、發版與備份流程。

2. 設定外部化  
- 將 `GOOGLE_CLIENT_ID` 改為 `import.meta.env`（如 `VITE_GOOGLE_CLIENT_ID`），並提供 `.env.example`。

3. 單一化 SW 管理  
- 保留單一註冊入口（建議 `src/registerSW.ts`），移除 `index.html` 重複邏輯。

4. 測試補強  
- 讓 `SessionUI.test.tsx` 可在 CI 執行（例如加入 fake-indexeddb 或拆分可測層）。

### 第二階段：產品完成度
1. 補完遊戲推薦引擎  
- 實作 `GameRecommendationEngine`，與現有玩家/地點/人數訊號整合。

2. 雲端同步可觀測性提升  
- 在 UI 提供明確同步狀態、失敗原因與重試策略。

3. 文件與需求追蹤標準化  
- 將長期需求（如 `docs/萬用桌遊計分板V4發想.md`）整理成 issue/roadmap，建立優先級。

### 第三階段：效能與規模化
1. 模組與載入策略優化  
- 將較重功能（掃描、雲端管理、分析）拆分 lazy chunk，降低首屏負擔。

2. 建立品質儀表板  
- 在 CI 固定執行 `tsc + vitest + i18n scan`，並留存趨勢資料。

3. 定義資料治理策略  
- 針對 Dexie migration、雲端 JSON 相容性、圖片索引一致性建立版本規範與回滾策略。

## 6. 目前專案健康度（依本次檢視）
- `npm test`：通過（47 passed, 3 skipped）
- `npx tsc --noEmit`：通過
- 架構成熟度：高（功能多、模組齊全）
- 主要瓶頸：文件落差、部分關鍵流程測試覆蓋不足、少數功能未完成

---
此文件由現有程式碼與文件（截至本次掃描）整理而成，可作為後續規劃與重構的起始基線。
