import { useEffect, useRef } from 'react';

interface ToolboxTouchState {
  startX: number;
  startY: number;
  startScrollTop: number;
  minScrollTop: number;
  maxScrollTop: number;
  axis: 'vertical' | 'horizontal' | null;
}

interface UseToolboxBoundaryGestureOptions {
  scrollContainerRef: React.RefObject<HTMLElement>;
  isToolboxOpen: boolean;
  canAutoOpenToolbox: boolean;
  isInputInterfaceOpen: boolean;
  onAutoOpen: () => void;
  onAutoClose: () => void;
}

/**
 * Opens a toolbox when an upward swipe reaches the scroll container's bottom
 * boundary, and closes only a toolbox opened by that gesture at the top
 * boundary. Manual toolbox toggles are deliberately left alone.
 */
export const useToolboxBoundaryGesture = ({
  scrollContainerRef,
  isToolboxOpen,
  canAutoOpenToolbox,
  isInputInterfaceOpen,
  onAutoOpen,
  onAutoClose,
}: UseToolboxBoundaryGestureOptions) => {
  const autoOpenedRef = useRef(false);
  const touchRef = useRef<ToolboxTouchState | null>(null);

  useEffect(() => {
    if (!isToolboxOpen) {
      autoOpenedRef.current = false;
    }
  }, [isToolboxOpen]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return undefined;

    const minVerticalLockDistance = 24;
    const verticalSlopeRatio = 1.5;
    const minTriggerDistance = 48;
    const scrollMovementTolerance = 1;

    const openAutoToolbox = () => {
      if (!canAutoOpenToolbox || isToolboxOpen || isInputInterfaceOpen) return;

      autoOpenedRef.current = true;
      onAutoOpen();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !canAutoOpenToolbox || isInputInterfaceOpen) {
        touchRef.current = null;
        return;
      }

      const touch = event.touches[0];
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startScrollTop: scrollContainer.scrollTop,
        minScrollTop: scrollContainer.scrollTop,
        maxScrollTop: scrollContainer.scrollTop,
        axis: null,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const state = touchRef.current;
      if (!state || event.touches.length !== 1) return;

      state.minScrollTop = Math.min(state.minScrollTop, scrollContainer.scrollTop);
      state.maxScrollTop = Math.max(state.maxScrollTop, scrollContainer.scrollTop);

      const touch = event.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (!state.axis && (absDeltaX >= minVerticalLockDistance || absDeltaY >= minVerticalLockDistance)) {
        state.axis = absDeltaY >= minVerticalLockDistance && absDeltaY >= absDeltaX * verticalSlopeRatio
          ? 'vertical'
          : 'horizontal';
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const state = touchRef.current;
      touchRef.current = null;
      if (!state) return;

      state.maxScrollTop = Math.max(state.maxScrollTop, scrollContainer.scrollTop);
      state.minScrollTop = Math.min(state.minScrollTop, scrollContainer.scrollTop);

      const changedTouch = event.changedTouches[0];
      if (!changedTouch) return;

      const totalDeltaY = changedTouch.clientY - state.startY;
      const fingerMovedUpEnough = totalDeltaY <= -minTriggerDistance;
      const fingerMovedDownEnough = totalDeltaY >= minTriggerDistance;
      const didNotScrollDown = state.maxScrollTop <= state.startScrollTop + scrollMovementTolerance;
      const didNotScrollUp = state.minScrollTop >= state.startScrollTop - scrollMovementTolerance;

      if (state.axis === 'vertical' && fingerMovedUpEnough && didNotScrollDown) {
        openAutoToolbox();
      }

      if (
        state.axis === 'vertical' &&
        fingerMovedDownEnough &&
        didNotScrollUp &&
        autoOpenedRef.current &&
        isToolboxOpen &&
        !isInputInterfaceOpen
      ) {
        autoOpenedRef.current = false;
        onAutoClose();
      }
    };

    const handleScroll = () => {
      if (autoOpenedRef.current && isToolboxOpen && !isInputInterfaceOpen && scrollContainer.scrollTop <= 1) {
        autoOpenedRef.current = false;
        onAutoClose();
      }
    };

    const handleTouchCancel = () => {
      touchRef.current = null;
    };

    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
    scrollContainer.addEventListener('touchend', handleTouchEnd);
    scrollContainer.addEventListener('touchcancel', handleTouchCancel);
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
      scrollContainer.removeEventListener('touchcancel', handleTouchCancel);
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [
    canAutoOpenToolbox,
    isInputInterfaceOpen,
    isToolboxOpen,
    onAutoClose,
    onAutoOpen,
    scrollContainerRef,
  ]);
};
