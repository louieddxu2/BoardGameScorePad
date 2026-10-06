import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../i18n';
import { ToastProvider } from '../../hooks/useToast';
import { _resetActiveCountForTesting } from '../../hooks/useModalBackHandler';
import { HistoryRecord } from '../../types';
import HistoryReviewView from './HistoryReviewView';

vi.mock('../../hooks/useAppData', () => ({
  useAppData: () => ({ savedLocations: [], updateSavedLocation: vi.fn(), saveTemplate: vi.fn() }),
}));
vi.mock('../../hooks/useGoogleDrive', () => ({
  useGoogleDrive: () => ({ downloadCloudImage: vi.fn(), isAutoConnectEnabled: false, isConnected: false }),
}));
vi.mock('../../hooks/usePhotoManager', () => ({
  usePhotoManager: () => ({
    photoInputRef: React.createRef<HTMLInputElement>(),
    galleryInputRef: React.createRef<HTMLInputElement>(),
    isCameraOpen: false,
  }),
}));
vi.mock('../session/parts/ScoreGrid', () => ({
  default: ({ scrollContainerRef, onToggleToolbox }: {
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    onToggleToolbox: () => void;
  }) => (
    <div ref={scrollContainerRef} data-testid="history-score-grid">
      <button onClick={onToggleToolbox}>Toggle toolbox</button>
    </div>
  ),
}));
vi.mock('../session/parts/TotalsBar', () => ({ default: () => null }));
vi.mock('../session/parts/SmartSpacer', () => ({
  default: ({ onScreenshot, onMemoFocusChange }: {
    onScreenshot: () => void;
    onMemoFocusChange: (focused: boolean) => void;
  }) => (
    <>
      <button onClick={onScreenshot}>Capture scores</button>
      <textarea aria-label="Toolbox memo" onFocus={() => onMemoFocusChange(true)} onBlur={() => onMemoFocusChange(false)} />
    </>
  ),
}));
vi.mock('../session/modals/ScreenshotModal', async () => {
  const { useModalBackHandler } = await import('../../hooks/useModalBackHandler');
  return {
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
      useModalBackHandler(isOpen, onClose, 'screenshot');
      return isOpen ? <div>Screenshot preview</div> : null;
    },
  };
});
vi.mock('../session/modals/PhotoGalleryModal', () => ({ default: () => null }));
vi.mock('./modals/HistorySettingsModal', () => ({ default: () => null }));
vi.mock('./HistoryPhotoStrip', () => ({ default: () => null }));

const makeRecord = (columnCount = 6): HistoryRecord => ({
  id: 'history-toolbox-test',
  templateId: 'toolbox-template',
  gameName: 'Toolbox test',
  startTime: 1,
  endTime: 2,
  players: [],
  winnerIds: [],
  snapshotTemplate: {
    id: 'toolbox-template',
    name: 'Toolbox test',
    createdAt: 1,
    columns: Array.from({ length: columnCount }, (_, index) => ({
      id: `column-${index}`, name: `Column ${index}`, formula: 'a1', inputType: 'keypad', isScoring: true,
    })),
  },
});

