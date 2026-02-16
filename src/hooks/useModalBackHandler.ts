
import { useEffect, useRef } from 'react';

/**
 * 這是一個專門用來處理「彈窗」與「瀏覽器上一頁」連動的 Hook。
 * 
 * 邏輯：
 * 1. 當 isOpen 變為 true 時，自動執行 history.pushState，在歷史紀錄中「佔一個位子」。
 * 2. 當使用者按「上一頁」時 (觸發 popstate)，執行 onClose 關閉彈窗。
 * 3. 當使用者透過 UI (如取消按鈕) 關閉彈窗時，程式自動執行 history.back() 把剛剛佔的位子消除，
 *    以避免使用者下次按上一頁時，還卡在這個已經不存在的彈窗歷史裡。
 * 
 * @param isOpen 彈窗是否開啟
 * @param onClose 關閉彈窗的函式
 * @param modalId 彈窗的唯一識別碼 (用於歷史紀錄的 state 識別)
 */
export const useModalBackHandler = (isOpen: boolean, onClose: () => void, modalId: string) => {
  // 使用 Ref 來保存 onClose，避免因為 onClose 函式本身重建導致 Effect 重跑
  const onCloseRef = useRef(onClose);
  const isPoppedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      // 1. 重置標記
      isPoppedRef.current = false;

      // 2. 推入歷史紀錄
      window.history.pushState({ modal: modalId }, '');

      // 3. 定義上一頁監聽器
      const handlePopState = (e: PopStateEvent) => {
        // 標記為「由瀏覽器上一頁觸發」
        isPoppedRef.current = true;
        // 執行關閉
        onCloseRef.current();
      };

      window.addEventListener('popstate', handlePopState);

      // 4. 清理函式
      return () => {
        window.removeEventListener('popstate', handlePopState);

        // 關鍵邏輯：
        // 如果這個 Effect 被清理（彈窗關閉），且「不是」因為按了上一頁造成的（isPoppedRef 為 false），
        // 代表是使用者點了 UI 上的「取消/確認」按鈕。
        // 這時我們需要手動執行 history.back() 來消除步驟 2 推入的那筆紀錄。
        if (!isPoppedRef.current) {
          window.history.back();
        }
      };
    }
  }, [isOpen, modalId]);
};
