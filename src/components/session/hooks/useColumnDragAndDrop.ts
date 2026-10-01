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
  const isDraggingRef = useRef(false);
  const touchRoundRef = useRef<number | null>(null);
  
  // Auto-scroll logic
  const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupScroll = () => {
      if (scrollInterval.current) {
          clearInterval(scrollInterval.current);
          scrollInterval.current = null;
      }
  };

  const scrollStep = (amount: number) => {
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

  // --- Mouse Drag Handlers ---

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggingId(colId);
    // Set drop target to self initially so indicators show up immediately if needed
    setDropTargetId(colId);
    e.dataTransfer.effectAllowed = "move";
    // Optional: Hide default ghost or set custom one if needed, 
    // but standard behavior is usually fine.
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault(); // Necessary to allow dropping
    
    // We update target even if it is self (to show in-place indicator)
    if (dropTargetId !== colId) {
        setDropTargetId(colId);
    }
    
    checkAutoScroll(e.clientY);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    cleanupScroll();
    if (draggingId && draggingId !== colId) {
        moveColumn(draggingId, colId);
    }
    // State reset is handled in DragEnd to cover all cases (drop outside, cancel, etc.)
  };

  const handleDragEnd = () => {
    cleanupScroll();
    setDraggingId(null);
    setDropTargetId(null);
  };

  // --- Touch Handlers ---

  const cancelTouchDrag = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    cleanupScroll();
    touchRoundRef.current = null;
    isDraggingRef.current = false;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleTouchStart = (e: React.TouchEvent, colId: string) => {
    cancelTouchDrag();
    const round = touchGestureGuard.getState().round;
    if (e.touches.length !== 1 || !touchGestureGuard.isAllowed(round)) return;
    touchRoundRef.current = round;
    touchStartY.current = e.touches[0].clientY;
    isDraggingRef.current = false;
    
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      if (touchRoundRef.current !== round || !touchGestureGuard.isAllowed(round)) return;
      setDraggingId(colId);
      setDropTargetId(colId);
      isDraggingRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || touchRoundRef.current === null
      || !touchGestureGuard.isAllowed(touchRoundRef.current)) {
      cancelTouchDrag();
      return;
    }
    if (!isDraggingRef.current) {
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
      if (targetId) setDropTargetId(targetId);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0 && touchRoundRef.current !== null
      && touchGestureGuard.isAllowed(touchRoundRef.current)
      && isDraggingRef.current && draggingId && dropTargetId) {
      moveColumn(draggingId, dropTargetId);
    }
    cancelTouchDrag();
  };
  
  // Cleanup effect
  useEffect(() => {
      return () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        touchRoundRef.current = null;
        isDraggingRef.current = false;
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
    handleTouchCancel: cancelTouchDrag,
  };
};
