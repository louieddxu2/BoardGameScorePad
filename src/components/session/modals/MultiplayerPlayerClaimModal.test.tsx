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
    const onCloseRoom = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerRoomModal
          isOpen
          joinUrl="https://example.test/?room=room-1"
          connectionCount={0}
          hasUnpublishedBoardUpdate={false}
          onPublishBoardUpdate={vi.fn()}
          onCloseRoom={onCloseRoom}
          onClose={onClose}
        />
      </LanguageProvider>
    );

    expect(screen.getByRole('heading', { name: 'Multiplayer score entry' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Score sheet structure changed. Tap to sync.' })).not.toBeInTheDocument();
    const closeRoom = screen.getByRole('button', { name: 'Close room' });
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1]).toBe(closeRoom);
    expect(closeRoom).toHaveClass('bg-status-danger', 'text-white', 'w-full', 'min-h-12');
    fireEvent.click(closeRoom);
    expect(onCloseRoom).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explains the purpose before creating a room, and uses the standard modal Back handler', () => {
    localStorage.setItem('app_language', 'zh-TW');
    const onClose = vi.fn();
    const onOpenRoom = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerRoomModal isOpen joinUrl="" connectionCount={0} hasUnpublishedBoardUpdate={false}
          onOpenRoom={onOpenRoom} onPublishBoardUpdate={vi.fn()} onClose={onClose} />
      </LanguageProvider>
    );

    expect(screen.getByRole('heading', { name: '多人同步輸入計分' })).toBeInTheDocument();
    expect(screen.getByText('按下開啟房間，請其他玩家用手機掃描QR code，即可一同輸入此計分板。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '開啟房間' })).toHaveClass('w-full');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '偵測到計分板架構更動，按此同步' })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
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
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
    rerender(modal({ hasOpenError: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not open the room. Please try again.');
    expect(screen.getByRole('button', { name: 'Open room' })).toBeEnabled();
    rerender(modal({ joinUrl: 'https://example.test/?room=room-1', connectionCount: 2, hasUnpublishedBoardUpdate: true }));

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open room' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Score sheet structure changed. Tap to sync.' })).toBeInTheDocument();
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(onPublishBoardUpdate).not.toHaveBeenCalled();
  });

  it('shows sync only for pending changes, supports retry, and hides it once synchronized', async () => {
    let rejectPublish!: (reason: Error) => void;
    const onPublishBoardUpdate = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPublish = reject; }))
      .mockResolvedValue(undefined);
    const props = { isOpen: true, joinUrl: 'https://example.test/?room=room-1', connectionCount: 1,
      onPublishBoardUpdate, onClose: vi.fn() };
    const modal = (pending: boolean) => (
      <LanguageProvider><MultiplayerRoomModal {...props} hasUnpublishedBoardUpdate={pending} /></LanguageProvider>
    );
    const syncName = 'Score sheet structure changed. Tap to sync.';
    const { rerender } = render(modal(false));
    expect(screen.queryByRole('button', { name: syncName })).not.toBeInTheDocument();

    rerender(modal(true));
    const sync = screen.getByRole('button', { name: syncName });
    expect(screen.getByRole('img').compareDocumentPosition(sync) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(onPublishBoardUpdate).not.toHaveBeenCalled();
    fireEvent.click(sync);
    const publishing = screen.getByRole('button', { name: 'Syncing...' });
    expect(publishing).toBeDisabled();
    fireEvent.click(publishing);
    expect(onPublishBoardUpdate).toHaveBeenCalledTimes(1);
    await act(async () => { rejectPublish(new Error('offline')); });
    expect(screen.getByRole('button', { name: syncName })).toBeEnabled();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: syncName })); });
    expect(onPublishBoardUpdate).toHaveBeenCalledTimes(2);
    rerender(modal(false));
    expect(screen.queryByRole('button', { name: syncName })).not.toBeInTheDocument();
    rerender(modal(true));
    expect(screen.getByRole('button', { name: syncName })).toBeEnabled();
    expect(onPublishBoardUpdate).toHaveBeenCalledTimes(2);
  });
});
