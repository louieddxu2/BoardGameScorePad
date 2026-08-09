import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayerSelectorModal from './PlayerSelectorModal';
import { GameSession } from '../../../types';

const { generateSuggestionsMock, rendererSpy } = vi.hoisted(() => ({
    generateSuggestionsMock: vi.fn(),
    rendererSpy: vi.fn()
}));

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

vi.mock('../../../db', () => ({
    db: {
        savedPlayers: {
            toArray: vi.fn().mockResolvedValue([])
        }
    }
}));

vi.mock('../../../features/recommendation/playerRecommendationContext', () => ({
    loadPlayerRecommendationContext: vi.fn().mockResolvedValue({
        voters: [],
        weights: {
            game: 1,
            gamePlayStage: 1,
            gameRecency: 1,
            location: 1,
            weekday: 1,
            timeSlot: 1,
            playerCount: 1,
            gameMode: 1,
            relatedPlayer: 1,
            sessionContext: 1
        }
    })
}));

vi.mock('../../../features/recommendation/PlayerRecommendationEngine', () => ({
    playerRecommendationEngine: {
        generateSuggestions: generateSuggestionsMock
    }
}));

vi.mock('./usePlayerSelectorRenderer', () => ({
    usePlayerSelectorRenderer: (props: unknown) => {
        rendererSpy(props);
        return {
            resetEngine: vi.fn(),
            closeAllPalettes: vi.fn()
        };
    }
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
    beforeEach(() => {
        rendererSpy.mockClear();
        generateSuggestionsMock.mockReset();
        generateSuggestionsMock.mockReturnValue([
            { id: 'saved-c', linkedPlayerId: 'saved-c', name: 'Carol' }
        ]);
        Object.defineProperty(document.documentElement, 'requestFullscreen', {
            configurable: true,
            value: vi.fn().mockResolvedValue(undefined)
        });
    });

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

    it('prioritizes manual session identities without pinning system predictions', async () => {
        const sessionWithIdentities: GameSession = {
            ...session,
            players: [
                { id: 'slot-1', name: 'Manual Alice', linkedPlayerId: 'saved-a', color: '#fff', scores: {}, totalScore: 0, isIdentityManuallySet: true },
                { id: 'slot-2', name: 'Wrong prediction', linkedPlayerId: 'saved-b', color: '#000', scores: {}, totalScore: 0, isIdentityManuallySet: false }
            ]
        };

        render(
            <PlayerSelectorModal
                isOpen
                onClose={vi.fn()}
                session={sessionWithIdentities}
            />
        );

        await waitFor(() => {
            expect(generateSuggestionsMock).toHaveBeenCalledWith(expect.objectContaining({
                lockedPlayerIds: ['saved-a'],
                lockedNames: ['Manual Alice']
            }));
        });

        const latestRendererProps = rendererSpy.mock.calls[rendererSpy.mock.calls.length - 1][0] as { candidates: Array<{ name: string }> };
        expect(latestRendererProps.candidates.map(candidate => candidate.name)).toEqual(['Manual Alice', 'Carol']);
    });
});
