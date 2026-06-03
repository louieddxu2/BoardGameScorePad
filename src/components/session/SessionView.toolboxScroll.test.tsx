import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';
import { ConfirmationProvider } from '../../hooks/useConfirm';
import { ToastProvider } from '../../hooks/useToast';
import { LanguageProvider } from '../../i18n';
import { GameSession, GameTemplate } from '../../types';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  private readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn((target: Element) => {
    this.observed.add(target);
  });

  unobserve = vi.fn((target: Element) => {
    this.observed.delete(target);
  });

  disconnect = vi.fn(() => {
    this.observed.clear();
  });

  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);

  trigger(target: Element, isIntersecting: boolean) {
    this.callback([
      {
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
      } as IntersectionObserverEntry,
    ], this as unknown as IntersectionObserver);
  }
}

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

const renderSession = () => {
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

const setScrollTop = (element: HTMLElement, value: number) => {
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

const triggerSentinel = (testId: string) => {
  const target = screen.getByTestId(testId);
  const observer = MockIntersectionObserver.instances.find(instance => instance.observed.has(target));
  if (!observer) throw new Error(`${testId} observer not found`);

  act(() => {
    observer.trigger(target, true);
  });
};

describe('SessionView toolbox scroll behavior', () => {
  beforeEach(() => {
    localStorage.setItem('app_language', 'en');
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('opens the toolbox after reaching the bottom and scrolling upward', () => {
    renderSession();
    const scroller = getGridScroller();

    scrollTo(scroller, 700);
    triggerSentinel('toolbox-bottom-sentinel');
    scrollTo(scroller, 660);

    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();
  });

  it('does not auto-open while the score input panel is open', () => {
    renderSession();
    const scroller = getGridScroller();

    fireEvent.click(getFirstScoreCell());
    scrollTo(scroller, 700);
    triggerSentinel('toolbox-bottom-sentinel');
    scrollTo(scroller, 660);

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });

  it('closes an auto-opened toolbox after scrolling back to the top', () => {
    renderSession();
    const scroller = getGridScroller();

    scrollTo(scroller, 700);
    triggerSentinel('toolbox-bottom-sentinel');
    scrollTo(scroller, 660);
    expect(screen.getByText('Game Toolbox')).toBeInTheDocument();

    scrollTo(scroller, 0);
    triggerSentinel('toolbox-top-sentinel');

    expect(screen.queryByText('Game Toolbox')).not.toBeInTheDocument();
  });
});
