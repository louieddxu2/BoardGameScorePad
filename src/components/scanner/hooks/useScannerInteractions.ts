
import { useState, useRef, useEffect, useCallback } from 'react';
import { calculateParallelogramPoint, findStrongestCorner, snapToEdge, getEdgeAngles } from '../../../utils/scanUtils';
import { ViewTransform } from '../../../hooks/usePanZoom';

interface Point {
  x: number;
  y: number;
}

interface UseScannerInteractionsProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLElement>;
  transform: ViewTransform;
  isSnapping: boolean;
  imageSrc: string | null;
}

export const useScannerInteractions = ({
  canvasRef,
  containerRef,
  transform,
  isSnapping,
  imageSrc
}: UseScannerInteractionsProps) => {
  const [points, setPoints] = useState<Point[]>([]);
  const [activePointIdx, setActivePointIdx] = useState<number | null>(null);
  
  // Feedback UI State
  const [snapType, setSnapType] = useState<'none' | 'corner' | 'line'>('none');
  const [activeAngles, setActiveAngles] = useState<number[]>([]);
  const [geometricGhost, setGeometricGhost] = useState<Point | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<{top: number, left: number} | null>(null);

  // Velocity Tracking for Snapping Logic
  const lastMoveTime = useRef<number>(0);
  const lastMovePos = useRef<{x: number, y: number} | null>(null);

  // State Ref for Event Listeners (to avoid stale closures)
  const stateRef = useRef({ activePointIdx, points, isSnapping, transform });
  
  useEffect(() => {
      stateRef.current = { activePointIdx, points, isSnapping, transform };
  }, [activePointIdx, points, isSnapping, transform]);

  // Coordinate Conversion
  const screenToImage = useCallback((clientX: number, clientY: number) => {
      const { transform } = stateRef.current;
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const imgX = (relX - transform.x) / transform.scale;
      const imgY = (relY - transform.y) / transform.scale;
      return { x: imgX, y: imgY };
  }, [containerRef]);

  // Core Drag Logic
  const handlePointDrag = useCallback((clientX: number, clientY: number) => {
        if (!canvasRef.current) return;
        const { isSnapping, activePointIdx, points, transform } = stateRef.current;
        const { x, y } = screenToImage(clientX, clientY);

        // Velocity Calc
        const now = Date.now();
        const dt = now - lastMoveTime.current;
        let speed = 100; 
        if (lastMovePos.current && dt > 0) {
            const dist = Math.sqrt(Math.pow(x - lastMovePos.current.x, 2) + Math.pow(y - lastMovePos.current.y, 2));
            speed = dist / dt;
        }
        lastMoveTime.current = now;
        lastMovePos.current = { x, y };

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        const clampedX = Math.max(0, Math.min(x, width));
        const clampedY = Math.max(0, Math.min(y, height));

        let snappedX = clampedX;
        let snappedY = clampedY;
        let currentSnapType: 'none' | 'corner' | 'line' = 'none';
        
        const ctx = canvasRef.current.getContext('2d');

        // Dynamic Snap Radius Logic
        const currentScale = transform.scale;
        const dynamicRadius = Math.max(5, Math.min(30, 25 / currentScale));
        const geoSnapThreshold = Math.max(10, Math.min(50, 40 / currentScale));

        if (isSnapping && ctx && activePointIdx !== null) {
            // 1. Geometric Snap (Parallelogram)
            const geoPoint = calculateParallelogramPoint(points, activePointIdx);
            setGeometricGhost(geoPoint);

            let geoSnapped = false;
            if (geoPoint) {
                const dist = Math.sqrt(Math.pow(clampedX - geoPoint.x, 2) + Math.pow(clampedY - geoPoint.y, 2));
                if (dist < geoSnapThreshold) { 
                    snappedX = geoPoint.x;
                    snappedY = geoPoint.y;
                    geoSnapped = true;
                    currentSnapType = 'corner';
                }
            }

            // 2. Image Feature Snap (Corner / Line)
            if (!geoSnapped) {
                const cornerResult = findStrongestCorner(ctx, clampedX, clampedY, dynamicRadius); 
                if (cornerResult) {
                    snappedX = cornerResult.x;
                    snappedY = cornerResult.y;
                    currentSnapType = 'corner';
                } else if (speed < 0.8) { 
                    const lineSnapResult = snapToEdge(ctx, clampedX, clampedY, dynamicRadius);
                    if (lineSnapResult) {
                        snappedX = lineSnapResult.x;
                        snappedY = lineSnapResult.y;
                        currentSnapType = 'line';
                    }
                }
            }
        } else {
            setGeometricGhost(null);
        }

        // 3. Update Guides
        if (ctx) {
            const currentAngles = getEdgeAngles(ctx, snappedX, snappedY, dynamicRadius); 
            setActiveAngles(currentAngles);
        }

        setSnapType(currentSnapType);
        setPoints(prev => prev.map((p, i) => i === activePointIdx ? { x: snappedX, y: snappedY } : p));
        
        // Update Magnifier Position
        const magOffset = 100;
        let magTop = clientY - magOffset;
        if (magTop < 50) magTop = clientY + magOffset; 
        setMagnifierPos({ top: magTop, left: clientX });
  }, [canvasRef, screenToImage]);

  // Global Event Listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
        const { activePointIdx } = stateRef.current;
        if (activePointIdx !== null) {
            e.preventDefault();
            handlePointDrag(e.clientX, e.clientY);
        }
    };
    
    const onTouchMove = (e: TouchEvent) => {
        const { activePointIdx } = stateRef.current;
        if (activePointIdx !== null) {
            e.preventDefault();
            handlePointDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const onEnd = () => {
        setActivePointIdx(null);
        lastMovePos.current = null;
        setGeometricGhost(null);
        setMagnifierPos(null);
        setActiveAngles([]);
        setSnapType('none');
    };

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
  }, [handlePointDrag]);

  // Handler for point interaction start
  const handlePointStart = useCallback((index: number, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation(); 
      setActivePointIdx(index);
      lastMoveTime.current = Date.now();
      lastMovePos.current = null;
  }, []);

  return {
      points,
      setPoints,
      activePointIdx,
      snapType,
      activeAngles,
      geometricGhost,
      magnifierPos,
      handlePointStart
  };
};
