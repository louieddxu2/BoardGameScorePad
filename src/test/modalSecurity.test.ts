// @ts-nocheck
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 已知在外部統一管理返回鍵，或不屬於獨立懸浮彈窗的例外白名單
const EXTERNAL_MANAGED_MODALS = new Set([
  'CloudLibraryModal.tsx',
  'CloudManagerModal.tsx',
  'DataManagerModal.tsx',
  'InstallGuideModal.tsx',
  'IOSPwaGuide.tsx',
  'InAppBrowserGuide.tsx',
  'GameSetupModal.tsx',       // 其生命週期與視圖切換綁定
  'ImportTemplateModal.tsx',   // 由 TextureMapper 承載的次級彈窗
  'SyncDashboard.tsx',         // 作為 CloudManager 的嵌入子組件
  'ShareMenu.tsx',             // 由 useSessionEvents.ts 統一在外部管理
  'ConfirmationModal.tsx',     // 通用對話框，通常由 Hook 或外部渲染
  'BggImportModal.tsx',        // 由 useDashboardModals.ts 統一管理
  'BgStatsModal.tsx',          // 由 useDashboardModals.ts 統一管理
  'PlayerEditor.tsx',          // Inline 玩家編輯器而非 Backdrop Modal
]);

// 非彈窗元件的全域主頁面或配置視圖 (不需要 Backdrop/返回鍵防禦)
const NON_MODAL_BYPASS = new Set([
  'App.tsx',
  'Dashboard.tsx',
  'HistoryReviewView.tsx',
  'ColumnConfigEditor.tsx',
  'PhotoScanner.tsx',          // 全螢幕影像處理工作流視圖，而非標準 Backdrop 懸浮彈窗
]);

/**
 * 遞迴尋找指定目錄下的所有 tsx 檔案，排除測試與指定目錄
 */
