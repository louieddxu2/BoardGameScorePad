import { useState, useRef } from 'react';
import { GameTemplate } from '../../../types';

interface DragAndDropProps {
  template: GameTemplate;
  onUpdateTemplate: (template: GameTemplate) => void;
}

export const useColumnDragAndDrop = ({ template, onUpdateTemplate }: DragAndDropProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number>(0);
  const isDraggingRef = useRef(false);

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

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggingId(colId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggingId !== colId) setDropTargetId(colId);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggingId && draggingId !== colId) moveColumn(draggingId, colId);
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleTouchStart = (e: React.TouchEvent, colId: string) => {
    touchStartY.current = e.touches[0].clientY;
    isDraggingRef.current = false;
    
    longPressTimer.current = setTimeout(() => {
      setDraggingId(colId);
      isDraggingRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) {
      if (Math.abs(e.touches[0].clientY - touchStartY.current) > 10) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
      return;
    }
    
    if (e.cancelable) e.preventDefault();
    
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = targetEl?.closest('[data-row-id]');
    
    if (rowEl) {
      const targetId = rowEl.getAttribute('data-row-id');
      if (targetId && targetId !== draggingId) setDropTargetId(targetId);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (isDraggingRef.current && draggingId && dropTargetId) {
      moveColumn(draggingId, dropTargetId);
    }
    setDraggingId(null);
    setDropTargetId(null);
    isDraggingRef.current = false;
  };
  
  return {
    draggingId,
    dropTargetId,
    isDraggingRef,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};
