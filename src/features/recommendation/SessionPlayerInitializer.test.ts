import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSession, GameTemplate } from '../../types';
import { SuggestedPlayer } from './types';
import { applyRecommendationsToPlayers } from './SessionPlayerInitializer';
import { recommendationService } from './RecommendationService';

vi.mock('./RecommendationService', () => ({
    recommendationService: {
        getPlayerSuggestions: vi.fn(),
        getSuggestedColors: vi.fn()
    }
}));

const makePlayer = (id: string) => ({
    id,
    name: id,
    color: 'initial',
    scores: {},
    totalScore: 0,
    isColorManuallySet: false
});

const makeSession = (playerCount = 3): GameSession => ({
    id: 'session-1',
    templateId: 'template-1',
    name: 'Test Game',
    bggId: '123',
    startTime: 1000,
    players: Array.from({ length: playerCount }, (_, index) => makePlayer(`player_${index + 1}`)),
    status: 'active',
    scoringRule: 'HIGHEST_WINS',
    location: 'Cafe'
});

const makeTemplate = (overrides: Partial<GameTemplate> = {}): GameTemplate => ({
    id: 'template-1',
    name: 'Test Game',
    bggId: '123',
    columns: [],
    createdAt: 1,
    supportedColors: ['red', 'blue', 'yellow'],
    ...overrides
});

describe('applyRecommendationsToPlayers', () => {
    beforeEach(() => {
        vi.mocked(recommendationService.getPlayerSuggestions).mockReset();
        vi.mocked(recommendationService.getSuggestedColors).mockReset();
    });

    it('applies recommended player identities and assigns non-duplicated colors before the session is shown', async () => {
        vi.mocked(recommendationService.getPlayerSuggestions).mockResolvedValue([
            { id: 'saved-a', name: 'Alice', score: 10 },
            { id: 'saved-b', name: 'Bob', score: 9 }
        ] as SuggestedPlayer[]);

        vi.mocked(recommendationService.getSuggestedColors).mockImplementation(async (_context, _template, targetPlayerId) => {
            if (targetPlayerId === 'saved-a') return ['red', 'blue'];
            if (targetPlayerId === 'saved-b') return ['red', 'blue'];
            return [];
        });

        const players = await applyRecommendationsToPlayers(makeSession(), makeTemplate());

        expect(players.map(player => ({
            name: player.name,
            linkedPlayerId: player.linkedPlayerId,
            color: player.color
        }))).toEqual([
            { name: 'Alice', linkedPlayerId: 'saved-a', color: 'red' },
            { name: 'Bob', linkedPlayerId: 'saved-b', color: 'blue' },
            { name: 'player_3', linkedPlayerId: undefined, color: 'yellow' }
        ]);

        expect(recommendationService.getSuggestedColors).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ gameName: 'Test Game', bggId: '123', locationName: 'Cafe' }),
            expect.any(Object),
            'saved-a',
            []
        );
        expect(recommendationService.getSuggestedColors).toHaveBeenNthCalledWith(
            2,
            expect.any(Object),
            expect.any(Object),
            'saved-b',
            ['red']
        );
        expect(recommendationService.getSuggestedColors).toHaveBeenNthCalledWith(
            3,
            expect.any(Object),
            expect.any(Object),
            'player_3',
            ['red', 'blue']
        );
    });

    it('keeps texture templates transparent while still applying recommended player identities', async () => {
        vi.mocked(recommendationService.getPlayerSuggestions).mockResolvedValue([
            { id: 'saved-a', name: 'Alice', score: 10 },
            { id: 'saved-b', name: 'Bob', score: 9 }
        ] as SuggestedPlayer[]);

        const players = await applyRecommendationsToPlayers(
            makeSession(2),
            makeTemplate({ imageId: 'image-1' })
        );

        expect(players.map(player => ({
            name: player.name,
            linkedPlayerId: player.linkedPlayerId,
            color: player.color,
            isColorManuallySet: player.isColorManuallySet
        }))).toEqual([
            { name: 'Alice', linkedPlayerId: 'saved-a', color: 'transparent', isColorManuallySet: false },
            { name: 'Bob', linkedPlayerId: 'saved-b', color: 'transparent', isColorManuallySet: false }
        ]);
        expect(recommendationService.getSuggestedColors).not.toHaveBeenCalled();
    });
});
