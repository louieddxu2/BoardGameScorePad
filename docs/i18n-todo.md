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

## 待處理清單（依優先順序）

| 優先順序 | 檔案 | 硬編碼數量 | 對應字典 | 狀態 |
|---------|------|-----------|---------|------|
| 1 | `src/hooks/useGoogleDrive.ts` | 35 | `cloud.ts` | 🔲 |
| 2 | `src/components/dashboard/modals/SyncDashboard.tsx` | 23 | `cloud.ts` | 🔲 |
| 3 | `src/components/history/modals/HistorySettingsModal.tsx` | 21 | `history.ts` | 🔲 |
| 4 | `src/features/bgg/services/bggImportService.ts` | 20 | `integration.ts` | 🔲 |
| 5 | `src/components/shared/column-editor/TemplateEditor.tsx` | 14 | `template_editor.ts` | ✅ |
| 6 | `src/components/shared/column-editor/EditorTabAuto.tsx` | 13 | `column_editor.ts` | 🔲 |
| 7 | `src/components/session/parts/ScoreInfoPanel.tsx` | 12 | `session.ts` | 🔲 |
| 8 | `src/components/editor/TextureMapper.tsx` | 12 | `template_editor.ts` | 🔲 |
| 9 | `src/hooks/useAppData.ts` | 11 | `app.ts` | 🔲 |
| 10 | `src/components/session/modals/PhotoGalleryModal.tsx` | 10 | `session.ts` | 🔲 |
| 11 | `src/components/editor/EditorTabAuto.tsx` | 10 | `column_editor.ts` | 🔲 |
| 12 | `src/components/session/parts/AutoScorePanel.tsx` | 8 | `session.ts` | 🔲 |
| 13 | `src/components/analysis/SystemDataInspector.tsx` | 8 | `inspector.ts` | 🔲 |
| 14 | `src/analysis/InspectorShared.tsx` | 8 | `inspector.ts` | 🔲 |
| 15 | `src/components/dashboard/parts/PullActionIsland.tsx` | 7 | `dashboard.ts` | 🔲 |
| 16 | `src/components/dashboard/modals/DataManagerModal.tsx` | 7 | `data_manager.ts` | 🔲 |
| 17 | `src/components/scanner/ScanPreview.tsx` | 6 | `scanner.ts` | 🔲 |
| 18 | `src/features/bgstats/mocks/bgStatsSample.ts` | 6 | 測試資料，可略 | ⏭️ |
| 19 | `src/components/history/HistoryReviewView.tsx` | 9 | `history.ts` | 🔲 |
| 20 | `src/components/modals/InstallGuideModal.tsx` | 5 | `app.ts` | 🔲 |
| 21 | `src/components/dashboard/modals/CloudManagerModal.tsx` | 5 | `cloud.ts` | 🔲 |
| 22 | `src/components/session/parts/GridPhase.tsx` | 5 | `session.ts` | 🔲 |
| 23 | `src/components/scanner/CameraView.tsx` | 5 | `scanner.ts` | 🔲 |
| 24 | `src/components/shared/column-editor/PlayerEditor.tsx` | 4 | `session.ts` | 🔲 |
| 25 | `src/components/shared/column-editor/StructurePhase.tsx` | 4 | `session.ts` | 🔲 |
| 26 | `src/hooks/useSessionEvents.ts` | 4 | `session.ts` | 🔲 |
| 27 | `src/hooks/useSessionManager.ts` | 4 | `session.ts` | 🔲 |
| 28 | `src/components/analysis/WeightsInspector.tsx` | 4 | `inspector.ts` | 🔲 |
| 29 | `src/components/scanner/ScannerSourceSelector.tsx` | 4 | `scanner.ts` | 🔲 |
| 30+ | 其他 32 個（各 1-3 筆）| ~50 | 各對應字典 | 🔲 |

---

## 可略過的檔案

| 檔案 | 原因 |
|------|------|
| `src/features/bgstats/mocks/bgStatsSample.ts` | 測試 mock 資料，非 UI |
| `src/services/googleDriveClient.ts` | 錯誤訊息給 console，非 UI |

---

## 已完成

| 檔案 | 完成日期 |
|------|---------|
| `src/components/editor/TemplateEditor.tsx` | 2026-02-25 |
| `src/components/dashboard/views/HistoryView.tsx` | 2026-02-25 |
