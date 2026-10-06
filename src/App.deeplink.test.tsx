import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { GameTemplate } from './types';
import { LanguageProvider } from './i18n';
import { _resetActiveCountForTesting } from './hooks/useModalBackHandler';
import { multiplayerLocalStore } from './features/multiplayer/multiplayerLocalStore';

const hoisted = vi.hoisted(() => {
  const showToast = vi.fn();
  const nativeActivate = vi.fn();
  const getBuiltinTemplateByShortId = vi.fn<(shortId: string) => Promise<GameTemplate | null>>();

  const appData = {
    isDbReady: true,
    currentSession: null,
    activeTemplate: null,
    sessionImage: null,
    sessionPlayerCount: null,
    templates: [],
    userTemplatesCount: 0,
    systemTemplates: [],
    systemTemplatesCount: 0,
    systemOverrides: {},
    gameOptions: [],
    activeSessionIds: [],
    activeSessions: [],
    historyRecords: [],
    historyStatsRecords: [],
    historyCount: 0,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    themeMode: 'dark' as const,
    toggleTheme: vi.fn(),
    newBadgeIds: [],
    pinnedIds: [],
    savedPlayers: [],
    savedLocations: [],
    savedGames: [],
    viewingHistoryRecord: null,
    systemDirtyTime: 0,
    getTemplate: vi.fn(),
    getBuiltinTemplateByShortId,
    getSessionPreview: vi.fn(() => null),
    startSession: vi.fn(),
    resumeSession: vi.fn(async () => false),
    discardSession: vi.fn(),
    clearAllActiveSessions: vi.fn(),
    updateSession: vi.fn(),
    resetSessionScores: vi.fn(),
    exitSession: vi.fn(),
    saveToHistory: vi.fn(),
    updateActiveTemplate: vi.fn(),
    setSessionImage: vi.fn(),
    updateSavedPlayer: vi.fn(),
    saveTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    restoreSystemTemplate: vi.fn(),
    deleteHistoryRecord: vi.fn(),
    viewHistory: vi.fn(),
    saveImage: vi.fn(),
    loadImage: vi.fn(),
    getSystemExportData: vi.fn(),
    importSystemSettings: vi.fn(),
    importSession: vi.fn(),
    importHistoryRecord: vi.fn(),
    importBgStatsData: vi.fn(async () => true),
    clearNewBadges: vi.fn(),
    togglePin: vi.fn(),
  };

  return {
    showToast,
    nativeActivate,
    getBuiltinTemplateByShortId,
    appData
  };
});

vi.mock('./hooks/useToast', () => ({
  useToast: () => ({ showToast: hoisted.showToast })
}));

vi.mock('./hooks/useAppData', () => ({
  useAppData: () => hoisted.appData
}));

