import { describe, expect, it } from 'vitest';
import { evaluateFormula } from './formulaEvaluator';
import { calculateColumnScore } from './scoring';
import type { ScoreColumn } from '../types';

describe('evaluateFormula variable values', () => {
  it('evaluates ordinary values', () => {
    expect(evaluateFormula('x1 × 2 + x2', { x1: 10, x2: -5 })).toBe(15);
    expect(evaluateFormula('f1(x1) + x11', { x1: 3, x11: 100 }, { f1: (v: number) => v * 10 })).toBe(130);
  });

  it('does not zero the formula when a value needs exponent notation', () => {
    // String(0.1 + 0.2 - 0.3) is "5.551115123125783e-17"
    const residue = 0.1 + 0.2 - 0.3;
    expect(String(residue)).toContain('e');
    expect(evaluateFormula('x1 + 10', { x1: residue })).toBeCloseTo(10, 10);
    expect(evaluateFormula('x1 + 1', { x1: 1e21 })).toBe(1e21);
  });

  it('propagates non-finite inputs so the caller can flag the error', () => {
    expect(evaluateFormula('x1 + 5', { x1: Infinity })).toBe(Infinity);
    expect(Number.isNaN(evaluateFormula('x1 + 5', { x1: NaN }))).toBe(true);
  });

  it('still rejects unknown identifiers', () => {
    expect(evaluateFormula('alert(1)', {})).toBe(0);
    expect(evaluateFormula('x1 + window', { x1: 1 })).toBe(0);
    expect(evaluateFormula('_v[0]', { x1: 1 })).toBe(0);
  });
});

describe('auto column that reads a decimal sum', () => {
  it('adds a bonus to a sum whose floating-point residue is tiny', () => {
    const base: ScoreColumn = { id: 'base', name: 'Base', formula: 'a1+next', inputType: 'keypad', isScoring: false };
    const total: ScoreColumn = {
      id: 'total', name: 'Total', formula: 'x1 + 10', inputType: 'auto', isScoring: true, isAuto: true,
      variableMap: { x1: { id: 'base', name: 'Base' } },
    };
    const playerScores = { base: { parts: [0.1, 0.2, -0.3] } };
    const result = calculateColumnScore(total, [], { allColumns: [base, total], playerScores });
    expect(result).toBeCloseTo(10, 10);
  });
});

describe('auto column that divides by zero', () => {
  const numerator: ScoreColumn = { id: 'num', name: 'Num', formula: 'a1', inputType: 'keypad', isScoring: false };
  const denominator: ScoreColumn = { id: 'den', name: 'Den', formula: 'a1', inputType: 'keypad', isScoring: false };
  const ratio: ScoreColumn = {
    id: 'ratio', name: 'Ratio', formula: 'x1 / x2', inputType: 'auto', isScoring: true, isAuto: true,
    variableMap: { x1: { id: 'num', name: 'Num' }, x2: { id: 'den', name: 'Den' } },
  };
  const bonus: ScoreColumn = {
    id: 'bonus', name: 'Bonus', formula: 'x1 + 10', inputType: 'auto', isScoring: true, isAuto: true,
    variableMap: { x1: { id: 'ratio', name: 'Ratio' } },
  };
  const allColumns = [numerator, denominator, ratio, bonus];

  it.each([
    ['x / 0', [5]],
    ['0 / 0', [0]],
  ])('never yields a non-finite score for %s', (_label, numParts) => {
    const playerScores = { num: { parts: numParts }, den: { parts: [0] } };
    const own = calculateColumnScore(ratio, [], { allColumns, playerScores });
    const downstream = calculateColumnScore(bonus, [], { allColumns, playerScores });
    expect(own).toBe(0);
    expect(downstream).toBe(10);
  });
});
