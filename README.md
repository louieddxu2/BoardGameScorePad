# Board Game Score Pad

離線優先（PWA）的桌遊計分與對局紀錄 App，支援：
- 自訂計分板模板（Template）
- 進行中對局（Session）與歷史紀錄（History）
- 本地資料庫（IndexedDB / Dexie）
- Google Drive 雲端備份與還原
- 中英雙語 UI（i18n）

## Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS
- Dexie + dexie-react-hooks
- Vitest + Testing Library

## Local Development
### Prerequisites
- Node.js 18+

### Setup
1. Install dependencies
```bash
npm install
```
2. Copy environment file
```bash
copy .env.example .env.local
```
3. Fill environment variables in `.env.local`

### Run
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

### Type Check
```bash
npx tsc --noEmit
```

## Environment Variables
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth client id for Drive integration
- `GEMINI_API_KEY`: legacy variable (kept for compatibility with earlier scaffold)

## Project Structure
- `src/components/`: UI 元件
- `src/hooks/`: 狀態與流程 hook
- `src/services/`: 資料與雲端服務
- `src/features/`: 功能模組（推薦、匯入匯出等）
- `src/i18n/`: 翻譯字典與 hooks
- `docs/`: 架構、流程、roadmap、封存文件

## Service Worker Notes
SW 目前同時涵蓋開發與正式環境差異處理。設計與流程說明請見：
- `docs/architecture/sw-strategy.md`

## Verification Script
專案建議驗證流程：
```powershell
powershell -ExecutionPolicy Bypass -File "scripts\verify.ps1"
```

## Known Testing Policy
- 單元測試：日常開發/PR 必跑
- 高成本 UI 整合測試：以條件觸發或發版前執行
