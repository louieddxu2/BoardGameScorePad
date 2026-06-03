import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';
import { ConfirmationProvider } from '../../hooks/useConfirm';
import { ToastProvider } from '../../hooks/useToast';
import { LanguageProvider } from '../../i18n';
import { GameSession, GameTemplate } from '../../types';

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

describe('SessionView toolbox scroll behavior', () => {
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
});
