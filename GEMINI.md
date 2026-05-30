# Board Game ScorePad — 專案規範
# 此檔案供 Antigravity 讀取，定義本專案的特定限制與慣例。
# 全域通用原則請見使用者層級的 GEMINI.md。

## 🏗️ 專案定位與效能限制

- **離線優先 PWA**：部署於 GitHub + Vercel，支援離線使用。
- **體積上限**：安裝後維持 1MB 以內（目前約 300KB），嚴禁引入會顯著增加 bundle size 的套件。
- **依賴管理**：引入任何新 npm 套件前，必須說明原因、套件功能與體積影響，並獲得確認。

## 🌐 允許連網的功能清單（白名單）

目前**僅以下三項**允許發出網路請求，其他一律禁止：
1. 雲端備份本地端紀錄（Google Drive）
2. 從 Google 試算表下載 BGG 遊戲清單
3. App 啟動時的 Edge Request 版本檢查

## 📦 目前開發階段

- **保守擴充**：既有功能已告一段落，預設不新增新功能。
- 例外：Bug 修復、明顯 UX 問題改善、i18n 雙語化補齊。

## 🌐 i18n 實作規範（此專案專屬架構）

- **自訂實作**，不引入 `i18next` 等外部 i18n 套件。
- 所有翻譯字串存放於 `src/i18n/` 下的獨立 `*.ts` 模組（如 `dashboard.ts`）。
- 每個模組輸出對應的 `useXxxTranslation()` hook。
- `src/i18n/index.tsx` 是 `LanguageProvider` 與 `useTranslation` 的唯一來源。
- **雙向同步**：新增任何 UI 字串時，中英文必須同步加入同一 PR。
- **先有翻譯 key，後有引用**：先在字典檔補齊，才能在元件中使用。
- **待辦清單**：`docs/i18n-todo.md` 記錄所有待處理的雙語化目標。
- **禁止**：在 `src/i18n/` 以外的 `.tsx/.ts` 掃碼用途文件中硬編碼中文字串。

## 🎨 UI 圖示限制

- **鎖定版本**：`lucide-react v0.344.0`，僅能使用該版本已存在的圖示。
- **不確定時**：選用通用圖示或自訂 SVG，禁止猜測圖示名稱。
- **命名衝突**：禁止直接 import 全域保留字（`Infinity`, `Object`, `NaN`），需設定別名。

## 🚫 專案禁區

- （原 `src/constants.ts` 內容已移至 `src/data/templates.ts` 與 `src/data/templates-en.ts`。在此目錄下的樣板資料應視為準正式環境資料，非必要請勿隨意更動）
- **雲端安全防線 (Cloud D1 API) 唯一出口**：嚴禁在 `src/services/cloudClient.ts` 之外的任何地方直接呼叫 `fetch` 發送請求到雲端 API（即含有 `VITE_TEMPLATE_SHARE_API_BASE_URL` 或 `scoreboard-api.louieddxu2` 的網路請求）。所有與範本分享、下載、上傳的通訊必須統一使用 `cloudClient` 單例。否則 `scripts/verify.ps1` 的靜態掃描會阻斷編譯。


## 🔧 驗證指令

每次修改後的標準驗證流程：
```powershell
powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"
```
（依序執行：掃描硬編碼中文 → tsc → vitest）


## 🚀 CI/CD 節能部署規範

- **本地驗證優先 (方案 A)**：為防止高頻率 `git push` 導致 Vercel CI/CD 部署佇列堵塞與免費 Build Hours 額度浪費，在連續的小微調與 Bug 修復期間，**一律僅在本地端進行 commit，並使用 `powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"` 進行完整驗證**。
- **一次性 Push 釋放**：只有在完成一整個大階段的任務開發，或經使用者明確指示「請部署/請 push」時，才進行一次性 `git push origin [branchName]` 觸發 Vercel 部署。
