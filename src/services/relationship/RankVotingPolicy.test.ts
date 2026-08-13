import { describe, expect, it } from 'vitest';
import { RankVotingPolicy } from './RankVotingPolicy';

const relations = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `candidate-${index + 1}`,
    count: 1
}));

describe('RankVotingPolicy', () => {
    it('uses twice the original voting limit and preserves its original vote budget', () => {
        expect(RankVotingPolicy.getDefaultWeights(5)).toEqual([5, 4, 3, 2, 1, 0, 0, 0, 0, 0]);
        expect(RankVotingPolicy.getDefaultWeights(2)).toEqual([5, 4, 0, 0]);
        expect(RankVotingPolicy.getDefaultWeights(4)).toEqual([5, 4, 3, 2, 0, 0, 0, 0]);
        const colorWeights = RankVotingPolicy.getDefaultWeights(20);
        expect(colorWeights).toHaveLength(40);
        expect(colorWeights.reduce((sum, value) => sum + value, 0)).toBe(30);
    });

    it('selects predictions by learned vote weight and keeps relation rank as the tie-breaker', () => {
        const ranked = RankVotingPolicy.rankCandidates(
            relations(10),
            [5, 3.5, 2, 1, 0.4, 0.2, 1.5, 0.8, 0.6, 0],
            5
        );

        expect(ranked.slice(0, 5).map(item => item.id)).toEqual([
            'candidate-1',
            'candidate-2',
            'candidate-3',
            'candidate-7',
            'candidate-4'
        ]);
    });

    it('moves at most 0.50 vote to hit ranks without lowering any hit rank', () => {
        const before = RankVotingPolicy.getDefaultWeights(5);
        const after = RankVotingPolicy.adjustWeights(
            relations(10),
            ['candidate-1', 'candidate-7'],
            before,
            5
        );

        expect(after[0]).toBe(5);
        expect(after[6]).toBe(0.5);
        expect(after.reduce((sum, value) => sum + value, 0)).toBe(15);
        expect(after.every(value => value >= 0 && value <= 5)).toBe(true);
        expect(after.slice(0, 5).every(value => value >= 0.01)).toBe(true);
        expect(after.every(value => Number.isInteger(value * 100))).toBe(true);
    });

    it('keeps weights unchanged when no candidate in the learning window is hit', () => {
        const before = RankVotingPolicy.getDefaultWeights(2);
        expect(RankVotingPolicy.adjustWeights(relations(6), ['candidate-5'], before, 2)).toEqual(before);
    });

    it('normalizes malformed persisted values to the relation-specific constraints', () => {
        const weights = RankVotingPolicy.getWeights([8, 8, -1, 0], 2);
        expect(weights).toHaveLength(4);
        expect(weights.reduce((sum, value) => sum + value, 0)).toBe(9);
        expect(weights[0]).toBeLessThanOrEqual(5);
        expect(weights[1]).toBeGreaterThanOrEqual(0.01);
        expect(weights.every(value => Number.isInteger(value * 100))).toBe(true);
    });

    it('preserves learned positions and adds only the new budget when dynamic N grows', () => {
        expect(RankVotingPolicy.getWeights([4.6, 3.8, 0.6, 0], 3)).toEqual([
            4.6, 3.8, 3.6, 0, 0, 0
        ]);
    });

    it('keeps surviving learned positions normalized when dynamic N shrinks', () => {
        const resized = RankVotingPolicy.getWeights([4, 3, 2, 1, 1, 0], 2);

        expect(resized).toHaveLength(4);
        expect(resized.reduce((sum, value) => sum + value, 0)).toBe(9);
        expect(resized[0]).toBeGreaterThanOrEqual(resized[1]);
    });
});
