import { describe, expect, it } from 'vitest';
import type { ScoreColumn } from '../../../types';
import { calculateColumnScore } from '../../../utils/scoring';
import { getSavedBasicFormula } from './basicColumnFormula';

describe('saving weighted sum columns', () => {
    it.each(['(a1+next)×c1', '(a1×c1)+next'])('reads %s and saves the per-entry formula', formula => {
        const column: ScoreColumn = {
            id: 'weighted-sum',
            name: 'Weighted sum',
            formula,
            inputType: 'clicker',
            constants: { c1: 3 },
            isScoring: true,
        };
        const updates = getSavedBasicFormula(column, 'keypad');

        expect(updates).toEqual({ formula: '(a1×c1)+next', inputType: 'clicker' });
        expect(calculateColumnScore(column, [6, 12])).toBe(18);
        expect(calculateColumnScore({ ...column, ...updates }, [6, 12])).toBe(18);
    });
});
