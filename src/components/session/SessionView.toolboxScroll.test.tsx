import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';
import { ConfirmationProvider } from '../../hooks/useConfirm';
import { ToastProvider } from '../../hooks/useToast';
import { LanguageProvider } from '../../i18n';
import { GameSession, GameTemplate } from '../../types';
import { createMultiplayerSessionManager } from '../../features/multiplayer/multiplayerSessionManager';
import { createPlayerSessionCapabilities } from '../../features/multiplayer/sessionCapabilities';
import { useMobileZoom } from '../../hooks/useMobileZoom';
import { _resetActiveCountForTesting } from '../../hooks/useModalBackHandler';

vi.mock('../../features/ai-generator/hooks/useAiGenerator', () => ({
  useAiGenerator: () => ({
    status: 'idle',
    reset: vi.fn(),
  }),
}));

vi.mock('../../features/ai-generator/hooks/useAiSimpleGenerator', () => ({
  useAiSimpleGenerator: () => ({
    simpleStatus: 'idle',
    flashStatus: 'idle',
    gemmaStatus: 'idle',
    resetSimple: vi.fn(),
  }),
}));

vi.mock('./hooks/useSessionMedia', async () => {
  const React = await import('react');
  return {
    useSessionMedia: () => ({
      fileInputRef: React.createRef<HTMLInputElement>(),
      photoInputRef: React.createRef<HTMLInputElement>(),
      galleryInputRef: React.createRef<HTMLInputElement>(),
      isCameraOpen: false,
      isConnected: false,
      handlePhotoSelect: vi.fn(),
      handleCameraBatchCapture: vi.fn(),
      closeCamera: vi.fn(),
      openPhotoLibrary: vi.fn(),
      openCamera: vi.fn(),
      openScoreCamera: vi.fn(),
      openScannerCamera: vi.fn(),
      openBackgroundUpload: vi.fn(),
      handleCloudDownload: vi.fn(),
      handleFileUpload: vi.fn(),
      handleScannerConfirm: vi.fn(),
      handleDeletePhoto: vi.fn(),
      handleRemoveBackground: vi.fn(),
    }),
  };
});

vi.mock('../history/HistoryPhotoStrip', () => ({
  default: ({ photoIds, onPhotoClick }: { photoIds: string[]; onPhotoClick: (id: string) => void }) => (
    <button type="button" aria-label="session-photo-strip" onClick={() => onPhotoClick(photoIds[0])}>
      {photoIds.join(',')}
    </button>
  ),
}));

vi.mock('./modals/PhotoGalleryModal', () => ({
  default: ({ isOpen, initialPhotoId, entryMode }: { isOpen: boolean; initialPhotoId?: string | null; entryMode?: string }) => (
    isOpen ? <div data-testid="photo-gallery-entry">{initialPhotoId}:{entryMode}</div> : null
  ),
}));

const makeTemplate = (): GameTemplate => ({
  id: 'template-1',
  name: 'Scroll Test',
  description: '',
  columns: Array.from({ length: 6 }, (_, index) => ({
    id: `col-${index + 1}`,
    name: `Column ${index + 1}`,
    formula: 'a1',
    inputType: 'keypad',
    isScoring: true,
    rounding: 'none',
  })),
  createdAt: 1,
  updatedAt: 1,
  defaultScoringRule: 'HIGHEST_WINS',
});

const makeSession = (): GameSession => ({
  id: 'session-1',
  templateId: 'template-1',
  name: 'Scroll Test',
  startTime: 1,
  status: 'active',
  scoringRule: 'HIGHEST_WINS',
  winnerIds: [],
  players: [
    { id: 'p1', name: 'Player 1', color: '#ef4444', scores: {}, totalScore: 0 },
    { id: 'p2', name: 'Player 2', color: '#3b82f6', scores: {}, totalScore: 0 },
  ],
});

