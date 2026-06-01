# AI Map (Token-Saving Edition)

Auto-update index: run `npm run docs:ai-map` to refresh `docs/ai-map.generated.md`.

## One-Line Product定位
BoardGameScorePad 是離線優先的桌遊計分、紀錄、統計與分享工具。

## 使用方式
先判斷任務屬於哪個模組，只讀該模組與關聯檔案；不要先全專案掃描。

## 模組 -> 主要檔案

### Dashboard / 歷史統計 / 九宮格照片
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/HistoryStatsPanel.tsx`
- `src/utils/historyStats.ts`
- `src/utils/historyStats.test.ts`

### Session（遊戲進行中）
- `src/components/session/`
- `src/features/session/` (若存在)

### Template（計分板模板）
- `src/components/template/`
- `src/features/template/` (若存在)

### History（歷史紀錄）
- `src/components/history/`
- `src/hooks/useHistoryQuery.ts` (若存在)

### AI Simple Generator
- `src/features/ai-generator/components/AiSimplePromptModal.tsx`
- `src/features/ai-generator/hooks/useAiSimpleGenerator.ts`
- `src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`

### i18n 文案
- `src/i18n/`
- 改文案優先查對應 namespace 檔，不先改元件邏輯

### 樣式與版面
- 先看元件內 className
- 再看 `tailwind.config.js`
- 最後才看全域容器（`index.html`, `index.tsx`）

## 常見任務快速路徑
- 手機版跑版/欄位溢出：
  - 先看目標元件（例：`HistoryStatsPanel.tsx`）
  - 優先調 `min-w-0`, `overflow-*`, `max-w-full`, `break-words`, flex shrink
- 九宮格資料錯誤或重複：
  - 先看 `src/utils/historyStats.ts` 的 selector/key
  - 再看對應測試 `src/utils/historyStats.test.ts`
- 上傳後預覽不顯示：
  - 先比對 simple/advanced modal 的 DOM 結構與事件處理

## 預設驗證指令
- Type-check: `npx tsc --noEmit`
- Core tests:
  - `npx vitest run --exclude "{src/components/session/SessionUI.test.tsx,src/utils/ui-consistency.test.ts}"`
- AI simple generator 任務加跑：
  - `npx vitest run src/features/ai-generator/hooks/useAiSimpleGenerator.test.tsx`

## 省 Token 規則
1. 先列「只讀檔案清單」再開始讀。
2. 單一 UI 問題最多先讀 3-5 檔，除非證據不足。
3. 不因 UI 問題直接跨到資料層或同步層。
4. 回報時固定附上「修改檔案清單 + 驗證結果」。