describe('HistoryReviewView toolbox browser history', () => {
  let entries: unknown[];
  let historyIndex: number;

  beforeEach(() => {
    vi.useFakeTimers();
    _resetActiveCountForTesting();
    entries = [{ page: 'history-list' }];
    historyIndex = 0;
    vi.spyOn(window.history, 'pushState').mockImplementation(state => {
      entries.splice(historyIndex + 1);
      entries.push(state);
      historyIndex += 1;
    });
    vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.setTimeout(() => {
        historyIndex = Math.max(0, historyIndex - 1);
        window.dispatchEvent(new PopStateEvent('popstate', { state: entries[historyIndex] }));
      }, 0);
    });
  });

  afterEach(() => {
    cleanup();
    vi.runAllTimers();
    _resetActiveCountForTesting();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderReview = (record = makeRecord()) => {
    const onExit = vi.fn();
    render(
      <LanguageProvider><ToastProvider>
        <HistoryReviewView record={record} onExit={onExit} zoomLevel={1} />
      </ToastProvider></LanguageProvider>,
    );
    act(() => { vi.advanceTimersByTime(300); });
    const scroller = screen.getByTestId('history-score-grid');
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, writable: true, value: 700 },
    });
    return { onExit, scroller };
  };

  const toolbox = () => document.querySelector('[data-history-toolbox="true"]');
  const toggleToolbox = () => fireEvent.click(screen.getByRole('button', { name: 'Toggle toolbox' }));
  const openToolbox = (source: 'button' | 'swipe', scroller: HTMLElement) => {
    if (source === 'button') toggleToolbox();
    else {
      fireEvent.touchStart(scroller, { touches: [{ clientX: 120, clientY: 200 }] });
      fireEvent.touchMove(scroller, { touches: [{ clientX: 120, clientY: 130 }] });
      fireEvent.touchEnd(scroller, { changedTouches: [{ clientX: 120, clientY: 130 }], touches: [] });
    }
  };
  const browserBack = () => {
    act(() => {
      historyIndex -= 1;
      window.dispatchEvent(new PopStateEvent('popstate', { state: entries[historyIndex] }));
    });
  };

  it.each(['button', 'swipe'] as const)('adds one toolbox entry for %s and handles immediate Back without exiting the review', source => {
    const { onExit, scroller } = renderReview();
    openToolbox(source, scroller);

    expect(toolbox()).toHaveClass('translate-y-0');
    expect(entries).toEqual([
      { page: 'history-list' }, { modal: 'history-root' }, { modal: 'history-toolbox' },
    ]);

    browserBack();

    expect(toolbox()).toHaveClass('translate-y-full');
    expect(onExit).not.toHaveBeenCalled();
    expect(window.history.back).not.toHaveBeenCalled();
    expect((window as any).__modalStack).toEqual(['history-root']);
    expect(historyIndex).toBe(1);
  });

  it.each(['button', 'top-scroll'] as const)('consumes only the toolbox entry when closed by %s', async source => {
    const { onExit, scroller } = renderReview();
    openToolbox('swipe', scroller);
    if (source === 'button') toggleToolbox();
    else {
      scroller.scrollTop = 0;
      fireEvent.scroll(scroller);
    }

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(toolbox()).toHaveClass('translate-y-full');
    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
    expect(historyIndex).toBe(1);
    expect((window as any).__modalStack).toEqual(['history-root']);
  });

  it('preserves the reopened toolbox after its previous asynchronous close', async () => {
    renderReview();
    toggleToolbox();
    toggleToolbox();
    toggleToolbox();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersToNextTimerAsync();
    });

    expect(toolbox()).toHaveClass('translate-y-0');
    expect(entries).toEqual([
      { page: 'history-list' }, { modal: 'history-root' }, { modal: 'history-toolbox' },
    ]);
    expect(historyIndex).toBe(2);
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  it('closes screenshot preview before the toolbox without consuming the review root', async () => {
    const { onExit } = renderReview();
    toggleToolbox();
    fireEvent.click(screen.getByRole('button', { name: 'Capture scores' }));
    act(() => { vi.advanceTimersByTime(300); });

    expect(entries[entries.length - 1]).toEqual({ modal: 'screenshot' });
    browserBack();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.queryByText('Screenshot preview')).not.toBeInTheDocument();
    expect(toolbox()).toHaveClass('translate-y-0');
    expect(historyIndex).toBe(2);

    browserBack();

    expect(toolbox()).toHaveClass('translate-y-full');
    expect(onExit).not.toHaveBeenCalled();
    expect(historyIndex).toBe(1);
    expect(window.history.back).not.toHaveBeenCalled();
  });

  it('keeps the short-board default toolbox out of browser history', () => {
    const { onExit } = renderReview(makeRecord(2));

    expect(toolbox()).toHaveClass('translate-y-0');
    expect(entries).toEqual([{ page: 'history-list' }, { modal: 'history-root' }]);

    browserBack();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(historyIndex).toBe(0);
  });

  it('blurs the toolbox memo when browser Back closes the drawer', () => {
    renderReview();
    toggleToolbox();
    const memo = screen.getByRole('textbox', { name: 'Toolbox memo' });
    act(() => memo.focus());
    expect(memo).toHaveFocus();

    browserBack();

    expect(memo).not.toHaveFocus();
    expect(toolbox()).toHaveClass('translate-y-full');
  });
});
