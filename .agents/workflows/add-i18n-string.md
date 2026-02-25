---
description: 新增 i18n 雙語字串的標準作業流程 (SOP)
---

# 新增 i18n 雙語字串 SOP

本專案使用**自訂 i18n 系統**，所有翻譯字串存放於 `src/i18n/` 目錄下的模組化字典檔。
禁止在字典檔以外的 .tsx / .ts 檔案中使用硬編碼中文字串。

---

## 步驟一：確認屬於哪個字典模組

| 字串類型 | 對應字典檔 | Hook |
|---------|-----------|------|
| 儀表板（遊戲庫、歷史清單） | `src/i18n/dashboard.ts` | `useDashboardTranslation()` |
| 遊戲進行中計分畫面 | `src/i18n/session.ts` | `useSessionTranslation()` |
| 工具箱（碼表、分隊等） | `src/i18n/tools.ts` | `useToolsTranslation()` |
| BGG / BGStats 整合介面 | `src/i18n/integration.ts` | `useIntegrationTranslation()` |
| 雲端同步 | `src/i18n/cloud.ts` | `useCloudTranslation()` |
| 遊戲流程（開始、設定） | `src/i18n/game_flow.ts` | `useGameFlowTranslation()` |
| App 層級（安裝引導） | `src/i18n/app.ts` | `useAppTranslation()` |
| 共用（確認、取消等） | `src/i18n/common.ts` | `useCommonTranslation()` |

---

## 步驟二：在字典檔中新增字串（zh-TW 和 en 必須同步）

在對應的 `src/i18n/[module].ts` 裡，同時加入兩種語言：

```typescript
// ❌ 錯誤：只加中文
zh-TW: { my_key: "我的文字" }

// ✅ 正確：中英文同步
'zh-TW': { my_key: "我的文字" },
'en':    { my_key: "My Text" },
```

---

## 步驟三：在元件中使用 Hook

```tsx
// 1. 匯入 hook（注意：從對應的字典檔匯入，不是從 '../i18n' 直接匯入）
import { useIntegrationTranslation } from '../../../i18n/integration';

// 2. 在元件內初始化
const { t } = useIntegrationTranslation();

// 3. 使用
<button>{t('my_key')}</button>

// 有參數的情況
<span>{t('my_key_with_param', { count: 5 })}</span>
// 對應字典：my_key_with_param: "共 {count} 筆"
```

---

## 步驟四：驗證（每次 i18n 修改後必跑）

```powershell
# 1. 掃描是否有殘留的硬編碼中文
.\scripts\scan-hardcoded-chinese.ps1

# 2. TypeScript 型別檢查（確保字串 key 拼寫正確）
npx tsc --noEmit
```

兩者皆回報成功後，才可 commit。

---

## ⚠️ 常見錯誤

1. **忘記在 `en` 區段加字串** → `tsc` 不會報錯，但切換到英文時 key 名稱會直接顯示
2. **從 `../i18n` 或 `../../i18n` 直接 import** → Vite 可能解析錯誤，應從 `./index` 或對應字典檔匯入
3. **新增字串後未重啟 dev server** → 若 Vite HMR 異常，可能需要 `Ctrl+C` 後重新 `npm run dev`
