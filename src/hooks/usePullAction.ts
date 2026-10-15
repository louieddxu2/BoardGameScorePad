
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { touchGestureGuard } from '../utils/touchGesture';

export type PullActionState = 'neutral' | 'search' | 'cloud';

interface PullActionOptions {
  onTriggerSearch: () => void;
  onTriggerCloud: () => void;
  thresholdY?: number; // 觸發動作所需的最小下拉距離 (預設 20px)
  thresholdX?: number; // 左右滑動鎖定動作的距離 (預設 20px)
  damping?: number;    // 下拉阻尼係數 (數值越接近 1 越跟手，預設 0.8)
  disabled?: boolean;
}

export const usePullAction = (
  scrollContainerRef: React.RefObject<HTMLElement>,
  options: PullActionOptions
) => {
  // [調整] thresholdX 還原為 20px，因為扇形判定已足夠防止誤觸，現在需要更好的水平選取手感
  const { onTriggerSearch, onTriggerCloud, thresholdY = 20, thresholdX = 20, damping = 0.8, disabled = false } = options;

  // UI State (用於渲染)
  const [pullY, setPullY] = useState(0);
  const [pullX, setPullX] = useState(0);
  const [activeState, setActiveState] = useState<PullActionState>('neutral');
  const [isPulling, setIsPulling] = useState(false);

  // Logic Refs (避免閉包陷阱)
  const isTouchingRef = useRef(false);
  const isTopStartRef = useRef(false);
  const isPullingRef = useRef(false); 
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const activeStateRef = useRef<PullActionState>('neutral');
  const pullYRef = useRef(0); 
  const touchRoundRef = useRef(0);
  // Visual updates must not detach the listeners or cancel the active round.
  const callbacksRef = useRef({ onTriggerSearch, onTriggerCloud });
  callbacksRef.current = { onTriggerSearch, onTriggerCloud };
  
  // Distinguish owned horizontal/pull gestures from native vertical scrolling.
  const axisLockRef = useRef<'horizontal' | 'pull' | 'scroll' | null>(null);

  const reset = useCallback(() => {
    isTouchingRef.current = false;
    isPullingRef.current = false;
    axisLockRef.current = null;
    activeStateRef.current = 'neutral';
    pullYRef.current = 0;
    setIsPulling(false);
    setPullY(0);
    setPullX(0);
    setActiveState('neutral');
  }, []);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10); // 輕微震動
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      reset();
      const round = touchGestureGuard.getState().round;
      if (e.touches.length !== 1 || !touchGestureGuard.isAllowed(round)) return;
      touchRoundRef.current = round;

      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      isTouchingRef.current = true;
      
      // 檢查是否從頂部開始
      isTopStartRef.current = container.scrollTop < 1;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchingRef.current) return;
      if (e.touches.length !== 1 || !touchGestureGuard.isAllowed(touchRoundRef.current)) {
        reset();
        return;
      }
      const touch = e.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      // 1. 軸向鎖定邏輯 (Slope Detection)
      // 當移動超過一定距離(5px)時，判斷主要移動方向並鎖定
      if (!axisLockRef.current) {
          if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
              // [修正] 嚴格限制下拉觸發範圍
              // 使用者要求：只有往正下方的扇形約 30 度 (左右各 15 度) 的展開範圍才被視為觸發
              // tan(15°) ≈ 0.268，取 0.27
              const TAN_15_DEG = 0.27;
              
              // 判定條件：
              // 1. 向下拉 (deltaY > 0)
              // 2. 水平偏移量小於垂直偏移量 * tan(15°)
              const isStrictDown = deltaY > 0 && Math.abs(deltaX) < (Math.abs(deltaY) * TAN_15_DEG);

              axisLockRef.current = Math.abs(deltaX) > Math.abs(deltaY)
                  ? 'horizontal' : isStrictDown ? 'pull' : 'scroll';
          }
      }

      if (axisLockRef.current === 'horizontal') {
          // React's passive touchmove cannot stop native panning. Use this
          // existing non-passive listener, including away from the scroll top.
          if (e.cancelable) e.preventDefault();
          return;
      }
      if (!isTopStartRef.current) return;

      // 2. 只有鎖定為「垂直」且方向向下時，才啟動 Pull Action
      if (axisLockRef.current === 'pull') {
          // 啟動 Pulling 狀態
          if (!isPullingRef.current && deltaY > 0 && container.scrollTop < 1) { 
               isPullingRef.current = true;
               setIsPulling(true);
          }

          if (isPullingRef.current) {
              // 阻止瀏覽器預設行為
              if (e.cancelable) e.preventDefault();

              // 計算座標
              const dampedY = Math.max(0, deltaY * damping);
              const effectiveX = deltaX; // 移除 L 型限制，X 軸直接跟隨
              
              pullYRef.current = dampedY;

              // 狀態判斷
              let newState: PullActionState = 'neutral';
              
              // 只有當下拉距離足夠時，才允許切換狀態 (避免在極頂端誤觸)
              if (dampedY > thresholdY) {
                  if (effectiveX > thresholdX) newState = 'search';
                  else if (effectiveX < -thresholdX) newState = 'cloud';
              }

              // 觸發震動回饋
              if (activeStateRef.current !== newState) {
                  triggerHaptic();
                  activeStateRef.current = newState;
                  setActiveState(newState);
              }

              // 更新 UI
              setPullY(dampedY);
              setPullX(effectiveX);
          }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTouchingRef.current) return;
      if (e.touches.length !== 0 || !touchGestureGuard.isAllowed(touchRoundRef.current)) {
        reset();
        return;
      }

      const action = isPullingRef.current && pullYRef.current > thresholdY ? activeStateRef.current : 'neutral';
      const round = touchRoundRef.current;
      reset();
      if (action === 'neutral') return;
      if (e.cancelable) e.preventDefault();
      touchGestureGuard.markHandled(round);
      triggerHaptic();
      if (action === 'search') callbacksRef.current.onTriggerSearch();
      else callbacksRef.current.onTriggerCloud();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', reset);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', reset);
      reset();
    };
  }, [scrollContainerRef, thresholdY, thresholdX, damping, triggerHaptic, disabled, reset]);

  return {
    pullY,
    pullX,
    activeState,
    isPulling
  };
};
