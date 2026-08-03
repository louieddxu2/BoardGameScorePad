import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameSession, GameTemplate } from '../../../types';
import { useSessionState } from './useSessionState';

const template: GameTemplate = {
  id: 'template-keyboard-dismiss',
  name: 'Keyboard dismiss test',
  columns: [{
    id: 'score',
    name: 'Score',
    formula: 'a1',
    inputType: 'keypad',
    isScoring: true,
  }],
  createdAt: 1,
};

const session: GameSession = {
  id: 'session-keyboard-dismiss',
  templateId: template.id,
  name: template.name,
  startTime: 1,
  status: 'active',
  players: [{
    id: 'player-1',
    name: 'Player 1',
    color: '#fff',
    scores: {},
    totalScore: 0,
  }],
};

const setVisualViewportHeight = (height: number) => {
  if (!window.visualViewport) throw new Error('visualViewport is unavailable');
  (window.visualViewport as VisualViewport & { height: number }).height = height;
  window.visualViewport.dispatchEvent(new Event('resize'));
};

describe('useSessionState player-name keyboard dismissal', () => {
  it('leaves compact mode when the virtual keyboard is dismissed without input blur', () => {
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 800,
    });

    const { result } = renderHook(() => useSessionState({
      session,
      template,
      savedPlayers: [],
      onUpdateSession: () => undefined,
      onUpdateTemplate: () => undefined,
      onUpdateSavedPlayer: () => undefined,
      onExit: () => undefined,
      onResetScores: () => undefined,
    }));

    act(() => {
      result.current.setUiState((previous) => ({
        ...previous,
        editingPlayerId: 'player-1',
        isInputFocused: true,
      }));
    });

    expect(result.current.panelHeight).toBe('200px');

    act(() => setVisualViewportHeight(500));
    act(() => setVisualViewportHeight(800));

    expect(result.current.uiState.isInputFocused).toBe(false);
    expect(result.current.panelHeight).toBe('40vh');
  });
});
