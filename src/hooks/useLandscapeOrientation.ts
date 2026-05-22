import { useState, useEffect } from 'react';

/**
 * Custom Hook: 監聽行動裝置的螢幕旋轉狀態，當處於橫向 (Landscape) 時返回 true
 */
export const useLandscapeOrientation = () => {
  const [showLandscapeOverlay, setShowLandscapeOverlay] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // 1. Only enforce on Touch Devices (Mobile/Tablet)
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

      // 2. Allow large screens (Tablets/Desktops) to rotate freely
      const smallestDimension = Math.min(window.innerWidth, window.innerHeight);
      const isTabletOrDesktop = smallestDimension >= 600;

      if (!isTouchDevice || isTabletOrDesktop) {
        setShowLandscapeOverlay(false);
        return;
      }

      // 3. Use Modern API if available (Screen Orientation)
      if (window.screen && window.screen.orientation && window.screen.orientation.type) {
        const type = window.screen.orientation.type;
        const isLandscape = type.includes('landscape');
        setShowLandscapeOverlay(isLandscape);
        return;
      }

      // 4. Fallback for iOS (older versions) which relies on window.orientation
      if (typeof (window as any).orientation === 'number') {
        const orientation = (window as any).orientation;
        setShowLandscapeOverlay(Math.abs(orientation) === 90);
        return;
      }

      // 5. Last Resort: Aspect Ratio Check
      const activeTag = document.activeElement?.tagName;
      const isKeyboardLikelyOpen = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if (isKeyboardLikelyOpen) {
        setShowLandscapeOverlay(false);
      } else {
        setShowLandscapeOverlay(window.innerWidth > window.innerHeight);
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation); // For iOS
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', checkOrientation);
    }

    // Initial Check
    checkOrientation();

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', checkOrientation);
      }
    };
  }, []);

  return showLandscapeOverlay;
};
