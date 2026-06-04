import { useState, useEffect, useRef } from 'react';
import { getTouchDistance } from '../utils/ui';

const MOBILE_ZOOM_IGNORE_SELECTOR = '[data-mobile-zoom-ignore="true"]';

const shouldIgnoreMobileZoomEvent = (event: TouchEvent): boolean => {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest(MOBILE_ZOOM_IGNORE_SELECTOR));
};

/**
 * Custom Hook: 封裝行動裝置雙指縮放 (Zoom) 邏輯與 localStorage 狀態同步
 */
export const useMobileZoom = () => {
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const zoomLevelRef = useRef(1.0);
  const touchStartDist = useRef(0);
  const initialZoomRef = useRef(1.0);
  const isZooming = useRef(false);

  useEffect(() => {
    const savedZoom = localStorage.getItem('app_zoom_level');
    if (savedZoom) {
      const z = parseFloat(savedZoom);
      setZoomLevel(z);
      zoomLevelRef.current = z;
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * zoomLevel}px`;
    localStorage.setItem('app_zoom_level', String(zoomLevel));
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (shouldIgnoreMobileZoomEvent(e)) {
        isZooming.current = false;
        touchStartDist.current = 0;
        return;
      }

      if (e.touches.length === 2) {
        isZooming.current = true;
        e.preventDefault();
        touchStartDist.current = getTouchDistance(e.touches);
        initialZoomRef.current = zoomLevelRef.current;
      } else {
        isZooming.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (shouldIgnoreMobileZoomEvent(e)) {
        isZooming.current = false;
        touchStartDist.current = 0;
        return;
      }

      if (isZooming.current && e.touches.length === 2) {
        e.preventDefault();
        if (touchStartDist.current > 0) {
          const currentDist = getTouchDistance(e.touches);
          const scale = currentDist / touchStartDist.current;
          setZoomLevel(Math.max(0.75, Math.min(1.3, initialZoomRef.current * scale)));
        }
      }
    };

    const handleTouchEnd = () => {
      isZooming.current = false;
      touchStartDist.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  return zoomLevel;
};
