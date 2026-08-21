import React, { useRef } from 'react';

export const DEFAULT_TOUCH_ACTION_MOVE_THRESHOLD = 30;

export interface TouchActionHandlers<T extends HTMLElement> {
  onTouchStart: React.TouchEventHandler<T>;
  onTouchMove: React.TouchEventHandler<T>;
  onTouchEnd: React.TouchEventHandler<T>;
  onTouchCancel: React.TouchEventHandler<T>;
  onClick: React.MouseEventHandler<T>;
}

interface UseTouchActionOptions {
  moveThreshold?: number;
}

/**
 * Resolves a tap from its touch sequence and suppresses the compatibility
 * click for that same gesture. A moved touch remains a gesture, not an action.
 */
export const useTouchAction = <T extends HTMLElement>(
  onActivate: (event: React.SyntheticEvent<T>) => void,
  { moveThreshold = DEFAULT_TOUCH_ACTION_MOVE_THRESHOLD }: UseTouchActionOptions = {},
): TouchActionHandlers<T> => {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const touchActivationRef = useRef(false);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  const handleTouchStart: React.TouchEventHandler<T> = (event) => {
    const touch = event.touches[0];
    if (!touch || event.touches.length !== 1) {
      touchStartRef.current = null;
      touchMovedRef.current = true;
      touchActivationRef.current = false;
      return;
    }

    touchActivationRef.current = false;
    touchMovedRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove: React.TouchEventHandler<T> = (event) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || touchMovedRef.current) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > moveThreshold) {
      touchMovedRef.current = true;
    }
  };

  const handleTouchEnd: React.TouchEventHandler<T> = (event) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    const moved = touchMovedRef.current || !start || !touch || (
      Math.max(Math.abs(touch.clientX - start.x), Math.abs(touch.clientY - start.y)) > moveThreshold
    );

    touchStartRef.current = null;
    touchMovedRef.current = false;

    if (moved) return;

    touchActivationRef.current = true;
    if (event.cancelable) event.preventDefault();
    onActivateRef.current(event);
  };

  const handleTouchCancel: React.TouchEventHandler<T> = () => {
    touchStartRef.current = null;
    touchMovedRef.current = false;
    touchActivationRef.current = false;
  };

  const handleClick: React.MouseEventHandler<T> = (event) => {
    const nativeEvent = event.nativeEvent as MouseEvent & {
      sourceCapabilities?: { firesTouchEvents?: boolean } | null;
    };
    const isTouchCompatibilityClick = nativeEvent.sourceCapabilities?.firesTouchEvents === true
      || (touchActivationRef.current && event.detail > 0);

    if (touchActivationRef.current && isTouchCompatibilityClick) {
      touchActivationRef.current = false;
      return;
    }

    touchActivationRef.current = false;
    onActivateRef.current(event);
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    onClick: handleClick,
  };
};
