import React, { useEffect, useRef } from 'react';
import { useSwipe } from '../../../hooks/useSwipe';
import { touchGestureGuard } from '../../../utils/touchGesture';
import type { DashboardMode } from '../dashboardMode';

interface UseDebugGesturesProps {
  viewMode: DashboardMode;
  setViewMode: (mode: DashboardMode) => void;
  disabled?: boolean;
  canOpenSettings?: boolean;
  onTriggerInspector: () => void;
}

export const useDebugGestures = ({
  viewMode,
  setViewMode,
  onTriggerInspector,
  disabled = false,
  canOpenSettings = true,
}: UseDebugGesturesProps) => {
  
  // Refs for custom debug gesture logic
  const debugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugTouchStartRef = useRef<{ x: number; round: number } | null>(null);

  const resetDebug = () => {
    if (debugTimerRef.current !== null) clearTimeout(debugTimerRef.current);
    debugTimerRef.current = null;
    debugTouchStartRef.current = null;
  };

  useEffect(() => resetDebug, [viewMode]);

  // Standard Swipe (Left/Right view switch)
  const SWIPE_THRESHOLD = 35;
  const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, swipeOffset } = useSwipe({
    onSwipeLeft: () => {
      if (disabled) return;
      if (viewMode === 'settings') setViewMode('library');
      if (viewMode === 'library') setViewMode('history');
    },
    onSwipeRight: () => {
      if (disabled) return;
      if (viewMode === 'library' && canOpenSettings) setViewMode('settings');
      if (viewMode === 'history') setViewMode('library');
    },
  }, {
    minSwipeDistance: SWIPE_THRESHOLD,
    minFlickDistance: 10 
  });

  // Custom Debug Gesture: Long Pull Left in History View
  const handleDebugTouchStart = (e: React.TouchEvent) => {
      resetDebug();
      if (disabled) return;
      onTouchStart(e);
      const round = touchGestureGuard.getState().round;
      if (viewMode === 'history' && e.touches.length === 1 && touchGestureGuard.isAllowed(round)) {
          debugTouchStartRef.current = { x: e.touches[0].clientX, round };
      }
  };

  const handleDebugTouchMove = (e: React.TouchEvent) => {
      onTouchMove(e);
      const start = debugTouchStartRef.current;
      if (!start || e.touches.length !== 1 || !touchGestureGuard.isAllowed(start.round)) {
          resetDebug();
          return;
      }
      const currentX = e.touches[0].clientX;
      const deltaX = currentX - start.x;
      
      // Trigger condition: Drag left > 100px and hold
      if (deltaX < -100) {
          if (!debugTimerRef.current) {
              debugTimerRef.current = setTimeout(() => {
                  debugTimerRef.current = null;
                  if (debugTouchStartRef.current !== start || !touchGestureGuard.isAllowed(start.round)) return;
                  // 解鎖隱藏功能標記
                  localStorage.setItem('advance_user', 'true');
                  onTriggerInspector();
                  if (navigator.vibrate) navigator.vibrate([50, 50]);
              }, 3000); // 3 seconds hold
          }
      } else {
          if (debugTimerRef.current) {
              clearTimeout(debugTimerRef.current);
              debugTimerRef.current = null;
          }
      }
  };

  const handleDebugTouchEnd = (e: React.TouchEvent) => {
      resetDebug();
      onTouchEnd(e);
  };

  const handleDebugTouchCancel = () => {
      resetDebug();
      onTouchCancel();
  };

  return {
    handleDebugTouchStart,
    handleDebugTouchMove,
    handleDebugTouchEnd,
    handleDebugTouchCancel,
    swipeOffset
  };
};
