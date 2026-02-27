import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppData } from './useAppData';

const hoisted = vi.hoisted(() => {
  const relatedSessions = [
    { id: 's1', templateId: 'tpl_1', cloudFolderId: 'cloud_1' },
    { id: 's2', templateId: 'tpl_1', cloudFolderId: undefined },
  ];

  const dbMock = {
    sessions: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => relatedSessions),
        })),
      })),
      bulkDelete: vi.fn(async () => undefined),
    },
    templates: {
      delete: vi.fn(async () => undefined),
    },
    templatePrefs: {
      delete: vi.fn(async () => undefined),
    },
  };

  const cleanupServiceMock = {
    cleanSessionArtifacts: vi.fn(async () => undefined),
  };

  const imageServiceMock = {
    deleteImagesByRelatedId: vi.fn(async () => undefined),
  };

  const queriesMock = {
    templates: [],
    userTemplatesCount: 0,
    systemTemplates: [],
    systemTemplatesCount: 0,
    systemOverrides: [],
    gameOptions: [],
    activeSessionIds: [],
    activeSessions: [],
    historyRecords: [],
    historyCount: 0,
    savedPlayers: [],
    savedLocations: [],
    savedGames: [],
    getTemplate: vi.fn(async (id: string) => ({ id, name: 'T', columns: [], createdAt: Date.now() })),
    getSessionPreview: vi.fn(),
  };

  const sessionManagerMock = {
    currentSession: null,
    activeTemplate: null,
    sessionImage: null,
    sessionPlayerCount: null,
    startSession: vi.fn(),
    resumeSession: vi.fn(),
    discardSession: vi.fn(),
    clearAllActiveSessions: vi.fn(),
    updateSession: vi.fn(),
    resetSessionScores: vi.fn(),
    exitSession: vi.fn(),
    saveToHistory: vi.fn(),
    updateActiveTemplate: vi.fn(),
    setSessionImage: vi.fn(),
    updateSavedPlayer: vi.fn(),
  };

  const showToastMock = vi.fn();

  return {
    dbMock,
    cleanupServiceMock,
    imageServiceMock,
    queriesMock,
    sessionManagerMock,
    showToastMock,
  };
});

vi.mock('../db', () => ({ db: hoisted.dbMock }));
vi.mock('../utils/dbMigration', () => ({ migrateFromLocalStorage: vi.fn(async () => undefined) }));
vi.mock('./useAppQueries', () => ({ useAppQueries: vi.fn(() => hoisted.queriesMock) }));
vi.mock('./useSessionManager', () => ({ useSessionManager: vi.fn(() => hoisted.sessionManagerMock) }));
vi.mock('./useLibrary', () => ({
  useLibrary: vi.fn(() => ({
    updatePlayer: vi.fn(),
    updateLocation: vi.fn(),
    commitPlayerStats: vi.fn(),
    commitLocationStats: vi.fn(),
  })),
}));
vi.mock('./useDebounce', () => ({ useDebounce: vi.fn((v: string) => v) }));
vi.mock('./useToast', () => ({ useToast: vi.fn(() => ({ showToast: hoisted.showToastMock })) }));
vi.mock('../i18n/app', () => ({ useAppTranslation: vi.fn(() => ({ t: (key: string) => key })) }));
vi.mock('../services/imageService', () => ({ imageService: hoisted.imageServiceMock }));
vi.mock('../services/cleanupService', () => ({ cleanupService: hoisted.cleanupServiceMock }));
vi.mock('../services/googleDrive', () => ({
  googleDriveService: {
    softDeleteFolder: vi.fn(async () => undefined),
    backupTemplate: vi.fn(async (t: any) => t),
  },
  getAutoConnectPreference: vi.fn(() => false),
}));
vi.mock('../features/bgstats/services/bgStatsImportService', () => ({
  bgStatsImportService: { importData: vi.fn(async () => 0) },
}));
vi.mock('../utils/idGenerator', () => ({ generateId: vi.fn(() => 'new_id') }));
vi.mock('../utils/templateUtils', () => ({
  prepareTemplateForSave: vi.fn(async (t: any) => t),
  isDisposableTemplate: vi.fn(() => false),
}));

describe('useAppData.deleteTemplate', () => {
  beforeEach(() => {
    hoisted.showToastMock.mockClear();
    hoisted.queriesMock.getTemplate.mockClear();
    Object.values(hoisted.dbMock).forEach((table: any) => {
      Object.values(table).forEach((fn: any) => {
        if (typeof fn?.mockClear === 'function') fn.mockClear();
      });
    });
    Object.values(hoisted.cleanupServiceMock).forEach((fn: any) => fn.mockClear?.());
    Object.values(hoisted.imageServiceMock).forEach((fn: any) => fn.mockClear?.());
  });

  it('cleans related sessions, preferences, and images when deleting template', async () => {
    const { result } = renderHook(() => useAppData());

    await act(async () => {
      await result.current.deleteTemplate('tpl_1');
    });

    expect(hoisted.queriesMock.getTemplate).toHaveBeenCalledWith('tpl_1');
    expect(hoisted.dbMock.sessions.where).toHaveBeenCalledWith('templateId');
    expect(hoisted.cleanupServiceMock.cleanSessionArtifacts).toHaveBeenCalledTimes(2);
    expect(hoisted.cleanupServiceMock.cleanSessionArtifacts).toHaveBeenCalledWith('s1', 'cloud_1');
    expect(hoisted.cleanupServiceMock.cleanSessionArtifacts).toHaveBeenCalledWith('s2', undefined);
    expect(hoisted.dbMock.sessions.bulkDelete).toHaveBeenCalledWith(['s1', 's2']);
    expect(hoisted.dbMock.templates.delete).toHaveBeenCalledWith('tpl_1');
    expect(hoisted.dbMock.templatePrefs.delete).toHaveBeenCalledWith('tpl_1');
    expect(hoisted.imageServiceMock.deleteImagesByRelatedId).toHaveBeenCalledWith('tpl_1');
  });
});

