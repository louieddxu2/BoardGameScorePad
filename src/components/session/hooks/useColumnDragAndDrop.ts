import React, { useState, useRef, useEffect } from 'react';
import { GameTemplate } from '../../../types';
import { touchGestureGuard } from '../../../utils/touchGesture';

interface DragAndDropProps {
  template: GameTemplate;
  onUpdateTemplate: (template: GameTemplate) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export const useColumnDragAndDrop = ({ template, onUpdateTemplate, scrollRef }: DragAndDropProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number>(0);
  const touchRoundRef = useRef<number | null>(null);
  // Event ownership must change synchronously, independently of UI renders.
  const activeDragRef = useRef<{
    mode: 'touch' | 'native';
    fromId: string;
    targetId: string;
    multitouchSequence: number;
  } | null>(null);
  
  // Auto-scroll logic
  const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupScroll = () => {
      if (scrollInterval.current) {
          clearInterval(scrollInterval.current);
          scrollInterval.current = null;
      }
  };

  const scrollStep = (amount: number) => {
      if (activeDragRef.current?.mode === 'native' && !getValidNativeDrag()) return;
      if (touchRoundRef.current !== null && !touchGestureGuard.isAllowed(touchRoundRef.current)) {
          cleanupScroll();
          return;
      }
      if (scrollRef.current) scrollRef.current.scrollTop += amount;
  };

  const checkAutoScroll = (clientY: number) => {
      if (!scrollRef.current) return;
      const { top, bottom } = scrollRef.current.getBoundingClientRect();
      const zone = 60; // Activation zone size (px)
      const speed = 10; // Scroll speed

      cleanupScroll();

      if (clientY < top + zone) {
          scrollInterval.current = setInterval(() => scrollStep(-speed), 16);
      } else if (clientY > bottom - zone) {
          scrollInterval.current = setInterval(() => scrollStep(speed), 16);
      }
  };

  const moveColumn = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const newCols = [...template.columns];
    const fromIdx = newCols.findIndex(c => c.id === fromId);
    const toIdx = newCols.findIndex(c => c.id === toId);
    
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = newCols.splice(fromIdx, 1);
      newCols.splice(toIdx, 0, moved);
      onUpdateTemplate({ ...template, columns: newCols });
    }
  };

  const clearTouchTracking = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    touchRoundRef.current = null;
  };

  const resetDrag = () => {
    clearTouchTracking();
    cleanupScroll();
    activeDragRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const startDrag = (mode: 'touch' | 'native', colId: string) => {
    activeDragRef.current = {
      mode, fromId: colId, targetId: colId,
      multitouchSequence: touchGestureGuard.getMultitouchSequence(),
    };
    setDraggingId(colId);
    setDropTargetId(colId);
  };

  const updateDropTarget = (colId: string) => {
    const drag = activeDragRef.current;
    if (drag && drag.targetId !== colId) {
      drag.targetId = colId;
      setDropTargetId(colId);
    }
  };

  const getValidNativeDrag = () => {
    const drag = activeDragRef.current;
    if (drag?.mode !== 'native') return null;
    if (drag.multitouchSequence !== touchGestureGuard.getMultitouchSequence()) {
      resetDrag();
      return null;
    }
    return drag;
  };

  // --- Native Drag Handlers (mouse or browser-owned touch drag) ---

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    if (touchGestureGuard.getState().active) {
      e.preventDefault();
      resetDrag();
      return;
    }
    // The browser can take over before or after our long-press timer fires.
    // Its later touchcancel must not cancel the new native owner.
    clearTouchTracking();
    cleanupScroll();
    startDrag('native', colId);
    e.dataTransfer.effectAllowed = "move";
    // Optional: Hide default ghost or set custom one if needed, 
    // but standard behavior is usually fine.
  };

  const handleDragOver = (e: React.DragEvent, colId?: string) => {
    if (!getValidNativeDrag()) return;
    e.preventDefault(); // Necessary to allow dropping
    // Controls/backgrounds retain the same target as the visible drop line.
    if (colId !== undefined) updateDropTarget(colId);
    checkAutoScroll(e.clientY);
  };

  const handleDrop = (e: React.DragEvent, colId?: string) => {
    if (activeDragRef.current?.mode !== 'native') return;
    e.preventDefault();
    const drag = getValidNativeDrag();
    if (!drag) return;
    resetDrag();
    moveColumn(drag.fromId, colId ?? drag.targetId);
  };

  const handleDragEnd = () => {
    if (activeDragRef.current?.mode === 'native') resetDrag();
  };

  // --- Touch Handlers ---

  const cancelTouchDrag = () => {
    if (activeDragRef.current?.mode === 'native') {
      if (getValidNativeDrag()) clearTouchTracking();
    } else resetDrag();
  };

  const handleTouchStart = (e: React.TouchEvent, colId: string) => {
    if (activeDragRef.current?.mode === 'native') {
      if (e.touches.length > 1) {
        resetDrag();
        return;
      }
      if (getValidNativeDrag()) return;
    }
    cancelTouchDrag();
    const round = touchGestureGuard.getState().round;
    if (e.touches.length !== 1 || !touchGestureGuard.isAllowed(round)) return;
    touchRoundRef.current = round;
    touchStartY.current = e.touches[0].clientY;
    
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      if (touchRoundRef.current !== round || !touchGestureGuard.isAllowed(round)) return;
      startDrag('touch', colId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeDragRef.current?.mode === 'native') {
      if (e.touches.length > 1) resetDrag();
      else getValidNativeDrag();
      return;
    }
    if (e.touches.length !== 1 || touchRoundRef.current === null
      || !touchGestureGuard.isAllowed(touchRoundRef.current)) {
      cancelTouchDrag();
      return;
    }
    if (activeDragRef.current?.mode !== 'touch') {
      if (Math.abs(e.touches[0].clientY - touchStartY.current) > 10) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
      return;
    }
    
    if (e.cancelable) e.preventDefault();
    
    const touch = e.touches[0];
    checkAutoScroll(touch.clientY);

    // Identify target element under finger
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = targetEl?.closest('[data-row-id]');
    
    if (rowEl) {
      const targetId = rowEl.getAttribute('data-row-id');
      if (targetId) updateDropTarget(targetId);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const drag = activeDragRef.current;
    if (e.touches.length === 0 && touchRoundRef.current !== null
      && touchGestureGuard.isAllowed(touchRoundRef.current)
      && drag?.mode === 'touch') {
      if (e.cancelable) e.preventDefault();
      touchGestureGuard.markHandled(touchRoundRef.current);
      resetDrag();
      moveColumn(drag.fromId, drag.targetId);
      return;
    }
    cancelTouchDrag();
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    // Remaining fingers indicate an interrupted/multitouch gesture, not a
    // completed single-touch handoff to the browser's native drag lifecycle.
    if (activeDragRef.current?.mode === 'native' && e.touches.length > 0) resetDrag();
    else cancelTouchDrag();
  };
  
  // Cleanup effect
  useEffect(() => {
      return () => {
        clearTouchTracking();
        activeDragRef.current = null;
        cleanupScroll();
      };
  }, []);
  
  return {
    draggingId,
    dropTargetId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
};
