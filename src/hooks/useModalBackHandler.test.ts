
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useModalBackHandler, _resetActiveCountForTesting, hasActiveModals } from './useModalBackHandler';

describe('useModalBackHandler', () => {
  beforeEach(() => {
    _resetActiveCountForTesting();
    vi.restoreAllMocks();

    // Mock history and window events
    vi.spyOn(window.history, 'pushState');
    vi.spyOn(window.history, 'back');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should push state when opened and call back when closed via UI', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }) => useModalBackHandler(isOpen, onClose, 'test-modal'),
      { initialProps: { isOpen: true } }
    );

    expect(window.history.pushState).toHaveBeenCalledWith({ modal: 'test-modal' }, '');
    expect(hasActiveModals()).toBe(true);

    // Simulate UI close (set isOpen to false)
    rerender({ isOpen: false });
    expect(window.history.back).toHaveBeenCalled();
    expect(hasActiveModals()).toBe(false);
  });

  it('should handle nested modals and prioritize the top one', async () => {
    vi.useFakeTimers();
    const onCloseBottom = vi.fn();
    const onCloseTop = vi.fn();

    renderHook(
      ({ showTop }) => {
        useModalBackHandler(true, onCloseBottom, 'bottom');
        useModalBackHandler(showTop, onCloseTop, 'top');
      },
      { initialProps: { showTop: true } }
    );

    // 1. Initially activeCount should be true (registration is immediate)
    expect(hasActiveModals()).toBe(true);

    // 2. Wait for guard to finish
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // 3. Simulate Back Button (popstate)
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // ONLY the top modal should have closed!
    expect(onCloseTop).toHaveBeenCalled();
    expect(onCloseBottom).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should handle silent back to prevent double closing', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(
      ({ isOpen }) => useModalBackHandler(isOpen, onClose, 'test'),
      { initialProps: { isOpen: true } }
    );

    // Simulate UI close
    unmount();

    expect((window as any).__silentBack).toBe(true);
  });
});