const renderSession = (overrides: Partial<React.ComponentProps<typeof SessionView>> = {}) => {
  const template = makeTemplate();
  const session = makeSession();

  return render(
    <LanguageProvider>
      <ToastProvider>
        <ConfirmationProvider>
          <SessionView
            session={session}
            template={template}
            savedPlayers={[]}
            savedLocations={[]}
            zoomLevel={1}
            baseImage={null}
            onUpdateSession={vi.fn()}
            onUpdateTemplate={vi.fn()}
            onUpdateSavedPlayer={vi.fn()}
            onUpdateImage={vi.fn()}
            onExit={vi.fn()}
            onResetScores={vi.fn()}
            onSaveToHistory={vi.fn()}
            onDiscard={vi.fn()}
            {...overrides}
          />
        </ConfirmationProvider>
      </ToastProvider>
    </LanguageProvider>
  );
};

const getGridScroller = () => {
  const content = document.getElementById('live-grid-container');
  const scroller = content?.parentElement as HTMLDivElement | null;
  if (!scroller) throw new Error('grid scroller not found');

  Object.defineProperties(scroller, {
    clientHeight: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 1000 },
  });

  return scroller;
};

const getFirstScoreCell = () => {
  const cell = document.querySelector('#row-col-1 .player-col-p1 > div') as HTMLElement | null;
  if (!cell) throw new Error('first score cell not found');
  return cell;
};

const getInputPanel = () => {
  const button = screen.getByRole('button', { name: '1' });
  const panel = button.closest('[data-session-input-panel="true"]') as HTMLElement | null;
  if (!panel) throw new Error('input panel not found');
  return panel;
};

const getScoreCell = (playerId: string) => {
  const cell = document.querySelector(`#row-col-1 .player-col-${playerId} > div`) as HTMLElement | null;
  if (!cell) throw new Error(`score cell not found for ${playerId}`);
  return cell;
};

const setScrollTop = (element: HTMLElement, value: number) => {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 300 },
    scrollHeight: { configurable: true, value: 1000 },
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value,
  });
};

const scrollTo = (element: HTMLElement, value: number) => {
  act(() => {
    setScrollTop(element, value);
    fireEvent.scroll(element);
  });
};

const swipeOn = (
  element: HTMLElement,
  {
    startX = 120,
    startY,
    endX = startX,
    endY,
    moveScrollTop,
  }: { startX?: number; startY: number; endX?: number; endY: number; moveScrollTop?: number }
) => {
  act(() => {
    fireEvent.touchStart(element, {
      touches: [{ clientX: startX, clientY: startY }],
    });
    if (moveScrollTop !== undefined) {
      setScrollTop(element, moveScrollTop);
    }
    fireEvent.touchMove(element, {
      touches: [{ clientX: endX, clientY: endY }],
    });
    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: endX, clientY: endY }],
    });
  });
};

