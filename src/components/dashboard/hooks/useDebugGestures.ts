import React, { useRef } from 'react';
import { useSwipe } from '../../../hooks/useSwipe';

interface UseDebugGesturesProps {
  viewMode: 'library' | 'history';
  setViewMode: (mode: 'library' | 'history') => void;
  onTriggerInspector: () => void;
}

export const useDebugGestures = ({
  viewMode,
  setViewMode,
  onTriggerInspector
}: UseDebugGesturesProps) => {
  
  // Refs for custom debug gesture logic
  const debugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugTouchStartRef = useRef<number>(0);

  // Standard Swipe (Left/Right view switch)
  const SWIPE_THRESHOLD = 35;
  const { onTouchStart, onTouchMove, onTouchEnd, swipeOffset } = useSwipe({
    onSwipeLeft: () => {
      if (viewMode === 'library') setViewMode('history');
    },
    onSwipeRight: () => {
      if (viewMode === 'history') setViewMode('library');
    },
  }, {
    minSwipeDistance: SWIPE_THRESHOLD,
    minFlickDistance: 10 
  });

  // Custom Debug Gesture: Long Pull Left in History View
  const handleDebugTouchStart = (e: React.TouchEvent) => {
      if (viewMode !== 'history') {
          onTouchStart(e); 
          return;
      }
      debugTouchStartRef.current = e.touches[0].clientX;
      onTouchStart(e); 
  };

  const handleDebugTouchMove = (e: React.TouchEvent) => {
      if (viewMode !== 'history') {
          onTouchMove(e);
          return;
      }
      const currentX = e.touches[0].clientX;
      const deltaX = currentX - debugTouchStartRef.current;
      
      // Trigger condition: Drag left > 100px and hold
      if (deltaX < -100) {
          if (!debugTimerRef.current) {
              debugTimerRef.current = setTimeout(() => {
                  onTriggerInspector();
                  if (navigator.vibrate) navigator.vibrate([50, 50]);
                  debugTimerRef.current = null;
              }, 3000); // 3 seconds hold
          }
      } else {
          if (debugTimerRef.current) {
              clearTimeout(debugTimerRef.current);
              debugTimerRef.current = null;
          }
      }
      onTouchMove(e);
  };

  const handleDebugTouchEnd = () => {
      if (debugTimerRef.current) {
          clearTimeout(debugTimerRef.current);
          debugTimerRef.current = null;
      }
      onTouchEnd();
  };

  return {
    handleDebugTouchStart,
    handleDebugTouchMove,
    handleDebugTouchEnd,
    swipeOffset
  };
};