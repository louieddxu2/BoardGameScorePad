
import React, { useEffect, useRef } from 'react';
import { getTouchDistance } from '../../../utils/ui';
import { DraggedItemInfo, ViewTransform, GridBounds } from '../TextureMapperContext';

const DRAWER_BOUNDARY_X = 128; // From TextureMapper

interface UseTextureMapperInteractionsProps {
    activeLine: { type: 'h' | 'v' | 'bound', index: number, boundType?: 'top'|'bottom'|'left'|'right' } | null;
    transform: ViewTransform;
    draggedItem: DraggedItemInfo | null;
    phase: 'grid' | 'structure';
    isMappingMode: boolean;
    rowCount: number;
    headerSepIdx: number;
    sortedHLines: number[];
    dropTargetRow: number | null;

    setActiveLine: React.Dispatch<React.SetStateAction<{ type: 'h' | 'v' | 'bound', index: number, boundType?: 'top'|'bottom'|'left'|'right' } | null>>;
    setTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
    setHLines: React.Dispatch<React.SetStateAction<number[]>>;
    setVLines: React.Dispatch<React.SetStateAction<number[]>>;
    setDraggedItem: React.Dispatch<React.SetStateAction<DraggedItemInfo | null>>;
    setDropTargetRow: React.Dispatch<React.SetStateAction<number | null>>;
    
    handleDropOnRow: (rowIndex: number, draggedColId: string) => void;

    isDraggingCanvas: React.MutableRefObject<boolean>;
    lastPanPoint: React.MutableRefObject<{ x: number, y: number } | null>;
    startPinchDist: React.MutableRefObject<number>;
    startPinchScale: React.MutableRefObject<number>;
    
    containerRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;

    // New: Bounds support
    gridBounds: GridBounds;
    setGridBounds: React.Dispatch<React.SetStateAction<GridBounds>>;
}