function getAllFiles(dirPath: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return fileList;
  const files = fs.readdirSync(dirPath);

  files.forEach((file: string) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      // 排除 hooks 等非組件目錄
      if (filePath.endsWith(`${path.sep}hooks`) || filePath.endsWith(`${path.sep}test`) || filePath.endsWith(`${path.sep}utils`)) {
        return;
      }
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') && !filePath.includes('.test.') && !filePath.includes('.spec.')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * 剥離程式碼中的單行 (// ...) 與多行 (/* ... * /) 註解，避免靜態分析誤判
 */
function stripComments(code: string): string {
  // 用空白替代註解，以保持程式碼字串結構不變
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行註解
    .replace(/^(?!\s*['"])\s*\/\/.*$/gm, '') // 移除單行註解（避開類似 http:// 的 URL）
    .replace(/[^:]\/\/.*$/gm, ''); // 移除行尾單行註解
}

describe('Modal Security & Compliance Static Scan', () => {
  const srcPath = path.resolve(__dirname, '..');
  const filesToCheck = getAllFiles(srcPath);

  test('All Modal components must comply with physical back button defense and z-index coordinated guidelines', () => {
    const complianceErrors: string[] = [];

    filesToCheck.forEach((filePath) => {
      const fileName = path.basename(filePath);
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      
      // 剝離所有註解，只對實體程式碼進行檢驗
      const content = stripComments(rawContent);

      // 判定該檔案是否屬於 Modal 彈窗元件：
      // 1. 檔名結尾為 Modal.tsx 或 Lightbox.tsx
      // 2. 或是檔案路徑位於 "/modals/" 或 "/modal/" 目錄下
      // 3. 或是該檔案內已經主動引入或呼叫了 useModalBackHandler
      const isCandidate = 
        fileName.endsWith('Modal.tsx') || 
        fileName.endsWith('Lightbox.tsx') ||
        filePath.includes(`${path.sep}modals${path.sep}`) ||
        filePath.includes(`${path.sep}modal${path.sep}`) ||
        /useModalBackHandler\s*\(/.test(content);

      if (!isCandidate) return;

      // 排除非彈窗主頁面或全域設定視圖
      if (NON_MODAL_BYPASS.has(fileName)) return;

      // 檢查是否標記了手動排除註解
      const hasBypassAnnotation = 
        rawContent.includes('@modal-bypass-back-handler') || 
        rawContent.includes('@modal-bypass-security-scan');

      const isWhiteListed = EXTERNAL_MANAGED_MODALS.has(fileName);

      // ==========================================
      // 1. 實體返回鍵防禦檢驗 (useModalBackHandler)
      // ==========================================
      const shouldHaveBackHandler = !isWhiteListed && !hasBypassAnnotation;
      const hasBackHandler = /useModalBackHandler\s*\(/.test(content);

      if (shouldHaveBackHandler && !hasBackHandler) {
        complianceErrors.push(
          `[FAIL] ${fileName}\n` +
          `  - 原因：此獨立彈窗元件未引入/呼叫 \`useModalBackHandler\` 管理實體返回鍵。\n` +
          `  - 建議：請引入 \`useModalBackHandler\` 並在元件內呼叫它；或若是外部管理/嵌入彈窗，請將檔名加入測試的 EXTERNAL_MANAGED_MODALS 白名單，或在元件頂部加上 \`// @modal-bypass-back-handler\` 註解。`
        );
        return; // 若缺少核心 Hook 則跳過後續檢查，避免報出無意義的次級錯誤
      }

      // ==========================================
      // 2. z-index 受控層疊與嚴禁寫死 Backdrop 檢驗
      // ==========================================
      if (hasBackHandler) {
        // A. 必須正確使用並套用 zIndex 變數
        const usesZIndexVariable = /\bzIndex\b/.test(content);
        if (!usesZIndexVariable) {
          complianceErrors.push(
            `[FAIL] ${fileName}\n` +
            `  - 原因：已呼叫 \`useModalBackHandler\`，但程式碼中未發現對回傳值 \`zIndex\` 變數的使用或解構。\n` +
            `  - 建議：請解構 \`const { zIndex } = useModalBackHandler(...)\` 並套用於最外層 Backdrop：\`style={{ zIndex }}\`。`
          );
        }

        // B. Backdrop 遮罩層嚴禁硬編碼寫死高優先級 z-index 樣式類別
        // 當開啟了 useModalBackHandler 後，應完全由受控 zIndex 管理層疊，不應在 className 中寫死 z-50 等
        // 僅當該 z-index 是寫在含有 modal-backdrop 的 class 屬性中時才報錯，避免誤判彈窗內部的 Header 等定位
        const hardcodedBackdropZIndexRegex = /className=["'][^"']*\bmodal-backdrop\b[^"']*\bz-(50|40|\[(100|200|300|500|999|[4-9]\d{2})\])\b[^"']*["']/g;
        const matches = content.match(hardcodedBackdropZIndexRegex);
        if (matches) {
          complianceErrors.push(
            `[FAIL] ${fileName}\n` +
            `  - 原因：發現硬編碼的 Backdrop z-index 樣式類別（如 ${matches.join(', ')}）。\n` +
            `  - 建議：當使用 \`useModalBackHandler\` 時，請移除 className 中寫死的 \`z-50\` 或 \`z-[...]\` 類別，統一交由 \`style={{ zIndex }}\` 受控管理。`
          );
        }
      }

      // ==========================================
      // 3. 安全退出與歷史紀錄直接繞過防範
      // ==========================================
      // 嚴格禁止除 useModalBackHandler.ts 與 App.tsx 以外的元件直接呼叫原生 window.history.back/go 繞過防禦
      if (!fileName.includes('useModalBackHandler') && !fileName.includes('App.tsx')) {
        const bypassHistoryRegex = /window\.history\.(back|go)\(/g;
        if (bypassHistoryRegex.test(content)) {
          complianceErrors.push(
            `[FAIL] ${fileName}\n` +
            `  - 原因：偵測到直接操作原生 \`window.history\`。這會繞過返回鍵防禦機制並損壞 Modal 歷史堆疊。\n` +
            `  - 建議：請移除原生 history 操作，改為呼叫 \`onClose\` 或藉由 Hook 取得 \`triggerClose(steps)\` 進行多步退棧。`
          );
        }
      }
    });

    // 格式化輸出錯誤，方便開發者快速修正
    if (complianceErrors.length > 0) {
      const errorMsg = 
        `\n======================================================\n` +
        `❌ 偵測到 ${complianceErrors.length} 個不合規的彈窗 (Modal) 元件：\n` +
        `======================================================\n\n` +
        complianceErrors.join('\n\n') +
        `\n\n======================================================\n` +
        `💡 彈窗防呆合規指引請參考 [docs/useModalBackHandler] 或是實作規劃書。\n` +
        `======================================================\n`;
      
      expect.fail(errorMsg);
    }
  });
});
