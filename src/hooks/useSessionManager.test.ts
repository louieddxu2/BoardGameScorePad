import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSessionManager } from './useSessionManager';
import type { GameTemplate, GameSession, HistoryRecord } from '../types';

type SessionStore = Map<string, GameSession>;
type HistoryStore = Map<string, HistoryRecord>;

const hoisted = vi.hoisted(() => {
  const sessionStore: SessionStore = new Map();
  const historyStore: HistoryStore = new Map();
  const templatePrefStore = new Map<string, any>();

  const dbMock = {
    templatePrefs: {
      put: vi.fn(async (pref: any) => {
        templatePrefStore.set(pref.templateId, pref);
      }),
    },
    sessions: {
      put: vi.fn(async (session: GameSession) => {
        sessionStore.set(session.id, session);
      }),
      delete: vi.fn(async (id: string) => {
        sessionStore.delete(id);
      }),
      update: vi.fn(async (id: string, patch: Partial<GameSession>) => {
        const cur = sessionStore.get(id);
        if (cur) sessionStore.set(id, { ...cur, ...patch });
      }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(async () => undefined),
          })),
        })),
      })),
    },
    history: {
      put: vi.fn(async (record: HistoryRecord) => {
        historyStore.set(record.id, record);
      }),
      update: vi.fn(async (id: string, patch: Partial<HistoryRecord>) => {
        const cur = historyStore.get(id);
        if (cur) historyStore.set(id, { ...cur, ...patch });
      }),
    },
    builtins: {
      get: vi.fn(async () => null),
    },
    templates: {
      update: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
    },
  };

  const showToastMock = vi.fn();
  const cleanSessionArtifactsMock = vi.fn(async () => undefined);
  const cleanupDisposableTemplateMock = vi.fn(async () => undefined);
  const processGameEndMock = vi.fn(async () => undefined);

  return {
    sessionStore,
    historyStore,
    templatePrefStore,
    dbMock,
    showToastMock,
    cleanSessionArtifactsMock,
    cleanupDisposableTemplateMock,
    processGameEndMock,
  };
});

vi.mock('../db', () => ({ db: hoisted.dbMock }));
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: hoisted.showToastMock }),
}));
vi.mock('../hooks/useLibrary', () => ({
  useLibrary: () => ({ updatePlayer: vi.fn() }),
}));
vi.mock('../i18n/session', () => ({
  useSessionTranslation: () => ({
    t: (key: string) => (key === 'player_default_name' ? 'Player' : key),
  }),
}));
vi.mock('../services/imageService', () => ({
  imageService: {
    getImage: vi.fn(async () => null),
    deleteImage: vi.fn(async () => undefined),
    saveImage: vi.fn(async () => ({ id: 'img_1' })),
    base64ToBlob: vi.fn(() => new Blob()),
  },
}));
vi.mock('../services/googleDrive', () => ({
  googleDriveService: {
    createActiveSessionFolder: vi.fn(async () => 'folder_1'),
    backupActiveSession: vi.fn(async () => undefined),
    backupHistoryRecord: vi.fn(async () => undefined),
    moveSessionToHistory: vi.fn(async () => undefined),
    backupTemplate: vi.fn(async (t: any) => t),
  },
}));
vi.mock('../services/cleanupService', () => ({
  cleanupService: {
    cleanSessionArtifacts: hoisted.cleanSessionArtifactsMock,
    cleanupDisposableTemplate: hoisted.cleanupDisposableTemplateMock,
  },
}));
vi.mock('../services/relationshipService', () => ({
  relationshipService: {
    processGameEnd: hoisted.processGameEndMock,
  },
}));
vi.mock('../features/recommendation/SessionPlayerInitializer', () => ({
  applyRecommendationsToPlayers: vi.fn(async (session: GameSession) => session.players),
}));

describe('useSessionManager', () => {
  beforeEach(() => {
    hoisted.sessionStore.clear();
    hoisted.historyStore.clear();
    hoisted.templatePrefStore.clear();
    hoisted.showToastMock.mockClear();
    hoisted.cleanSessionArtifactsMock.mockClear();
    hoisted.cleanupDisposableTemplateMock.mockClear();
    hoisted.processGameEndMock.mockClear();

    Object.values(hoisted.dbMock).forEach((table: any) => {
      Object.values(table).forEach((fn: any) => {
        if (typeof fn?.mockClear === 'function') fn.mockClear();
      });
    });
  });

  it('persists session flow from start/update/save-to-history and clears runtime state', async () => {
    const template: GameTemplate = {
      id: 'tpl_1',
      name: 'Test Game',
      columns: [
        {
          id: 'score',
          name: 'Score',
          formula: 'a1',
          inputType: 'keypad',
          isScoring: true,
        },
      ],
      createdAt: Date.now(),
    };

    const getTemplate = vi.fn(async (id: string) => (id === template.id ? template : null));

    const { result } = renderHook(() =>
      useSessionManager({
        getTemplate,
        activeSessions: [],
        isCloudEnabled: () => false,
      })
    );

    let sessionId: string | null = null;
    await act(async () => {
      sessionId = await result.current.startSession(template, 2, { scoringRule: 'HIGHEST_WINS' });
    });

    expect(sessionId).toBeTruthy();
    expect(result.current.currentSession?.players).toHaveLength(2);
    expect(hoisted.templatePrefStore.get(template.id)?.lastPlayerCount).toBe(2);

    const started = result.current.currentSession!;
    const updatedSession: GameSession = {
      ...started,
      players: started.players.map((p, i) =>
        i === 0
          ? { ...p, scores: { score: { parts: [10] } } }
          : p
      ),
    };

    act(() => {
      result.current.updateSession(updatedSession);
    });

    await act(async () => {
      await result.current.saveToHistory('Office');
    });

    expect(hoisted.dbMock.history.put).toHaveBeenCalledTimes(1);
    expect(hoisted.dbMock.sessions.delete).toHaveBeenCalledWith(sessionId);
    expect(hoisted.historyStore.has(sessionId!)).toBe(true);

    const saved = hoisted.historyStore.get(sessionId!)!;
    expect(saved.location).toBe('Office');
    expect(saved.players[0].scores.score.parts[0]).toBe(10);
    expect(hoisted.processGameEndMock).toHaveBeenCalledTimes(1);
    expect(hoisted.cleanupDisposableTemplateMock).toHaveBeenCalledTimes(1);

    expect(result.current.currentSession).toBeNull();
    expect(result.current.activeTemplate).toBeNull();
  });
});

