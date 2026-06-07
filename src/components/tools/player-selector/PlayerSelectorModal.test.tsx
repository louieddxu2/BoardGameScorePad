import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerSelectorModal from './PlayerSelectorModal';
import { GameSession } from '../../../types';

vi.mock('../../../i18n/tools', () => ({
    useToolsTranslation: () => ({
        t: (key: string) => key === 'picker_prototype_random_names' ? 'A,B,C,D' : key
    })
}));

vi.mock('../../../hooks/useModalBackHandler', () => ({
    useModalBackHandler: () => ({ zIndex: 1000 })
}));

vi.mock('../../../features/recommendation/RecommendationService', () => ({
    recommendationService: {
        getPlayerSuggestions: vi.fn().mockResolvedValue([])
    }
}));

vi.mock('./usePlayerSelectorRenderer', () => ({
    usePlayerSelectorRenderer: () => ({
        resetEngine: vi.fn(),
        closeAllPalettes: vi.fn()
    })
}));

const session: GameSession = {
    id: 'session-1',
    templateId: 'template-1',
    name: 'Test Game',
    startTime: 1,
    players: [],
    status: 'active'
};

describe('PlayerSelectorModal gesture handling', () => {
    it('blocks app zoom detection and iOS system gestures while open', () => {
        const { unmount } = render(
            <PlayerSelectorModal
                isOpen
                onClose={vi.fn()}
                session={session}
            />
        );

        const modal = document.querySelector('[data-mobile-zoom-ignore="true"]');
        expect(modal).toBeTruthy();

        const surface = screen.getByTestId('player-selector-surface');
        expect(surface.style.touchAction).toBe('none');
        expect(surface.style.overscrollBehavior).toBe('contain');

        const gestureStart = new Event('gesturestart', { cancelable: true });
        window.dispatchEvent(gestureStart);
        expect(gestureStart.defaultPrevented).toBe(true);

        unmount();

        const gestureAfterUnmount = new Event('gesturestart', { cancelable: true });
        window.dispatchEvent(gestureAfterUnmount);
        expect(gestureAfterUnmount.defaultPrevented).toBe(false);
    });
});
