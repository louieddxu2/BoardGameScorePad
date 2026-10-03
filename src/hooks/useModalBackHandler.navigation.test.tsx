import { useState } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetActiveCountForTesting, hasActiveModals, useModalBackHandler } from './useModalBackHandler';

describe('immediate modal history navigation', () => {
  beforeEach(() => {
    _resetActiveCountForTesting();
    window.history.replaceState({ page: 'score-sheet' }, '');
  });

  afterEach(async () => {
    cleanup();
    await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
    _resetActiveCountForTesting();
    vi.restoreAllMocks();
  });

  const renderToolbox = () => renderHook(() => {
    const [isOpen, setIsOpen] = useState(false);
    const { triggerClose } = useModalBackHandler(
      isOpen, () => setIsOpen(false), 'toolbox-navigation-test', { immediate: true },
    );
    return { isOpen, setIsOpen, triggerClose };
  });

  it('handles the real asynchronous History API Back without issuing a second Back', async () => {
    const back = vi.spyOn(window.history, 'back');
    const { result } = renderToolbox();
    act(() => result.current.setIsOpen(true));
    expect(window.history.state).toEqual({ modal: 'toolbox-navigation-test' });

    act(() => window.history.back());
    await waitFor(() => expect(result.current.isOpen).toBe(false));

    expect(window.history.state).toEqual({ page: 'score-sheet' });
    expect(hasActiveModals()).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('waits for actual navigation before reopening and silences every listener for the cleanup event', async () => {
    const { result } = renderToolbox();
    act(() => result.current.setIsOpen(true));
    let returned!: Promise<void>;
    act(() => {
      returned = result.current.triggerClose();
      result.current.setIsOpen(false);
    });
    const laterListener = vi.fn(() => Boolean((window as any).__silentBack));
    window.addEventListener('popstate', laterListener);
    try {
      await act(async () => { await returned; });

      expect(laterListener).toHaveReturnedWith(true);
      expect(window.history.state).toEqual({ page: 'score-sheet' });
      expect((window as any).__silentBack).toBe(0);

      act(() => result.current.setIsOpen(true));
      expect(window.history.state).toEqual({ modal: 'toolbox-navigation-test' });
      expect(result.current.isOpen).toBe(true);
    } finally {
      window.removeEventListener('popstate', laterListener);
    }
  });
});
