import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { ToastProvider } from '../../../hooks/useToast';
import { GameSession, GameTemplate } from '../../../types';
import { useSessionEvents } from './useSessionEvents';
import { useSessionState } from './useSessionState';

const template: GameTemplate = {
  id: 'template-preview-race',
  name: 'Preview race test',
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
  id: 'session-preview-race',
  templateId: template.id,
  name: template.name,
  startTime: 1,
  status: 'active',
  players: [
    { id: 'p1', name: 'Player 1', color: '#fff', scores: {}, totalScore: 0 },
    { id: 'p2', name: 'Player 2', color: '#000', scores: { score: { parts: [42] } }, totalScore: 42 },
  ],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider>
    <ToastProvider>{children}</ToastProvider>
  </LanguageProvider>
);

describe('useSessionEvents score preview initialization', () => {
  it('initializes the next player score before immediate keypad input after a swipe', () => {
    const { result } = renderHook(() => {
      const state = useSessionState({
        session,
        template,
        savedPlayers: [],
        onUpdateSession: () => undefined,
        onUpdateTemplate: () => undefined,
        onUpdateSavedPlayer: () => undefined,
        onExit: () => undefined,
        onResetScores: () => undefined,
      });
      const events = useSessionEvents({
        session,
        template,
        savedPlayers: [],
        onUpdateSession: () => undefined,
        onUpdateTemplate: () => undefined,
        onUpdateSavedPlayer: () => undefined,
        onExit: () => undefined,
        onResetScores: () => undefined,
      }, state);
      return { state, events };
    }, { wrapper });

    act(() => {
      result.current.events.handleCellClick('p1', 'score', { stopPropagation: () => undefined } as any);
    });

    act(() => {
      result.current.events.moveToNextPlayer('p1');
    });

    expect(result.current.state.uiState.editingCell).toEqual({ playerId: 'p2', colId: 'score' });
    expect(result.current.state.uiState.previewValue).toEqual({ value: 42 });
    expect(result.current.state.uiState.overwriteMode).toBe(true);
  });
});
