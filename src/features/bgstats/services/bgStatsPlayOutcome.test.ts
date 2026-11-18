import { describe, expect, it } from 'vitest';
import type { Player } from '../../../types';
import { withImportedOutcome } from './bgStatsPlayOutcome';

const players = (totals: number[]): Player[] =>
    totals.map((totalScore, index) => ({ id: `p${index + 1}`, name: `P${index + 1}`, color: '#000', scores: {}, totalScore }));

describe('withImportedOutcome', () => {
    it('leaves outcomes the scores already decide unchanged', () => {
        const input = players([30, 10]);
        expect(withImportedOutcome(input, ['p1'], 'HIGHEST_WINS')).toBe(input);
    });

    it('forces every player to lose when a competitive play has no winner', () => {
        expect(withImportedOutcome(players([30, 10]), [], 'HIGHEST_WINS').map(p => p.isForceLost)).toEqual([true, true]);
    });

    it('leaves winners with different scores and partial cooperative wins unmarked', () => {
        const competitive = players([30, 20, 10]);
        expect(withImportedOutcome(competitive, ['p1', 'p3'], 'HIGHEST_WINS')).toBe(competitive);
        const cooperative = players([0, 0]);
        expect(withImportedOutcome(cooperative, ['p1'], 'COOP')).toBe(cooperative);
    });

    it('never marks no win/loss plays', () => {
        const input = players([0, 0]);
        expect(withImportedOutcome(input, [], 'COMPETITIVE_NO_SCORE')).toBe(input);
    });
});
