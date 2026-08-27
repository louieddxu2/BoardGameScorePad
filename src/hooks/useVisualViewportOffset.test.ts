import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKeyboardStatus } from './useVisualViewportOffset';

describe('useKeyboardStatus visual viewport compensation', () => {
  it('uses the larger layout viewport when the root reports dynamic viewport height', () => {
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 662,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 844,
    });

    if (!window.visualViewport) throw new Error('visualViewport is unavailable');
    const visualViewport = window.visualViewport as VisualViewport & { height: number; offsetTop: number };
    visualViewport.height = 662;
    visualViewport.offsetTop = 0;

    const { result } = renderHook(() => useKeyboardStatus());

    expect(result.current.offset).toBe(182);

    act(() => {
      visualViewport.height = 844;
      visualViewport.dispatchEvent(new Event('resize'));
    });

    expect(result.current.offset).toBe(0);
  });
});
