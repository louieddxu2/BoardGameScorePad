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
    localStorage.setItem('app_language', 'en');
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

    expect(screen.getByRole('heading', { name: 'Score together' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync score sheet settings' })).toHaveClass('text-base', 'min-h-12');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explains the purpose before creating a room, and supports immediate Back without confirmation', () => {
    const onClose = vi.fn();
    const onOpenRoom = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerRoomModal isOpen joinUrl="" connectionCount={0} hasUnpublishedBoardUpdate={false}
          onOpenRoom={onOpenRoom} onPublishBoardUpdate={vi.fn()} onClose={onClose} />
      </LanguageProvider>
    );

    expect(screen.getByText(/use their own phones.*same game/)).toBeInTheDocument();
    expect(screen.getByText(/scan the QR code to join.*choose whose scores/)).toBeInTheDocument();
    expect(screen.getByText(/Score entries sync automatically/)).toBeInTheDocument();
    expect(screen.getByText(/After changing scoring items.*press.*Sync score sheet settings/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync score sheet settings' })).not.toBeInTheDocument();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenRoom).not.toHaveBeenCalled();
  });

  it('keeps one history entry through opening, failure and QR states, with explicit actions only', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const onClose = vi.fn();
    const onOpenRoom = vi.fn();
    const onPublishBoardUpdate = vi.fn();
    const props = { isOpen: true, joinUrl: '', connectionCount: 0, hasUnpublishedBoardUpdate: false,
      onOpenRoom, onPublishBoardUpdate, onClose };
    const modal = (updates: Partial<React.ComponentProps<typeof MultiplayerRoomModal>> = {}) => (
      <LanguageProvider><MultiplayerRoomModal {...props} {...updates} /></LanguageProvider>
    );
    const { rerender } = render(modal());
    fireEvent.click(screen.getByRole('button', { name: 'Open room' }));
    expect(onOpenRoom).toHaveBeenCalledTimes(1);
    rerender(modal({ isOpeningRoom: true }));
    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Opening…' }));
    expect(onOpenRoom).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    rerender(modal({ hasOpenError: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not open the room. Please try again.');
    expect(screen.getByRole('button', { name: 'Open room' })).toBeEnabled();
    rerender(modal({ joinUrl: 'https://example.test/?room=room-1', connectionCount: 2, hasUnpublishedBoardUpdate: true }));

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open room' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync score sheet settings' })).toBeInTheDocument();
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(onPublishBoardUpdate).not.toHaveBeenCalled();
  });
});
