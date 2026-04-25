---
description: 將組件中的硬編碼 Tailwind 色彩類別遷移為語義化 Token 的標準作業流程 (SOP)。每次只處理一個檔案。
---

# 語義色彩遷移 SOP (`/migrate-colors`)

本專案正在將硬編碼的 Tailwind 色彩類別（如 `bg-slate-900`、`text-white`）遷移為語義化 Token（如 `bg-modal-bg`、`text-txt-title`），以支援深色/淺色雙主題切換。

> **核心原則**：同一個物理顏色（如 `slate-800`）在不同組件中可能有不同語義。
> 不可盲目批次替換，必須**逐檔理解上下文**後才能決定對應的語義標籤。

---

## 步驟零：選定目標檔案

1. 執行硬編碼色彩掃描，確認哪些檔案仍有待遷移的項目：

```powershell
# // turbo
npx vitest run src/utils/ui-consistency.test.ts --reporter=verbose 2>&1 | Select-String "FAIL"
```

2. 從掃描結果中選擇**一個檔案**作為本次遷移目標。
3. 優先級順序：`session/modals/` → `shared/` → `session/parts/` → 其他。

---

## 步驟一：分析目標檔案的色彩語義

> ⚠️ **此步驟是整個流程的核心。不可跳過或簡化。**

1. 完整閱讀目標檔案，找出所有硬編碼色彩類別。
2. 對每一處硬編碼，判斷其**語義意圖**（它在這個上下文中代表什麼？）。
3. 輸出一份「語義意圖對照表」給使用者審核，格式如下：

```markdown
### [檔案名稱] 語義意圖對照表

| 行號 | 原始類別 | 語義意圖 | 建議替換為 |
|:---|:---|:---|:---|
| 75 | `bg-black/60` | 彈窗遮罩層 | `bg-modal-backdrop/60` |
| 80 | `bg-slate-900` | 彈窗容器底色 | `bg-modal-bg` |
| 88 | `text-red-400` | 危險操作按鈕文字 | `text-status-danger` |
| 95 | `text-white` | 彈窗主標題 | `text-txt-title` |
| 96 | `text-slate-400` | 副標題/說明文字 | `text-txt-secondary` |
| 109 | `bg-slate-800/50` | 輸入框容器背景 | `bg-modal-bg-elevated/50` |
| 154 | `bg-slate-800` | 次要操作按鈕背景 | `bg-modal-bg-elevated` |
| 162 | `bg-emerald-600` | 主要操作按鈕背景 | `bg-brand-primary-deep` |
```

4. **提交對照表給使用者，等待明確許可後才進入步驟二。**

---

## 步驟二：檢查是否需要新增 Token

對照「可用語義標籤清單」（見附錄 A），確認對照表中每一項的替換目標都已存在。

若有缺失：
1. 在 `src/index.css` 的 `:root`（深色模式）區塊新增變數。
2. 在 `src/index.css` 的 `html[data-theme='light']`（淺色模式）區塊新增對應的淺色值。
3. 在 `tailwind.config.js` 的 `theme.extend.colors` 區塊公開該變數。

> **禁止**：新增語義上重複的 Token。例如不可同時存在 `modal-secondary` 和 `modal-btn-sec`。
> 若不確定是否需要新增，詢問使用者。

---

## 步驟三：執行替換

1. **只修改目標檔案**，不觸碰任何其他 `.tsx` 或 `.css` 檔案（步驟二的 Token 補齊除外）。
2. 使用 `replace_file_content` 或 `multi_replace_file_content` 工具逐一替換。
3. 替換時嚴格遵守對照表，不做任何對照表以外的修改。

---

## 步驟四：驗證

```powershell
# // turbo
powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"
```

若通過，再單獨執行語義色彩測試，確認目標檔案不再出現違規：

```powershell
# // turbo
npx vitest run src/utils/ui-consistency.test.ts --reporter=verbose 2>&1 | Select-String "[目標檔案名稱]"
```

> 注意：其他尚未遷移的檔案仍會報 FAIL，這是預期行為。只需確認**本次目標檔案已通過**。

---

## 步驟五：提交

```powershell
git add .
git commit -m "refactor(ui): semantic color migration for [檔案名稱]"
```

---

## ⚠️ 常見錯誤

