import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db';
import type { GameTemplate } from '../../../types';
import type { GameOption } from '../types';
import { useGameLauncher } from './useGameLauncher';

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));
vi.mock('../../../i18n/app', () => ({
  useAppTranslation: () => ({ t: (key: string) => key })
}));

describe('useGameLauncher loading-state identity', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('reuses a verified existing board instead of creating a new simple template', async () => {
    const board = { id: 'board-123', name: 'Shared Name', columns: [], createdAt: 1 } as GameTemplate;
    const option: GameOption = {
      uid: 'saved-game', savedGameId: 'saved-game', displayName: 'Shared Name',
      ambiguousName: true, nameMatchPending: true, lastUsed: 5000, usageCount: 1,
      isPinned: false, defaultPlayerCount: 4, defaultScoringRule: 'HIGHEST_WINS',
      _searchTokens: ['Shared Name']
    };
    const onGetFullTemplate = vi.fn(async () => board);
    const onTemplateSave = vi.fn();
    const onGameStart = vi.fn();
    vi.spyOn(db.templatePrefs, 'put').mockResolvedValue('board-123');
    const { result } = renderHook(() => useGameLauncher({
      allVisibleTemplates: [], onGetFullTemplate, onTemplateSave, onGameStart
    }));

    await act(async () => { await result.current.handlePanelStart(option, 4, ''); });

    expect(onGetFullTemplate).toHaveBeenCalledWith('shortcut:saved-game', {
      gameName: 'Shared Name', bggId: undefined,
      ambiguousName: true, nameMatchPending: true
    });
    expect(onTemplateSave).not.toHaveBeenCalled();
    expect(onGameStart).toHaveBeenCalledWith(board, 4, '', undefined, undefined);
  });
});
