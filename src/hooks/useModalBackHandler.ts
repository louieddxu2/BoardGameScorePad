
import { useEffect, useRef } from 'react';

/**
 * 追蹤目前有多少個 modal 正透過此 Hook 管理歷史紀錄。
 * 每個 modal 開啟時 +1、關閉時 -1。
 * popstate 時只有最頂層（最後開啟的）modal 會回應，其餘跳過。
 * 這解決了巢狀彈窗（如 Inspector → useConfirm）互相干擾的問題。
 */
const getActiveCount = () => (window as any).__activeModalCount || 0;
const setActiveCount = (val: number) => { (window as any).__activeModalCount = val; };

/** 供 App.tsx 查詢：是否有 modal 正在管理歷史紀錄？若有，App.tsx 應跳過 popstate 處理。 */
export const hasActiveModals = () => getActiveCount() > 0;

/** 僅供測試使用：重置計數器以確保測試隔離性 */
export const _resetActiveCountForTesting = () => {
  setActiveCount(0);
  delete (window as any).__silentBack;
};

/**
 * 這是一個專門用來處理「彈窗」與「瀏覽器上一頁」連動的 Hook。
 * 
 * 邏輯：
 * 1. 當 isOpen 變為 true 時，自動執行 history.pushState，在歷史紀錄中「佔一個位子」。
 * 2. 當使用者按「上一頁」時 (觸發 popstate)，只有最頂層的 modal 會回應並關閉。
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
      // 1. 重置標記 & 註冊到計數器
      isPoppedRef.current = false;
      const newCount = getActiveCount() + 1;
      setActiveCount(newCount);
      const myOrder = newCount;

      // 2. 推入歷史紀錄
      window.history.pushState({ modal: modalId }, '');

      // 3. 定義上一頁監聽器
      const handlePopState = (e: PopStateEvent) => {
        // [Silent Back] 如果是其他彈窗 UI 關閉觸發的程式清理，不是使用者按返回鍵，跳過。
        if ((window as any).__silentBack) return;

        // [正向匹配] 只有最頂層的 modal 才回應返回鍵。
        // 比起舊版的反向邏輯（state !== myId → close），這能避免巢狀 modal 互相干擾。
        if (myOrder < getActiveCount()) return;

        // 標記為「由瀏覽器上一頁觸發」
        isPoppedRef.current = true;
        // 執行關閉
        onCloseRef.current();
      };

      window.addEventListener('popstate', handlePopState);

      // 4. 清理函式
      return () => {
        window.removeEventListener('popstate', handlePopState);

        if (isPoppedRef.current) {
          // [Popstate 觸發的關閉]
          // React 會同步刷新 setState → useEffect cleanup 在同一個事件循環中執行。
          // 如果我們立即遞減 activeCount，App.tsx 的 popstate handler（同一個 popstate 事件中的後續監聽器）
          // 就會看到 activeCount === 0，誤以為沒有彈窗，進而派發 app-back-press 導致退出。
          // 解法：延遲遞減，讓同一個事件循環中的所有其他 popstate 監聽器都能看到 activeCount > 0。
          setTimeout(() => setActiveCount(Math.max(0, getActiveCount() - 1)), 0);
        } else {
          // [UI 觸發的關閉（點擊取消/確認）]
          // 立即遞減，因為接下來 history.back() 產生的 popstate 會被 __silentBack 攔截。
          setActiveCount(Math.max(0, getActiveCount() - 1));

          (window as any).__silentBack = true;
          window.history.back();
          
          // 在下一個 popstate 事件中清除旗標（比 setTimeout 更可靠）
          const clearSilentBack = () => {
            (window as any).__silentBack = false;
            window.removeEventListener('popstate', clearSilentBack);
          };
          window.addEventListener('popstate', clearSilentBack);
          
          // 保險：如果歷史紀錄已經空了、popstate 不會觸發
          setTimeout(clearSilentBack, 100);
        }
      };
    }
  }, [isOpen, modalId]);
};
