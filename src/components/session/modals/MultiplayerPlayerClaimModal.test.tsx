import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../i18n';
import { _resetActiveCountForTesting } from '../../../hooks/useModalBackHandler';
import MultiplayerPlayerClaimModal from './MultiplayerPlayerClaimModal';
import MultiplayerRoomModal from './MultiplayerRoomModal';

describe('MultiplayerPlayerClaimModal', () => {
  beforeEach(() => {
    _resetActiveCountForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('closes when the browser returns from the player-selection step', () => {
    const onClose = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerPlayerClaimModal
          isOpen
          players={[]}
          onConfirm={vi.fn()}
          onClose={onClose}
        />
      </LanguageProvider>
    );

    act(() => { vi.advanceTimersByTime(300); });
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows the permission settings variant to clear every selected player', () => {
    const onConfirm = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerPlayerClaimModal
          isOpen
          variant="manage"
          players={[{ id: 'p1', name: 'P1', color: '#fff', scores: {}, totalScore: 0 }]}
          initialSelectedIds={['p1']}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'P1' }));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it('closes the QR room dialog when the browser returns', () => {
    const onClose = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerRoomModal
          isOpen
          joinUrl="https://example.test/?room=room-1"
          connectionCount={0}
          hasUnpublishedBoardUpdate={false}
          onPublishBoardUpdate={vi.fn()}
          onClose={onClose}
        />
      </LanguageProvider>
    );

    act(() => { vi.advanceTimersByTime(300); });
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
