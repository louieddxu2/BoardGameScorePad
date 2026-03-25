import { useEffect, useRef, useState } from 'react';

/**
 * 追蹤目前開啟的 modal ID 堆疊。
 */
const getModalStack = (): string[] => (window as any).__modalStack || [];
const setModalStack = (stack: string[]) => { (window as any).__modalStack = stack; };

/** 供 App.tsx 查詢：是否有 modal 正在管理歷史紀錄？ */
export const hasActiveModals = () => getModalStack().length > 0;

/** 僅供測試使用：重置堆疊 */
export const _resetActiveCountForTesting = () => {
  setModalStack([]);
  delete (window as any).__silentBack;
};

/**
 * 處理「彈窗」與「瀏覽器上一頁」連動的 Hook。
 * 
 * 使用 ID 堆疊而非計數器，能更精確地決定哪個彈窗該回應返回鍵，
 * 並解決巢狀或快速連續開關彈窗時的同步問題。
 */
export const useModalBackHandler = (isOpen: boolean, onClose: () => void, modalId: string) => {
  const onCloseRef = useRef(onClose);
  const isPoppedRef = useRef(false);
  const [order, setOrder] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      isPoppedRef.current = false;
      setIsReady(false); // Reset guard
      
      // 1. 註冊到堆疊 (避免重複註冊)
      const currentStack = getModalStack();
      if (!currentStack.includes(modalId)) {
        const newStack = [...currentStack, modalId];
        setModalStack(newStack);
        setOrder(newStack.length);
      } else {
        setOrder(currentStack.indexOf(modalId) + 1);
      }

      // 2. 推入歷史紀錄
      window.history.pushState({ modal: modalId }, '');

      // Defer Phase 2: Wait for previous modal's back event to settle
      const timer = setTimeout(() => setIsReady(true), 300);

      return () => {
        clearTimeout(timer);
        setIsReady(false);
        setOrder(0);

        const cleanupStack = () => {
             const stack = getModalStack();
             setModalStack(stack.filter(id => id !== modalId));
        };

        if (isPoppedRef.current) {
          // [Popstate 觸發] 延遲清理確保同一個事件循環的其他監聽器能看到 stack
          setTimeout(cleanupStack, 0);
        } else {
          // [UI 觸發] 立即清理並執行 history.back()
          cleanupStack();
          (window as any).__silentBack = true;
          window.history.back();

          const clearSilentBack = () => {
            (window as any).__silentBack = false;
            window.removeEventListener('popstate', clearSilentBack);
          };
          window.addEventListener('popstate', clearSilentBack);
          setTimeout(clearSilentBack, 100);
        }
      };
    }
  }, [isOpen, modalId]);

  // Phase 2: Attach popstate listener (Delayed)
  useEffect(() => {
    if (isOpen && isReady) {
      const handlePopState = (e: PopStateEvent) => {
        if ((window as any).__silentBack) return;

        // [精確匹配] 只有位於堆疊最頂層的 ID 才會回應
        const stack = getModalStack();
        const topId = stack[stack.length - 1];
        if (topId !== modalId) return;

        isPoppedRef.current = true;
        onCloseRef.current();
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, isReady, modalId]);

  return { 
    order, 
    zIndex: isOpen ? (order > 0 ? 100 + (order * 10) : 101) : 0 
  };
};
