# i18n 雙語化待辦清單
<!-- 由 scripts/scan-hardcoded-chinese.ps1 掃描產生，2026-02-26 -->
<!-- ✅ = 已完成  🔲 = 待處理 -->

每次 i18n 任務結束後請更新本文件（標記 ✅ 並重跑掃描更新數量）。

## 驗證指令
```powershell
# 掃描硬編碼中文（在專案根目錄執行）
powershell -ExecutionPolicy Bypass -File "scripts\scan-hardcoded-chinese.ps1"

# TypeScript 型別檢查
npx tsc --noEmit

# i18n 字典結構測試（確認 zh-TW / en key 完全對齊）
npm test
```

---

## 待處理清單（已全數清空 🎉）

目前專案內已**無任何**對應的 UI 硬編碼字串殘留。

---

## 掃描腳本排除檔案 (不需雙語化的白名單)

| 檔案 | 原因 |
|------|------|
| `src/features/bgstats/mocks/bgStatsSample.ts` | 測試 mock 資料 |
| `src/services/cloud/googleDriveClient.ts` | 錯誤訊息給 Console，非對外 UI |
| `src/features/bgstats/services/historyBatchUtils.ts` | 批次歷史紀錄產生的預設玩家名稱（如「玩家 1」），涉及寫入資料與相容性 |
| `src/services/relationship/*` | 判定玩家預設名稱的正則表達式 Regex |
| `src/features/recommendation/SessionPlayerInitializer.ts` | 同上 |
| `src/utils/dataMigration.ts` | 舊資料遷移用的對應標籤 |
| `src/components/shared/ErrorBoundary.tsx` | 系統保護網，避免 i18n 例外，採硬編碼雙語 |
| `src/constants.ts` | 專案常數與設定，不應翻譯 |

---

## 已完成 (全專案 100%)

| 檔案 | 完成日期 |
|------|---------|
| `src/components/shared/column-editor/EditorTabAuto.tsx` | 2026-02-27 |
| `src/features/game-selector/hooks/useGameLauncher.ts` | 2026-02-27 |
| `src/hooks/useGoogleDrive.ts` | 2026-02-25 |
| `src/components/dashboard/modals/SyncDashboard.tsx` | 2026-02-25 |
| `src/components/history/modals/HistorySettingsModal.tsx` | 2026-02-25 |
| `src/features/game-catalog/services/gameCatalogImportService.ts` | 2026-02-25 |
| `src/components/session/parts/ScoreInfoPanel.tsx` | 2026-02-26 |
| `src/components/editor/TextureMapper.tsx` | 2026-02-26 |
| `src/hooks/useAppData.ts` | 2026-02-26 |
| `src/components/session/modals/PhotoGalleryModal.tsx` | 2026-02-26 |
| `src/components/editor/EditorTabAuto.tsx` | 2026-02-26 |
| `src/components/session/parts/AutoScorePanel.tsx` | 2026-02-26 |
| `src/components/analysis/SystemDataInspector.tsx` | 2026-02-26 |
| `src/analysis/InspectorShared.tsx` | 2026-02-26 |
| `src/components/dashboard/parts/PullActionIsland.tsx` | 2026-02-26 |
| `src/components/dashboard/modals/DataManagerModal.tsx` | 2026-02-26 |
| `src/components/scanner/ScanPreview.tsx` | 2026-02-26 |
| `src/components/scanner/CameraView.tsx` | 2026-02-26 |
| `src/components/scanner/ScannerSourceSelector.tsx` | 2026-02-26 |
| `src/components/history/HistoryReviewView.tsx` | 2026-02-26 |
| `src/components/modals/InstallGuideModal.tsx` | 2026-02-26 |
| `src/components/dashboard/modals/CloudManagerModal.tsx` | 2026-02-26 |
| (包含內建工具、掃描器、以及所有上述提到的 Batch 1~9 皆已結案) | 2026-02-26 |