1. **語義混淆**：將 `bg-slate-800`（在按鈕中是「浮起表面」）和 `bg-slate-800`（在格子中是「基準底色」）替換為同一個 Token。**每一處都要根據上下文判斷。**
2. **遺漏 hover 狀態**：只替換了 `bg-slate-800` 但忘了替換同一元素上的 `hover:bg-slate-700`。hover 狀態必須同步語義化。
3. **破壞 `placeholder-` 前綴**：`placeholder-slate-500` 應替換為 `placeholder-txt-muted`，不是 `text-txt-muted`。
4. **觸碰非目標檔案**：即使在閱讀過程中發現其他檔案的問題，也**絕不在本次修改中處理**。記錄下來，留待下一個迴圈。
5. **忘記 opacity 修飾符**：`bg-slate-800/50` 中的 `/50` 必須保留。替換為 `bg-modal-bg-elevated/50`，而不是 `bg-modal-bg-elevated`。

---

## 🚫 絕對禁止

1. **在一次修改中處理超過一個檔案的色彩遷移**。
2. **不提交對照表就直接動手修改**。
3. **新增與既有 Token 語義重複的變數**。
4. **修改 `src/index.css` 中既有變數的色值**（除非使用者明確要求）。

---

## 附錄 A：可用語義標籤清單

### 文字 (`text-*`)

| Token | 深色模式 | 淺色模式 | 用途 |
|:---|:---|:---|:---|
| `txt-title` | 純白 `255 255 255` | slate-900 | 最高層級標題 |
| `txt-primary` | slate-50 | slate-900 | 正文 |
| `txt-secondary` | slate-400 | slate-600 | 次要說明 |
| `txt-tertiary` | slate-300 | slate-700 | 三級資訊 |
| `txt-muted` | slate-500 | slate-400 | 淡化/禁用 |

### 背景 (`bg-*`)

| Token | 深色模式 | 淺色模式 | 用途 |
|:---|:---|:---|:---|
| `app-bg` | slate-900 | slate-50 | 頁面底層背景 |
| `app-bg-deep` | slate-950 | slate-100 | 更深的底層 |
| `surface-bg` | slate-800 | white | 卡片/面板表面 |
| `surface-alt` | slate-850 | slate-50 | 交替列 |
| `surface-hover` | slate-750 | slate-100 | 懸停回饋 |
| `modal-bg` | slate-900 | white | 彈窗容器 |
| `modal-bg-elevated` | slate-800 | slate-100 | 彈窗內按鈕/區塊 |
| `modal-bg-recessed` | slate-850 | slate-200 | 彈窗內凹陷區 |
| `modal-backdrop` | 純黑 | slate-900/40% | 彈窗遮罩 |

### 邊框 (`border-*`)

| Token | 深色模式 | 淺色模式 | 用途 |
|:---|:---|:---|:---|
| `surface-border` | slate-700 | slate-200 | 通用分隔線 |
| `surface-border-hover` | slate-600 | slate-300 | 懸停邊框 |
| `modal-border` | slate-700 | slate-200 | 彈窗外框 |

### 品牌色 (`brand-*`)

| Token | 深色模式 | 淺色模式 | 用途 |
|:---|:---|:---|:---|
| `brand-primary` | emerald-500 | emerald-500 | 裝飾/文字/圖示 |
| `brand-primary-deep` | emerald-600 | emerald-600 | 按鈕填充 |
| `brand-secondary` | indigo-500 | indigo-600 | 次要品牌色 |

### 狀態色 (`status-*`)

| Token | 深色模式 | 淺色模式 | 用途 |
|:---|:---|:---|:---|
| `status-danger` | red-500 | red-600 | 錯誤/危險 |
| `status-warning` | amber-400 | amber-500 | 警告/預覽 |
| `status-success` | emerald-500 | emerald-500 | 成功 |
| `status-info` | sky-400 | sky-600 | 資訊提示 |

---

## 附錄 B：語義判斷指南

當不確定某個色彩應該對應哪個 Token 時，按以下優先級判斷：

1. **它在 UI 中扮演什麼角色？**（標題？按鈕？邊框？背景？）
2. **它屬於哪個層級？**（頁面級 → `app-*`、面板級 → `surface-*`、彈窗級 → `modal-*`）
3. **它的互動狀態是什麼？**（靜止 → 無後綴、懸停 → `hover`、凹陷 → `recessed`）

範例：
- `bg-slate-900` 在**彈窗**中 → `bg-modal-bg`
- `bg-slate-900` 在**頁面背景**中 → `bg-app-bg`
- `bg-slate-800` 在**彈窗按鈕**中 → `bg-modal-bg-elevated`
- `bg-slate-800` 在**計分板格子**中 → 保留 CSS 變數 `var(--c-grid-cell-bg)` 或 `bg-surface-bg`
