import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { GameTemplate } from './types';

const hoisted = vi.hoisted(() => {
  const showToast = vi.fn();
  const getBuiltinTemplateByShortId = vi.fn<[string], Promise<GameTemplate | null>>();

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

vi.mock('./components/dashboard/Dashboard', () => ({
  default: () => <div data-testid="dashboard-view">dashboard</div>
}));

vi.mock('./components/editor/TemplateEditor', () => ({
  default: () => <div data-testid="template-editor-view">editor</div>
}));

vi.mock('./components/session/SessionView', () => ({
  default: () => <div data-testid="session-view">session</div>
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
    window.location.hash = '#v=1&src=builtin&id=Agricola';

    render(<App />);

    await waitFor(() => {
      expect(hoisted.getBuiltinTemplateByShortId).toHaveBeenCalledWith('Agricola');
      expect(screen.getByTestId('setup-modal')).toHaveTextContent('Built-in-Agricola');
    });
    expect(window.location.hash).toBe('');
  });

  it('shows warning and stays on dashboard when builtin template does not exist', async () => {
    hoisted.getBuiltinTemplateByShortId.mockResolvedValue(null);
    window.location.hash = '#v=1&src=builtin&id=NoSuchTemplate';

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

  it('ignores invalid hash and keeps default dashboard state', async () => {
    window.location.hash = '#foo=bar';

    render(<App />);

    await waitFor(() => {
      expect(hoisted.getBuiltinTemplateByShortId).not.toHaveBeenCalled();
    });

    expect(screen.queryByTestId('setup-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });
});
