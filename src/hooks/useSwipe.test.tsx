import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipe } from './useSwipe';

const touchEventAt = (x: number, y: number): React.TouchEvent => ({
  targetTouches: [{ clientX: x, clientY: y }],
  cancelable: true,
  preventDefault: vi.fn()
} as unknown as React.TouchEvent);

describe('useSwipe', () => {
  it('recognizes a quick left swipe when movement and release are batched', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }, { minSwipeDistance: 35 }));

    act(() => {
      result.current.onTouchStart(touchEventAt(120, 80));
      result.current.onTouchMove(touchEventAt(60, 80));
      result.current.onTouchEnd();
    });

    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });
});