describe('SessionView toolbox browser history', () => {
  let entries: unknown[];
  let historyIndex: number;

  beforeEach(() => {
    vi.useFakeTimers();
    _resetActiveCountForTesting();
    localStorage.setItem('app_language', 'en');
    entries = [{ page: 'score-sheet' }];
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

  const toggleToolbox = () => {
    const button = document.querySelector('[title="Toggle Toolbox"]') as HTMLButtonElement | null;
    if (!button) throw new Error('toolbox button not found');
    fireEvent.click(button);
  };

  const openToolbox = (source: 'button' | 'swipe') => {
    if (source === 'button') toggleToolbox();
    else {
      const scroller = getGridScroller();
      setScrollTop(scroller, 700);
      swipeOn(scroller, { startY: 200, endY: 130 });
    }
  };

  it.each(['button', 'swipe'] as const)('adds exactly one history entry when opened by %s', source => {
    renderSession();
    openToolbox(source);
    openToolbox('swipe');

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
    expect(entries).toEqual([{ page: 'score-sheet' }, { modal: 'session-toolbox' }]);
    expect(historyIndex).toBe(1);
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
  });

  it.each(['button', 'swipe'] as const)('closes only the toolbox on immediate browser Back after %s opening', source => {
    const onExit = vi.fn();
    renderSession({ onExit });
    openToolbox(source);

    act(() => {
      historyIndex -= 1;
      window.dispatchEvent(new PopStateEvent('popstate', { state: entries[historyIndex] }));
    });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
    expect(window.history.back).not.toHaveBeenCalled();
    expect((window as any).__modalStack).toEqual([]);
    expect(historyIndex).toBe(0);
  });

  it.each(['button', 'top-scroll', 'down-swipe'] as const)('consumes its history entry once when closed by %s', async source => {
    renderSession();
    openToolbox('swipe');
    if (source === 'button') toggleToolbox();
    else {
      const scroller = getGridScroller();
      if (source === 'top-scroll') scrollTo(scroller, 0);
      else {
        setScrollTop(scroller, 0);
        swipeOn(scroller, { startY: 130, endY: 200 });
      }
    }

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect((window as any).__modalStack).toEqual([]);
    expect(historyIndex).toBe(0);
  });

  it.each([0, 250])('waits for a pending close (%i ms) before registering a quickly reopened toolbox', async delay => {
    vi.mocked(window.history.back).mockImplementationOnce(() => {
      window.setTimeout(() => {
        historyIndex = Math.max(0, historyIndex - 1);
        window.dispatchEvent(new PopStateEvent('popstate', { state: entries[historyIndex] }));
      }, delay);
    });
    renderSession();
    openToolbox('button');
    toggleToolbox();
    toggleToolbox();

    if (delay > 100) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(window.history.pushState).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(delay); });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
    expect(entries).toEqual([{ page: 'score-sheet' }, { modal: 'session-toolbox' }]);
    expect(historyIndex).toBe(1);
    expect(window.history.pushState).toHaveBeenCalledTimes(2);
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  it('finishes closing score input before a manual toolbox open adds its history entry', async () => {
    renderSession();
    fireEvent.click(getFirstScoreCell());
    expect(historyIndex).toBe(1);
    expect(entries[historyIndex]).toEqual({ modal: 'session-input-panel' });

    toggleToolbox();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
    expect(entries).toEqual([{ page: 'score-sheet' }, { modal: 'session-toolbox' }]);
    expect(historyIndex).toBe(1);
    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect((window as any).__modalStack).toEqual(['session-toolbox']);
  });

  it('returns from score input to the toolbox before closing the toolbox itself', async () => {
    renderSession();
    openToolbox('button');
    fireEvent.click(getFirstScoreCell());
    act(() => { vi.advanceTimersByTime(300); });

    act(() => {
      historyIndex -= 1;
      window.dispatchEvent(new PopStateEvent('popstate', { state: entries[historyIndex] }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
    expect(historyIndex).toBe(1);

    act(() => {
      historyIndex -= 1;
      window.dispatchEvent(new PopStateEvent('popstate', { state: entries[historyIndex] }));
    });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
    expect(historyIndex).toBe(0);
    expect(window.history.back).not.toHaveBeenCalled();
  });

  it('does not add a toolbox history entry for the short-board default layout', () => {
    const template = { ...makeTemplate(), columns: makeTemplate().columns.slice(0, 2) };
    renderSession({ template });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(historyIndex).toBe(0);
  });
});

describe('SessionView toolbox scroll behavior', () => {
  it('shows session photos in the toolbox and opens a thumbnail directly in the lightbox', () => {
    const session = { ...makeSession(), photos: ['photo-1'] };
    renderSession({ session });
    const toolboxButton = document.querySelector('[title="Toggle Toolbox"]') as HTMLButtonElement | null;
    if (!toolboxButton) throw new Error('toolbox button not found');

    fireEvent.click(toolboxButton);
    fireEvent.click(screen.getByRole('button', { name: 'session-photo-strip' }));

    expect(screen.getByTestId('photo-gallery-entry')).toHaveTextContent('photo-1:direct-lightbox');
  });

  it('anchors the iOS input panel to the same session surface as the collapsed totals bar', () => {
    const previousValue = document.documentElement.dataset.iosBrowser;
    document.documentElement.dataset.iosBrowser = 'true';

    try {
      renderSession();
      fireEvent.click(getFirstScoreCell());

      const surface = document.querySelector('[data-session-surface="true"]');
      expect(surface).toHaveClass('h-full', 'relative', 'overflow-hidden');
      expect(getInputPanel().parentElement).toBe(surface);
      expect(document.getElementById('live-totals-bar')?.parentElement?.closest('.relative, .absolute, .fixed, .sticky')).toBe(surface);
      expect(getInputPanel()).toHaveClass('absolute', 'left-0', 'right-0');
      expect(getInputPanel().style.height).toBe('40vh');
      expect(getInputPanel().style.bottom).toBe('var(--bottom-ui-safe-gap)');
      const bottomFill = document.querySelector('[data-input-panel-bottom-fill="true"]') as HTMLElement;
      expect(bottomFill).toHaveClass('absolute', 'inset-x-0', 'bottom-0', 'z-50', 'bg-input-bg');
      expect(bottomFill).not.toHaveClass('pointer-events-none');
      expect(bottomFill).toHaveAttribute('aria-hidden', 'true');
      expect(bottomFill.style.height).toBe(getInputPanel().style.bottom);
    } finally {
      if (previousValue === undefined) {
        delete document.documentElement.dataset.iosBrowser;
      } else {
        document.documentElement.dataset.iosBrowser = previousValue;
      }
    }
  });

  it('keeps the Android browser input surface above the system navigation area', () => {
    const previousAndroid = document.documentElement.dataset.android;
    const previousStandalone = document.documentElement.dataset.standalone;
    delete document.documentElement.dataset.iosBrowser;
    document.documentElement.dataset.android = 'true';
    document.documentElement.dataset.standalone = 'false';

    try {
      renderSession();
      fireEvent.click(getFirstScoreCell());

      expect(getInputPanel()).toHaveClass('absolute', 'left-0', 'right-0');
      expect(getInputPanel().style.bottom).toBe('var(--app-safe-area-bottom)');
      const bottomFill = document.querySelector('[data-input-panel-bottom-fill="true"]') as HTMLElement;
      expect(bottomFill).toHaveClass('bg-input-bg');
      expect(bottomFill.style.height).toBe(getInputPanel().style.bottom);
    } finally {
      if (previousAndroid === undefined) delete document.documentElement.dataset.android;
      else document.documentElement.dataset.android = previousAndroid;
      if (previousStandalone === undefined) delete document.documentElement.dataset.standalone;
      else document.documentElement.dataset.standalone = previousStandalone;
    }
  });

  it.each([true, false])('keeps standalone PWA input surface behavior unchanged with Android %s', (isAndroid) => {
    const previousAndroid = document.documentElement.dataset.android;
    const previousStandalone = document.documentElement.dataset.standalone;
    delete document.documentElement.dataset.iosBrowser;
    document.documentElement.dataset.android = String(isAndroid);
    document.documentElement.dataset.standalone = 'true';

    try {
      renderSession();
      fireEvent.click(getFirstScoreCell());

      expect(getInputPanel()).toHaveClass('absolute', 'left-0', 'right-0');
      expect(getInputPanel().style.bottom).toBe('var(--bottom-ui-safe-gap)');
      expect(document.querySelector('[data-input-panel-bottom-fill="true"]')).toBeNull();
    } finally {
      if (previousAndroid === undefined) delete document.documentElement.dataset.android;
      else document.documentElement.dataset.android = previousAndroid;
      if (previousStandalone === undefined) delete document.documentElement.dataset.standalone;
      else document.documentElement.dataset.standalone = previousStandalone;
    }
  });

  it('shows the browser bottom fill only while the toolbox is visible without changing its dock', () => {
    const previousStandalone = document.documentElement.dataset.standalone;
    document.documentElement.dataset.standalone = 'false';

    try {
      renderSession();
      expect(document.querySelector('[data-input-panel-bottom-fill="true"]')).toBeNull();
      const toolboxButton = document.querySelector('[title="Toggle Toolbox"]') as HTMLButtonElement;

      fireEvent.click(toolboxButton);

      const panel = document.querySelector('[data-session-input-panel="true"]') as HTMLElement;
      const bottomFill = document.querySelector('[data-input-panel-bottom-fill="true"]') as HTMLElement;
      expect(panel.style.height).toBe('40vh');
      expect(bottomFill).toBeInTheDocument();
      expect(bottomFill.style.height).toBe(panel.style.bottom);
      expect(bottomFill.parentElement).toBe(panel.parentElement);
      expect(bottomFill.querySelector('button, input, textarea')).toBeNull();

      fireEvent.click(toolboxButton);

      expect(document.querySelector('[data-input-panel-bottom-fill="true"]')).toBeNull();
    } finally {
      if (previousStandalone === undefined) delete document.documentElement.dataset.standalone;
      else document.documentElement.dataset.standalone = previousStandalone;
    }
  });

  it('detaches a multiplayer room without stopping its runtime when the view unmounts', () => {
    const manager = createMultiplayerSessionManager();
    const runtime = { role: 'player' as const, stop: vi.fn(), start: vi.fn(), controller: {}, session: {} } as any;
    manager.register('room-1', runtime);
    const { unmount } = renderSession({ multiplayerRoomId: 'room-1', multiplayerManager: manager });
    expect(manager.get('room-1')?.isViewAttached).toBe(true);
    unmount();
    expect(manager.get('room-1')?.isViewAttached).toBe(false);
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it('cycles the multiplayer preview button through each player and back to host', () => {
    renderSession();
    const button = screen.getByRole('button', { name: 'Multiplayer test: host' });

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Multiplayer test: player 1' })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Multiplayer test: player 1' }));
    expect(screen.getByRole('button', { name: 'Multiplayer test: player 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Multiplayer test: player 2' }));
    expect(screen.getByRole('button', { name: 'Multiplayer test: host' })).toBeInTheDocument();
  });

  it('only opens the active participant score cell in multiplayer preview', () => {
    renderSession();
    fireEvent.click(screen.getByRole('button', { name: 'Multiplayer test: host' }));

    fireEvent.click(getScoreCell('p2'));
    expect(getScoreCell('p2').className).not.toContain('ring-2');
    expect(getScoreCell('p2').className).toContain('saturate-[0.78]');

    fireEvent.click(getScoreCell('p1'));
    expect(getScoreCell('p1').className).toContain('ring-2');
  });

  it('keeps immediate swipe navigation and accepts a touch keypad input afterwards', () => {
    const onUpdateSession = vi.fn();
    renderSession({ onUpdateSession });

    fireEvent.click(getFirstScoreCell());
    const panel = getInputPanel();

    fireEvent.touchStart(panel, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchMove(panel, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });

    const keypadButton = screen.getByRole('button', { name: '1' });
    fireEvent.touchStart(keypadButton, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(keypadButton, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });

    const latestCall = onUpdateSession.mock.calls[onUpdateSession.mock.calls.length - 1];
    const latestSession = latestCall?.[0] as GameSession | undefined;
    expect(latestSession?.players.find(player => player.id === 'p1')?.scores['col-1']?.parts ?? []).toEqual([]);
    expect(latestSession?.players.find(player => player.id === 'p2')?.scores['col-1']?.parts).toEqual([1]);
  });

  it('does not turn a vertical-first panel gesture into player navigation', () => {
    const onUpdateSession = vi.fn();
    renderSession({ onUpdateSession });

    fireEvent.click(getFirstScoreCell());
    const panel = getInputPanel();

    fireEvent.touchStart(panel, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchMove(panel, {
      touches: [{ clientX: 202, clientY: 120 }],
    });
    fireEvent.touchMove(panel, {
      touches: [{ clientX: 240, clientY: 120 }],
    });
    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 240, clientY: 120 }],
    });

    expect(getInputPanel().textContent).toContain('Player 1');
  });

  it('does not turn the remaining pinch finger into a player swipe and immediately accepts the next tap', () => {
    renderHook(() => useMobileZoom());
    const onUpdateSession = vi.fn();
    renderSession({ onUpdateSession });
    fireEvent.click(getFirstScoreCell());
    const panel = getInputPanel();
    const outside = getFirstScoreCell();
    const first = { identifier: 1, clientX: 200, clientY: 100 };
    const second = { identifier: 2, clientX: 300, clientY: 100 };
    fireEvent.touchStart(panel, { touches: [first], changedTouches: [first] });
    fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [second] });
    fireEvent.touchEnd(outside, { touches: [first], changedTouches: [second] });
    const moved = { ...first, clientX: 100 };
    fireEvent.touchMove(panel, { touches: [moved], changedTouches: [moved] });
    fireEvent.touchEnd(panel, { touches: [], changedTouches: [moved] });
    expect(getInputPanel().textContent).toContain('Player 1');

    const key = screen.getByRole('button', { name: '1' });
    fireEvent.touchStart(key, { touches: [first], changedTouches: [first] });
    fireEvent.touchEnd(key, { touches: [], changedTouches: [first] });
    const latest = onUpdateSession.mock.calls[onUpdateSession.mock.calls.length - 1]?.[0] as GameSession;
    expect(latest.players.find(player => player.id === 'p1')?.scores['col-1']?.parts).toEqual([1]);
    expect(latest.players.find(player => player.id === 'p2')?.scores['col-1']?.parts ?? []).toEqual([]);
  });

  it('opens a score cell from a touch tap after the grid was scrolled without a compatibility click', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 500);
    fireEvent.touchStart(scroller, {
      touches: [{ clientX: 120, clientY: 200 }],
    });
    setScrollTop(scroller, 560);
    fireEvent.touchMove(scroller, {
      touches: [{ clientX: 120, clientY: 140 }],
    });
    fireEvent.touchEnd(scroller, {
      changedTouches: [{ clientX: 120, clientY: 140 }],
    });

    const cell = getFirstScoreCell();
    fireEvent.touchStart(cell, {
      touches: [{ clientX: 120, clientY: 140 }],
    });
    fireEvent.touchEnd(cell, {
      changedTouches: [{ clientX: 120, clientY: 140 }],
    });

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  });

  it('opens permission settings for both claimed and unclaimed player headers', () => {
    const onRequestPlayerClaim = vi.fn();
    renderSession({
      multiplayerCapabilities: createPlayerSessionCapabilities(['p1']),
      onRequestMultiplayerPlayerClaim: onRequestPlayerClaim,
    });

    fireEvent.click(document.querySelector('[data-player-header-id="p1"]') as HTMLElement);
    fireEvent.click(document.querySelector('[data-player-header-id="p2"]') as HTMLElement);

    expect(onRequestPlayerClaim).toHaveBeenNthCalledWith(1, 'p1');
    expect(onRequestPlayerClaim).toHaveBeenNthCalledWith(2, 'p2');
  });

  beforeEach(() => {
    localStorage.setItem('app_language', 'en');
  });

  it('opens the toolbox when an upward swipe cannot move the score grid down', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 700);
    swipeOn(scroller, { startY: 200, endY: 130 });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
  });

  it('does not open if the upward swipe successfully scrolls the score grid down', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 500);
    swipeOn(scroller, { startY: 200, endY: 130, moveScrollTop: 530 });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('requires a separate upward swipe after the score grid reaches the bottom', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 500);
    swipeOn(scroller, { startY: 200, endY: 130, moveScrollTop: 700 });
    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();

    swipeOn(scroller, { startY: 200, endY: 130 });
    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
  });

  it('does not open for horizontal or shallow diagonal swipes', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 700);
    swipeOn(scroller, { startX: 200, startY: 200, endX: 80, endY: 150 });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('does not auto-open while the score input panel is open', () => {
    renderSession();
    const scroller = getGridScroller();

    fireEvent.click(getFirstScoreCell());
    setScrollTop(scroller, 700);
    swipeOn(scroller, { startY: 200, endY: 130 });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('does not open when the same gesture happens outside the score grid', () => {
    renderSession();

    swipeOn(document.body, { startY: 200, endY: 130 });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('closes an auto-opened toolbox after scrolling back to the top', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 700);
    swipeOn(scroller, { startY: 200, endY: 130 });
    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();

    scrollTo(scroller, 0);

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('closes an auto-opened toolbox when a downward swipe cannot move the score grid up', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 700);
    swipeOn(scroller, { startY: 200, endY: 130 });
    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();

    setScrollTop(scroller, 0);
    swipeOn(scroller, { startY: 130, endY: 200 });

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('does not close a manually opened toolbox from a top-boundary downward swipe', () => {
    renderSession();
    const scroller = getGridScroller();

    const toolboxButton = document.querySelector('[title="Toggle Toolbox"]') as HTMLButtonElement | null;
    if (!toolboxButton) throw new Error('toolbox button not found');

    fireEvent.click(toolboxButton);
    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();

    setScrollTop(scroller, 0);
    swipeOn(scroller, { startY: 130, endY: 200 });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
  });

  it('does not close an auto-opened toolbox if the downward swipe successfully scrolls the score grid up', () => {
    renderSession();
    const scroller = getGridScroller();

    setScrollTop(scroller, 700);
    swipeOn(scroller, { startY: 200, endY: 130 });
    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();

    setScrollTop(scroller, 100);
    swipeOn(scroller, { startY: 130, endY: 200, moveScrollTop: 70 });

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
  });

  it('moves the toolbox above the virtual keyboard while its memo is focused', () => {
    renderSession();
    const toolboxButton = document.querySelector('[title="Toggle Toolbox"]') as HTMLButtonElement | null;
    if (!toolboxButton || !window.visualViewport) throw new Error('toolbox or visual viewport unavailable');

    fireEvent.click(toolboxButton);
    const textarea = screen.getByRole('textbox');
    const panel = document.querySelector('[data-session-input-panel="true"]') as HTMLElement;
    const viewport = window.visualViewport as VisualViewport & { height: number; offsetTop: number };
    const originalHeight = viewport.height;
    const originalOffsetTop = viewport.offsetTop;
    const layoutHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);

    try {
      fireEvent.focus(textarea);
      act(() => {
        viewport.height = layoutHeight - 260;
        viewport.offsetTop = 0;
        viewport.dispatchEvent(new Event('resize'));
      });

      expect(panel.style.bottom).toBe('260px');
      const bottomFill = document.querySelector('[data-input-panel-bottom-fill="true"]') as HTMLElement;
      expect(bottomFill.style.height).toBe('260px');

      act(() => {
        viewport.offsetTop = 40;
        viewport.dispatchEvent(new Event('scroll'));
      });
      expect(panel.style.bottom).toBe('260px');
      expect(bottomFill.style.height).toBe('260px');

      fireEvent.blur(textarea);
      expect(panel.style.bottom).toBe('var(--bottom-ui-safe-gap)');
      expect(bottomFill.style.height).toBe(panel.style.bottom);
    } finally {
      act(() => {
        viewport.height = originalHeight;
        viewport.offsetTop = originalOffsetTop;
        viewport.dispatchEvent(new Event('resize'));
      });
    }
  });
});
