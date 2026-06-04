import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useMobileZoom } from './useMobileZoom';

const dispatchTouchEvent = (
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend',
  touches: Array<{ clientX: number; clientY: number }>
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: touches,
    configurable: true
  });
  target.dispatchEvent(event);
};

describe('useMobileZoom', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.fontSize = '';
  });

  it('updates app zoom for normal two-finger gestures', () => {
    renderHook(() => useMobileZoom());

    act(() => {
      dispatchTouchEvent(window, 'touchstart', [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 }
      ]);
      dispatchTouchEvent(window, 'touchmove', [
        { clientX: 0, clientY: 0 },
        { clientX: 120, clientY: 0 }
      ]);
    });

    expect(localStorage.getItem('app_zoom_level')).toBe('1.2');
    expect(document.documentElement.style.fontSize).toBe('19.2px');
  });

  it('ignores two-finger gestures that start inside local photo crop editors', () => {
    const cropSurface = document.createElement('div');
    cropSurface.dataset.mobileZoomIgnore = 'true';
    document.body.appendChild(cropSurface);

    renderHook(() => useMobileZoom());

    act(() => {
      dispatchTouchEvent(cropSurface, 'touchstart', [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 }
      ]);
      dispatchTouchEvent(cropSurface, 'touchmove', [
        { clientX: 0, clientY: 0 },
        { clientX: 140, clientY: 0 }
      ]);
    });

    expect(localStorage.getItem('app_zoom_level')).toBe('1');
    expect(document.documentElement.style.fontSize).toBe('16px');
    cropSurface.remove();
  });
});