vi.mock('./i18n/app', () => ({
  useAppTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('./i18n/integration', () => ({
  useIntegrationTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('./hooks/useAiTemplateShareConfirm', () => ({
  useAiTemplateShareConfirm: () => ({
    captureAiTemplateForSharing: vi.fn()
  })
}));

vi.mock('./services/templateShareService', () => ({
  fetchTemplateFromCloud: vi.fn(async () => null),
}));

vi.mock('./components/dashboard/Dashboard', () => ({
  default: ({ onDirectResume }: { onDirectResume: (id: string) => void }) => <div data-testid="dashboard-view">dashboard
    <button onClick={hoisted.nativeActivate}>Native action</button>
    <button onClick={() => onDirectResume('template-1')}>Resume game</button>
  </div>
}));

vi.mock('./components/editor/TemplateEditor', () => ({
  default: () => <div data-testid="template-editor-view">editor</div>
}));

vi.mock('./components/session/SessionView', () => ({
  default: ({ onOpenMultiplayerRoom }: { onOpenMultiplayerRoom?: () => void }) => (
    <div data-testid="session-view">session
      <button onClick={onOpenMultiplayerRoom}>Multiplayer</button>
    </div>
  ),
}));

vi.mock('./components/history/HistoryReviewView', () => ({
  default: () => <div data-testid="history-view">history</div>
}));

vi.mock('./components/dashboard/modals/GameSetupModal', () => ({
  default: (props: { template: GameTemplate }) => (
    <div data-testid="setup-modal">{props.template?.id}</div>
  )
}));

describe('App deep-link flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('opens setup modal when builtin deep-link is valid and template exists', async () => {
    const template: GameTemplate = {
      id: 'Built-in-Agricola',
      name: 'Agricola',
      columns: [],
      createdAt: Date.now()
    };
    hoisted.getBuiltinTemplateByShortId.mockResolvedValue(template);
    window.location.hash = '#Agricola';

    render(<App />);

    await waitFor(() => {
      expect(hoisted.getBuiltinTemplateByShortId).toHaveBeenCalledWith('Agricola');
      expect(screen.getByTestId('setup-modal')).toHaveTextContent('Built-in-Agricola');
    }, { timeout: 3000 });
    expect(window.location.hash).toBe('');
  });

  it('shows warning and stays on dashboard when builtin template does not exist', async () => {
    hoisted.getBuiltinTemplateByShortId.mockResolvedValue(null);
    window.location.hash = '#NoSuchTemplate';

    render(<App />);

    await waitFor(() => {
      expect(hoisted.getBuiltinTemplateByShortId).toHaveBeenCalledWith('NoSuchTemplate');
      expect(hoisted.showToast).toHaveBeenCalledWith({
        message: 'app_toast_link_template_missing',
        type: 'warning'
      });
    });

    expect(screen.queryByTestId('setup-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

});

describe('App multiplayer modal history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetActiveCountForTesting();
    window.history.replaceState({ page: 'dashboard' }, '', '/');
    localStorage.setItem('app_language', 'en');
    const session = { id: 'session-1', templateId: 'template-1', status: 'active', players: [] };
    Object.assign(hoisted.appData, {
      currentSession: session,
      activeTemplate: { id: 'template-1', name: 'Game', columns: [] },
      activeSessions: [session],
    });
    hoisted.appData.resumeSession.mockResolvedValue(true);
    vi.spyOn(multiplayerLocalStore, 'getRoomBySessionId').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    cleanup();
    await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
    _resetActiveCountForTesting();
    Object.assign(hoisted.appData, { currentSession: null, activeTemplate: null, activeSessions: [] });
    hoisted.appData.resumeSession.mockResolvedValue(false);
    vi.restoreAllMocks();
  });

  it.each(['Cancel', 'Back'] as const)('closes with %s without returning from the score sheet', async (action) => {
    const sessionBack = vi.fn();
    window.addEventListener('app-back-press', sessionBack);
    try {
      render(<LanguageProvider><App /></LanguageProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'Resume game' }));
      await screen.findByTestId('session-view');
      const scoreSheetHistory = window.history.state;
      const back = vi.spyOn(window.history, 'back');
      fireEvent.click(screen.getByRole('button', { name: 'Multiplayer' }));
      expect(window.history.state).toEqual({ modal: 'multiplayer-room' });
      if (action === 'Cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      else act(() => window.history.back());
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(window.history.state).toEqual(scoreSheetHistory));

      expect(back).toHaveBeenCalledTimes(1);
      expect(sessionBack).not.toHaveBeenCalled();
      expect(screen.getByTestId('session-view')).toBeInTheDocument();
    } finally {
      window.removeEventListener('app-back-press', sessionBack);
    }
  });

  it('does not treat modal cleanup as session Back when native listeners have a microtask checkpoint between them', async () => {
    const sessionBack = vi.fn();
    window.addEventListener('app-back-press', sessionBack);
    try {
      render(<LanguageProvider><App /></LanguageProvider>);
      fireEvent.click(screen.getByRole('button', { name: 'Resume game' }));
      await screen.findByTestId('session-view');
      const scoreSheetHistory = window.history.state;
      fireEvent.click(screen.getByRole('button', { name: 'Multiplayer' }));
      const registrations = vi.spyOn(window, 'addEventListener');
      vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      const navigationListener = registrations.mock.calls.find(([name, , options]) =>
        name === 'popstate' && typeof options === 'object' && options?.once
      )?.[1] as EventListener;
      expect(navigationListener).toBeTypeOf('function');
      window.history.replaceState(scoreSheetHistory, '');
      const event = new PopStateEvent('popstate', { state: scoreSheetHistory });
      // JSDOM dispatch is synchronous. Native event callbacks can drain microtasks
      // before the next listener, so deliver the two phases explicitly.
      await act(async () => {
        navigationListener.call(window, event);
        await Promise.resolve();
        window.dispatchEvent(event);
      });

      expect(sessionBack).not.toHaveBeenCalled();
      expect(screen.getByTestId('session-view')).toBeInTheDocument();
      await waitFor(() => expect((window as any).__silentBack || 0).toBe(0));
    } finally {
      window.removeEventListener('app-back-press', sessionBack);
    }
  });
});

const pinchNativeAction = () => {
  const button = screen.getByRole('button', { name: 'Native action' });
  const outside = screen.getByTestId('dashboard-view');
  const first = { identifier: 1, clientX: 100, clientY: 100 };
  const second = { identifier: 2, clientX: 200, clientY: 100 };
  fireEvent.touchStart(button, { touches: [first], changedTouches: [first] });
  fireEvent.touchStart(outside, { touches: [first, second], changedTouches: [second] });
  fireEvent.touchEnd(outside, { touches: [first], changedTouches: [second] });
  fireEvent.touchEnd(button, { touches: [], changedTouches: [first] });
  return button;
};

describe('App capture protects native click actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it.each([0, 1])('prevents a pinch click before the native React handler, detail=%s', (detail) => {
    render(<App />);
    const button = pinchNativeAction();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail });
    fireEvent(button, click);
    expect(click.defaultPrevented).toBe(true);
    expect(hoisted.nativeActivate).not.toHaveBeenCalled();
  });

  it('accepts every fresh native tap immediately after a pinch', () => {
    render(<App />);
    const button = pinchNativeAction();
    for (let index = 1; index <= 20; index++) {
      const touch = { identifier: index + 2, clientX: 100, clientY: 100 };
      fireEvent.touchStart(button, { touches: [touch], changedTouches: [touch] });
      fireEvent.touchEnd(button, { touches: [], changedTouches: [touch] });
      fireEvent.click(button, { detail: 1 });
      expect(hoisted.nativeActivate).toHaveBeenCalledTimes(index);
    }
  });

  it('preserves keyboard activation at the capture boundary after a pinch', () => {
    render(<App />);
    const button = pinchNativeAction();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button, { detail: 0 });
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(hoisted.nativeActivate).toHaveBeenCalledTimes(1);
  });
});
