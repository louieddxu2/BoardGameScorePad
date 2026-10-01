import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMobileZoomGestureState, useMobileZoom } from './useMobileZoom';

const dispatchTouchEvent = (
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: Array<{ clientX: number; clientY: number }>
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: touches,
    configurable: true
  });
  target.dispatchEvent(event);
  return event;
};

describe('useMobileZoom', () => {
  let previousFontSize: string;
  let previousZoomProperty: string;
  let previousSavedZoom: string | null;

  beforeEach(() => {
    previousFontSize = document.documentElement.style.fontSize;
    previousZoomProperty = document.documentElement.style.getPropertyValue('--app-zoom-level');
    previousSavedZoom = localStorage.getItem('app_zoom_level');
    localStorage.removeItem('app_zoom_level');
    document.documentElement.style.fontSize = '';
    document.documentElement.style.removeProperty('--app-zoom-level');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.fontSize = previousFontSize;
    if (previousZoomProperty) document.documentElement.style.setProperty('--app-zoom-level', previousZoomProperty);
    else document.documentElement.style.removeProperty('--app-zoom-level');
    if (previousSavedZoom === null) localStorage.removeItem('app_zoom_level');
    else localStorage.setItem('app_zoom_level', previousSavedZoom);
  });

  it.each([0.75, 1, 1.3])('restores the saved %s zoom to both font size and CSS factor', (zoom) => {
    localStorage.setItem('app_zoom_level', String(zoom));
    const { result } = renderHook(() => useMobileZoom());

    expect(result.current).toBe(zoom);
    expect(document.documentElement.style.fontSize).toBe(`${16 * zoom}px`);
    expect(document.documentElement.style.getPropertyValue('--app-zoom-level')).toBe(String(zoom));
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
    expect(document.documentElement.style.getPropertyValue('--app-zoom-level')).toBe('1.2');
  });

  it('ignores two-finger gestures that start inside local photo crop editors', () => {
    const cropSurface = document.createElement('div');
    cropSurface.dataset.mobileZoomIgnore = 'true';
    document.body.appendChild(cropSurface);

    renderHook(() => useMobileZoom());

    act(() => {
      const start = dispatchTouchEvent(cropSurface, 'touchstart', [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 }
      ]);
      const move = dispatchTouchEvent(cropSurface, 'touchmove', [
        { clientX: 0, clientY: 0 },
        { clientX: 140, clientY: 0 }
      ]);
      expect(start.defaultPrevented).toBe(false);
      expect(move.defaultPrevented).toBe(false);
      expect(getMobileZoomGestureState().active).toBe(true);
      const firstEnd = dispatchTouchEvent(cropSurface, 'touchend', [{ clientX: 0, clientY: 0 }]);
      expect(firstEnd.defaultPrevented).toBe(false);
      expect(getMobileZoomGestureState().active).toBe(true);
      const finalEnd = dispatchTouchEvent(cropSurface, 'touchend', []);
      expect(finalEnd.defaultPrevented).toBe(false);
      expect(getMobileZoomGestureState().active).toBe(false);
    });

    expect(localStorage.getItem('app_zoom_level')).toBe('1');
    expect(document.documentElement.style.fontSize).toBe('16px');
    expect(document.documentElement.style.getPropertyValue('--app-zoom-level')).toBe('1');
    cropSurface.remove();
  });

  it.each(['touchend', 'touchcancel'] as const)('keeps ownership after the first %s until every finger leaves', (ending) => {
    renderHook(() => useMobileZoom());
    const first = { clientX: 0, clientY: 0 };
    const second = { clientX: 100, clientY: 0 };
    const sequenceBefore = getMobileZoomGestureState().sequence;
    act(() => {
      dispatchTouchEvent(window, 'touchstart', [first]);
      dispatchTouchEvent(window, 'touchstart', [first, second]);
      dispatchTouchEvent(window, 'touchmove', [first, { ...second, clientX: 120 }]);
    });
    expect(document.documentElement.style.fontSize).toBe('19.2px');
    expect(getMobileZoomGestureState()).toMatchObject({ sequence: sequenceBefore + 1, active: true, suppressClick: true });

    act(() => { dispatchTouchEvent(window, ending, [first]); });
    expect(getMobileZoomGestureState().active).toBe(true);
    act(() => {
      const residualMove = dispatchTouchEvent(window, 'touchmove', [{ ...first, clientX: 5 }]);
      expect(residualMove.defaultPrevented).toBe(true);
    });
    expect(document.documentElement.style.fontSize).toBe('19.2px');

    act(() => { dispatchTouchEvent(window, ending, []); });
    expect(getMobileZoomGestureState()).toMatchObject({ sequence: sequenceBefore + 1, active: false, suppressClick: true });
    act(() => {
      const newTap = dispatchTouchEvent(window, 'touchstart', [first]);
      expect(newTap.defaultPrevented).toBe(false);
    });
    expect(getMobileZoomGestureState().suppressClick).toBe(true);
    act(() => { dispatchTouchEvent(window, ending, []); });
    expect(getMobileZoomGestureState().suppressClick).toBe(ending === 'touchcancel');
  });

  it('can continue zooming with a replacement finger without releasing gesture ownership', () => {
    renderHook(() => useMobileZoom());
    const first = { clientX: 0, clientY: 0 };
    act(() => {
      dispatchTouchEvent(window, 'touchstart', [first, { clientX: 100, clientY: 0 }]);
      dispatchTouchEvent(window, 'touchmove', [first, { clientX: 120, clientY: 0 }]);
      dispatchTouchEvent(window, 'touchend', [first]);
    });
    const sequence = getMobileZoomGestureState().sequence;
    act(() => {
      dispatchTouchEvent(window, 'touchstart', [first, { clientX: 100, clientY: 0 }]);
      dispatchTouchEvent(window, 'touchmove', [first, { clientX: 150, clientY: 0 }]);
    });
    expect(document.documentElement.style.fontSize).toBe('20.8px');
    expect(getMobileZoomGestureState()).toMatchObject({ sequence, active: true, suppressClick: true });
  });

  it('cleans up capture listeners and ownership on unmount', () => {
    const { unmount } = renderHook(() => useMobileZoom());
    act(() => {
      dispatchTouchEvent(window, 'touchstart', [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }]);
    });
    expect(getMobileZoomGestureState().active).toBe(true);
    const sequence = getMobileZoomGestureState().sequence;
    unmount();
    expect(getMobileZoomGestureState()).toMatchObject({ sequence, active: false, suppressClick: false });
    dispatchTouchEvent(window, 'touchstart', [{ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 }]);
    expect(getMobileZoomGestureState()).toMatchObject({ sequence, active: false, suppressClick: false });
  });
});
