import { describe, expect, it } from 'vitest';
import type { ScoreColumn } from '../../../types';
import { extractIdentifiers } from '../../../utils/formulaEvaluator';
import { buildAutoFormulaBindings, PLAYER_COUNT_ID } from './autoFormulaBindings';

describe('buildAutoFormulaBindings', () => {
    it('keeps existing references and rules, drops unused entries, and fills new ones', () => {
        const trees: ScoreColumn = {
            id: 'trees', name: 'Trees', formula: 'a1', inputType: 'keypad', isScoring: true,
        };
        const existing = { id: 'water', name: 'Water', mode: 'rank_score' } as const;
        const existingRules = [{ min: 1, score: 3 }];
        const bindings = buildAutoFormulaBindings(
            extractIdentifiers('f1(x1) + f2(x2)'),
            { x1: existing, x3: existing },
            { f1: existingRules, f3: existingRules },
            trees,
            () => 'Player count',
        );

        expect(bindings).toEqual({
            variableMap: { x1: existing, x2: { id: 'trees', name: 'Trees', mode: 'value' } },
            functions: { f1: existingRules, f2: [{ min: 0, score: 0 }] },
        });
        expect(bindings.variableMap.x1).toBe(existing);
        expect(bindings.functions.f1).toBe(existingRules);
    });

    it('defaults new references to player count when no other column is available', () => {
        const bindings = buildAutoFormulaBindings(extractIdentifiers('x1'), {}, {}, undefined, () => 'Player count');

        expect(bindings).toEqual({
            variableMap: { x1: { id: PLAYER_COUNT_ID, name: 'Player count', mode: 'value' } },
            functions: {},
        });
    });
});
