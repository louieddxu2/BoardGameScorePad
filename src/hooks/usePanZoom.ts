
import { useState, useRef, useCallback, useEffect } from 'react';
import { getTouchDistance } from '../utils/ui';

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface UsePanZoomOptions {
  containerRef: React.RefObject<HTMLElement>;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
}

export const usePanZoom = ({ containerRef, minScale = 0.1, maxScale = 10, initialScale = 1 }: UsePanZoomOptions) => {
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: initialScale });
  
  // Interaction Refs
  const isDragging = useRef(false);
  const lastPanPoint = useRef<{ x: number, y: number } | null>(null);
  const startPinchDist = useRef<number>(0);
  const startPinchScale = useRef<number>(1);

  // --- Global Event Handlers (Attached via useEffect) ---
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        // Pan Logic
        if (isDragging.current && lastPanPoint.current) {
            const dx = clientX - lastPanPoint.current.x;
            const dy = clientY - lastPanPoint.current.y;
            
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastPanPoint.current = { x: clientX, y: clientY };
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        if (isDragging.current) {
            e.preventDefault();
            handleMove(e.clientX, e.clientY);
        }
    };

    const onTouchMove = (e: TouchEvent) => {
        // Pinch Zoom Logic
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent browser zoom
            
            const dist = getTouchDistance(e.touches);
            if (startPinchDist.current > 0) {
                const scaleFactor = dist / startPinchDist.current;
                
                setTransform(prev => {
                    const newScale = Math.max(minScale, Math.min(maxScale, startPinchScale.current * scaleFactor));
                    
                    // Zoom towards center of container
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        const cx = rect.width / 2;
                        const cy = rect.height / 2;
                        
                        // Calculate the point under center in image space using OLD scale/pos
                        const imgX = (cx - prev.x) / prev.scale;
                        const imgY = (cy - prev.y) / prev.scale;
                        
                        // Calculate new position to keep that point under center with NEW scale
                        const newTx = cx - (imgX * newScale);
                        const newTy = cy - (imgY * newScale);
                        
                        return { x: newTx, y: newTy, scale: newScale };
                    }
                    return { ...prev, scale: newScale };
                });
            }
            return;
        }

        if (isDragging.current && e.touches.length === 1) {
            e.preventDefault();
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const onEnd = () => {
        isDragging.current = false;
        lastPanPoint.current = null;
        startPinchDist.current = 0;
    };

    // Attach global listeners to handle dragging outside the container
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
    };
  }, [minScale, maxScale, containerRef]);

  // --- Element Event Handlers (Attached to the interactive element) ---

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Check for standard left click or touch
    if ('button' in e && e.button !== 0) return;
    
    // Stop propagation to prevent conflicts with parent draggables if any
    e.stopPropagation();

    const isTouch = 'touches' in e;
    
    if (isTouch && (e as React.TouchEvent).touches.length === 2) {
        // Pinch Start
        isDragging.current = false;
        startPinchDist.current = getTouchDistance((e as React.TouchEvent).touches);
        // We need current scale here. Using functional state in effect works for updates, 
        // but for *start* we need to capture current. 
        // Since we can't access state in callback without dep, we rely on the state passed to hook if we want to be pure,
        // but `transform.scale` in deps would re-create this handler often.
        // Optimization: Use a ref to track current scale for start events if performance issues arise.
        // For now, adding `transform.scale` to dependency is acceptable.
        setTransform(prev => {
            startPinchScale.current = prev.scale;
            return prev;
        });
        return;
    }

    // Pan Start
    isDragging.current = true;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    lastPanPoint.current = { x: clientX, y: clientY };
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    // Note: e.preventDefault() is not allowed in passive event listeners (React wheel is passive by default)
    // You should use CSS `touch-action: none` on the container to prevent browser scrolling.

    const scaleChange = -e.deltaY * 0.001;
    
    setTransform(prev => {
        const newScale = Math.max(minScale, Math.min(maxScale, prev.scale * (1 + scaleChange)));
        
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const imgX = (mouseX - prev.x) / prev.scale;
            const imgY = (mouseY - prev.y) / prev.scale;

            const newTx = mouseX - (imgX * newScale);
            const newTy = mouseY - (imgY * newScale);

            return { x: newTx, y: newTy, scale: newScale };
        }
        return { ...prev, scale: newScale };
    });
  }, [containerRef, minScale, maxScale]);

  const fitToScreen = useCallback((contentWidth: number, contentHeight: number, padding = 40) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scale = Math.min((rect.width - padding) / contentWidth, (rect.height - padding) / contentHeight);
    const x = (rect.width - contentWidth * scale) / 2;
    const y = (rect.height - contentHeight * scale) / 2;

    setTransform({ x, y, scale: scale || 1 });
  }, [containerRef]);

  return {
    transform,
    setTransform,
    panZoomHandlers: {
      onMouseDown: onPointerDown,
      onTouchStart: onPointerDown,
      onWheel: onWheel
    },
    fitToScreen,
    isDragging
  };
};
