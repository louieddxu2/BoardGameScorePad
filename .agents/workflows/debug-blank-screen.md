---
description: 前端白畫面 (Blank Screen) 的 Debug SOP
---

# 前端白畫面 Debug SOP

// turbo-all

## 核心原則
**白畫面 = Console 錯誤 → 先取得 Console 再動手。**
不要猜測原因，不要花 token 在推理上。Console 錯誤訊息是唯一的真相。

## 步驟

### 1. 取得 Console 錯誤訊息
- **優先**：請使用者按 F12 → Console → 把紅色錯誤訊息貼過來
- **次之**：使用 Browser Subagent 開啟目標頁面並 capture console logs
- **再次之**：如果 Browser Subagent 不可用，在終端用 `Invoke-WebRequest` 確認 HTTP 回應正常（200），然後**直接請使用者提供 Console 內容**

### 2. 分析 Stack Trace
- 看第一行 Error message 是什麼
- 看 Stack trace 指向哪個元件的哪一行
- 不要靠猜，直接開那個檔案看那一行

### 3. 常見陷阱
- **ErrorBoundary 自身崩潰**：如果 ErrorBoundary 依賴了 Context Provider，而 Provider 有問題，ErrorBoundary 跟著死 → 白畫面。ErrorBoundary 絕對不可依賴任何 Provider。
- **雙重 `<script>` 標籤**：`index.html` 裡有兩個載入同一模組的 script → 建立兩份 Context 實體 → useContext 找不到 Provider
- **importmap 衝突**：外部工具注入的 `<script type="importmap">` 會覆蓋 node_modules 的套件版本
- **Vite 快取損壞**：刪除 `node_modules/.vite` 並用 `npx vite --force` 重啟

### 4. 禁止事項
- ❌ 不要一開始就猜測「可能是 IndexedDB」「可能是快取」「可能是循環依賴」
- ❌ 不要在沒有 Console 錯誤的情況下修改程式碼
- ❌ 不要花超過 3 輪 tool call 在推測上，如果無法自行取得 Console，直接請使用者提供
