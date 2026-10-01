import { useState, useEffect, useRef } from 'react';
import { getTouchDistance } from '../utils/ui';

const MOBILE_ZOOM_IGNORE_SELECTOR = '[data-mobile-zoom-ignore="true"]';

// The App's existing listeners own this record. Buttons only read it: no
// per-button window listeners, React updates or timing-based tap lockouts.
const mobileZoomGesture = { sequence: 0, active: false, suppressClick: false };
export const getMobileZoomGestureState = (): Readonly<typeof mobileZoomGesture> => mobileZoomGesture;

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
    document.documentElement.style.setProperty('--app-zoom-level', String(zoomLevel));
    localStorage.setItem('app_zoom_level', String(zoomLevel));
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    const claimMultitouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        if (!mobileZoomGesture.active) mobileZoomGesture.sequence++;
        mobileZoomGesture.active = true;
        mobileZoomGesture.suppressClick = true;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      claimMultitouch(e);
      if (e.touches.length === 1 && !mobileZoomGesture.active) {
        // Only a fresh touch, after all old fingers lifted, rearms input.
        mobileZoomGesture.suppressClick = false;
      }
      if (shouldIgnoreMobileZoomEvent(e)) {
        isZooming.current = false;
        touchStartDist.current = 0;
        return;
      }

      if (e.touches.length === 2) {
        isZooming.current = true;
        if (e.cancelable) e.preventDefault();
        touchStartDist.current = getTouchDistance(e.touches);
        initialZoomRef.current = zoomLevelRef.current;
      } else if (!mobileZoomGesture.active) {
        isZooming.current = false;
        touchStartDist.current = 0;
      } else {
        touchStartDist.current = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      claimMultitouch(e);
      if (shouldIgnoreMobileZoomEvent(e)) {
        isZooming.current = false;
        touchStartDist.current = 0;
        return;
      }

      if (isZooming.current) {
        // The remaining single finger still belongs to the pinch gesture.
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 2 && touchStartDist.current > 0) {
          const currentDist = getTouchDistance(e.touches);
          const scale = currentDist / touchStartDist.current;
          setZoomLevel(Math.max(0.75, Math.min(1.3, initialZoomRef.current * scale)));
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (mobileZoomGesture.active && isZooming.current && !shouldIgnoreMobileZoomEvent(e) && e.cancelable) {
        e.preventDefault();
      }
      if (e.touches.length === 0) {
        mobileZoomGesture.active = false;
        isZooming.current = false;
        touchStartDist.current = 0;
      } else if (e.touches.length !== 2) {
        touchStartDist.current = 0;
      }
    };

    // Capture sees both targets before React's button handlers, including the
    // final lift whose local handler may stop bubbling to the window.
    const listenerOptions = { passive: false, capture: true };
    window.addEventListener('touchstart', handleTouchStart, listenerOptions);
    window.addEventListener('touchmove', handleTouchMove, listenerOptions);
    window.addEventListener('touchend', handleTouchEnd, listenerOptions);
    window.addEventListener('touchcancel', handleTouchEnd, listenerOptions);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, listenerOptions);
      window.removeEventListener('touchmove', handleTouchMove, listenerOptions);
      window.removeEventListener('touchend', handleTouchEnd, listenerOptions);
      window.removeEventListener('touchcancel', handleTouchEnd, listenerOptions);
      mobileZoomGesture.active = false;
      mobileZoomGesture.suppressClick = false;
    };
  }, []);

  return zoomLevel;
};
