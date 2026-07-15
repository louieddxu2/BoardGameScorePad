import React from 'react';
import { act, render } from '@testing-library/react';
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

  it('closes the QR room dialog when the browser returns', () => {
    const onClose = vi.fn();
    render(
      <LanguageProvider>
        <MultiplayerRoomModal
          isOpen
          joinUrl="https://example.test/?room=room-1"
          connectionCount={0}
          onClose={onClose}
        />
      </LanguageProvider>
    );

    act(() => { vi.advanceTimersByTime(300); });
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
