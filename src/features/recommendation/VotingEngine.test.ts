import { describe, expect, it } from 'vitest';
import { SavedListItem } from '../../types';
import { VotingEngine } from './VotingEngine';

const createVoter = (rankWeights?: number[]): SavedListItem => ({
    id: 'voter',
    name: 'Voter',
    usageCount: 1,
    lastUsed: 1,
    meta: {
        relations: {
            players: Array.from({ length: 10 }, (_, index) => ({ id: `p${index + 1}`, count: 1 }))
        },
        confidence: { players: 1 },
        rankWeights: rankWeights ? { players: rankWeights } : undefined
    }
});

describe('VotingEngine rank voting', () => {
    const engine = new VotingEngine();

    it('votes across twice the original candidate limit with learned weights', () => {
        const scores = engine.calculateScores(
            [{ item: createVoter([5, 3, 2, 1, 0.5, 0, 2.5, 0.5, 0.5, 0]), factor: 'game' }],
            { game: 1 },
            'players',
            [],
            5
        );

        expect(scores.get('p1')).toBe(5);
        expect(scores.get('p7')).toBe(2.5);
        expect(scores.has('p10')).toBe(false);
    });

    it('does not compress relation ranks when an earlier candidate is ignored', () => {
        const scores = engine.calculateScores(
            [{ item: createVoter(), factor: 'game' }],
            { game: 1 },
            'players',
            ['p1'],
            5
        );

        expect(scores.has('p1')).toBe(false);
        expect(scores.get('p2')).toBe(4);
        expect(scores.get('p5')).toBe(1);
        expect(scores.has('p6')).toBe(false);
    });

    it('uses only four learned ranks when the original limit is two', () => {
        const voter = createVoter([4.5, 3.5, 0.5, 0.5]);

        const scores = engine.calculateScores(
            [{ item: voter, factor: 'game' }],
            { game: 1 },
            'players',
            [],
            2
        );

        expect(Array.from(scores.keys())).toEqual(['p1', 'p2', 'p3', 'p4']);
        expect(scores.has('p5')).toBe(false);
    });
});