export const useTextureMapperInteractions = ({
    // State
    activeLine, transform, draggedItem, phase, isMappingMode, rowCount, headerSepIdx, sortedHLines, dropTargetRow,
    // Setters
    setActiveLine, setTransform, setHLines, setVLines, setDraggedItem, setDropTargetRow,
    // Handlers
    handleDropOnRow,
    // Interaction Refs
    isDraggingCanvas, lastPanPoint, startPinchDist, startPinchScale,
    // DOM Refs
    containerRef, contentRef,
    // New
    gridBounds, setGridBounds
}: UseTextureMapperInteractionsProps) => {
    
    const stateRef = useRef({ activeLine, transform, draggedItem, gridBounds });
    useEffect(() => {
        stateRef.current = { activeLine, transform, draggedItem, gridBounds };
    }, [activeLine, transform, draggedItem, gridBounds]);
    
    useEffect(() => {
        const handleMove = (clientX: number, clientY: number) => {
            if (stateRef.current.activeLine && contentRef.current) {
                const rect = contentRef.current.getBoundingClientRect();
                const relativeX = (clientX - rect.left) / rect.width * 100;
                const relativeY = (clientY - rect.top) / rect.height * 100;
                const line = stateRef.current.activeLine;
                const bounds = stateRef.current.gridBounds;

                if (line.type === 'bound') {
                    // Handling Bounds Dragging
                    if (line.boundType === 'top') {
                        // Top bound: 0 to Bottom - 5
                        setGridBounds(prev => ({ ...prev, top: Math.max(0, Math.min(prev.bottom - 5, relativeY)) }));
                    } else if (line.boundType === 'bottom') {
                        // Bottom bound: Top + 5 to 100
                        setGridBounds(prev => ({ ...prev, bottom: Math.max(prev.top + 5, Math.min(100, relativeY)) }));
                    } else if (line.boundType === 'left') {
                        // Left bound: 0 to Right - 5
                        setGridBounds(prev => ({ ...prev, left: Math.max(0, Math.min(prev.right - 5, relativeX)) }));
                    } else if (line.boundType === 'right') {
                        // Right bound: Left + 5 to 100
                        setGridBounds(prev => ({ ...prev, right: Math.max(prev.left + 5, Math.min(100, relativeX)) }));
                    }
                } else if (line.type === 'h') {
                    // Horizontal lines must stay within bounds
                    setHLines(prev => prev.map((val, i) => {
                        if (i === line.index) {
                            return Math.max(bounds.top, Math.min(bounds.bottom, relativeY));
                        }
                        return val;
                    }));
                } else {
                    // Vertical lines (Data Column Separators) must stay between Left and Right bounds
                    setVLines(prev => {
                        const newV = [...prev];
                        let val = Math.max(bounds.left, Math.min(bounds.right, relativeX));
                        
                        // Maintain order of V lines
                        if (line.index === 0) val = Math.min(val, newV[1] - 2);
                        else val = Math.max(val, newV[0] + 2);
                        
                        // Ensure it respects bounds
                        val = Math.max(bounds.left, Math.min(bounds.right, val));
                        
                        newV[line.index] = val;
                        return newV;
                    });
                }
            } else if (isDraggingCanvas.current && lastPanPoint.current) {
                const dx = clientX - lastPanPoint.current.x;
                const dy = clientY - lastPanPoint.current.y;
                setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
                lastPanPoint.current = { x: clientX, y: clientY };
            } else if (stateRef.current.draggedItem) {
                setDraggedItem(prev => prev ? { ...prev, x: clientX, y: clientY } : null);

                if (clientX < DRAWER_BOUNDARY_X) {
                    setDropTargetRow(null);
                    return;
                }

                if (contentRef.current && phase === 'structure' && isMappingMode) {
                    const rect = contentRef.current.getBoundingClientRect();
                    const relativeY = (clientY - rect.top) / rect.height * 100;
                    let foundRow = -1;
                    // Note: sortedHLines already includes gridBounds.top and gridBounds.bottom
                    for (let i = 0; i < rowCount; i++) {
                        const rowIdx = headerSepIdx + i;
                        const top = sortedHLines[rowIdx];
                        const bottom = sortedHLines[rowIdx + 1];
                        if (relativeY >= top && relativeY < bottom) {
                            foundRow = i;
                            break;
                        }
                    }
                    setDropTargetRow(foundRow !== -1 ? foundRow : null);
                } else {
                    setDropTargetRow(null);
                }
            }
        };

        const onMouseMove = (e: MouseEvent) => { if (stateRef.current.activeLine || isDraggingCanvas.current || stateRef.current.draggedItem) e.preventDefault(); handleMove(e.clientX, e.clientY); };
        const onTouchMove = (e: TouchEvent) => {
            if (stateRef.current.activeLine || isDraggingCanvas.current || e.touches.length === 2 || stateRef.current.draggedItem) e.preventDefault();
            if (e.touches.length === 2) {
                const dist = getTouchDistance(e.touches);
                if (startPinchDist.current > 0) {
                    const scaleFactor = dist / startPinchDist.current;
                    const { scale, x, y } = stateRef.current.transform;
                    const newScale = Math.max(0.1, Math.min(5, startPinchScale.current * scaleFactor));
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        const cx = rect.width / 2; const cy = rect.height / 2;
                        const imgX = (cx - x) / scale; const imgY = (cy - y) / scale;
                        const newTx = cx - (imgX * newScale); const newTy = cy - (imgY * newScale);
                        setTransform({ x: newTx, y: newTy, scale: newScale });
                    }
                }
            } else if (e.touches.length === 1) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        const onEnd = (e: MouseEvent | TouchEvent) => {
            const touch = ('changedTouches' in e && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
            const finalClientX = touch ? touch.clientX : (e as MouseEvent).clientX;

            if (stateRef.current.draggedItem && dropTargetRow !== null && finalClientX > DRAWER_BOUNDARY_X) {
                handleDropOnRow(dropTargetRow, stateRef.current.draggedItem.colId);
            }
            setDraggedItem(null);
            setDropTargetRow(null);
            setActiveLine(null);
            isDraggingCanvas.current = false;
            lastPanPoint.current = null;
            startPinchDist.current = 0;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchcancel', onEnd);
        return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onEnd); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onEnd); window.removeEventListener('touchcancel', onEnd); };
    }, [dropTargetRow, isMappingMode, phase, rowCount, headerSepIdx, sortedHLines, containerRef, contentRef, handleDropOnRow, setActiveLine, setDraggedItem, setDropTargetRow, setHLines, setTransform, setVLines, isDraggingCanvas, lastPanPoint, startPinchDist, startPinchScale, setGridBounds]);
};
