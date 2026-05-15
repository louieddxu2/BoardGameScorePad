import { describe, it, expect } from 'vitest';
import { inflateScoringColumn } from './aiExpander';

describe('aiExpander - inflateScoringColumn V7 Semantic Formula Parsing', () => {
  describe('Algebra Parsing', () => {
    it('should parse simple "x" to "a1"', () => {
      const result = inflateScoringColumn({ formula: 'x' });
      expect(result.formula).toBe('a1');
    });

    it('should parse integer multiplier "3x" to "a1×c1"', () => {
      const result = inflateScoringColumn({ formula: '3x' });
      expect(result.formula).toBe('a1×c1');
      expect(result.constants).toEqual({ c1: 3 });
    });

    it('should parse decimal multiplier "0.5x" to "a1×c1"', () => {
      const result = inflateScoringColumn({ formula: '0.5x' });
      expect(result.formula).toBe('a1×c1');
      expect(result.constants).toEqual({ c1: 0.5 });
    });

    it('should parse negative multiplier "-1x" to "a1×c1"', () => {
      const result = inflateScoringColumn({ formula: '-1x' });
      expect(result.formula).toBe('a1×c1');
      expect(result.constants).toEqual({ c1: -1 });
    });

    it('should parse fraction multiplier "(1/2)x" to "a1×c1"', () => {
      const result = inflateScoringColumn({ formula: '(1/2)x' });
      expect(result.formula).toBe('a1×c1');
      expect(result.constants).toEqual({ c1: 0.5 });
    });

    it('should parse multiplication "xy" to "a1×a2"', () => {
      const result = inflateScoringColumn({ formula: 'xy' });
      expect(result.formula).toBe('a1×a2');
    });

    it('should parse sequence accumulation "x+next" to "a1+next"', () => {
      const result = inflateScoringColumn({ formula: 'x+next' });
      expect(result.formula).toBe('a1+next');
    });

    it('should parse sequence multiplication accumulation "xy+next" to "(a1×a2)+next"', () => {
      // NOTE: Our old system for this was "(a1×a2)+next" or similar. We should normalize it to "(a1×a2)+next".
      const result = inflateScoringColumn({ formula: 'xy+next' });
      expect(result.formula).toBe('(a1×a2)+next');
    });

    // Backward compatibility tests
    it('should leave old format "a1×3" alone', () => {
      const result = inflateScoringColumn({ formula: 'a1×3' });
      expect(result.formula).toBe('a1×c1'); // Old logic already expands a1×3
      expect(result.constants).toEqual({ c1: 3 });
    });
  });

  describe('Buttons Parsing', () => {
    it('should parse buttons[\'A\'->1, "B"->0] into clicker quickActions', () => {
      const result = inflateScoringColumn({ formula: 'buttons[\'有\'->10, "無"->0]' });
      expect(result.inputType).toBe('clicker');
      expect(result.formula).toBe('a1'); // Formula defaults to a1 for clickers
      expect(result.quickActions).toBeDefined();
      expect(result.quickActions.length).toBe(2);
      expect(result.quickActions[0].label).toBe('有');
      expect(result.quickActions[0].value).toBe(10);
      expect(result.quickActions[1].label).toBe('無');
      expect(result.quickActions[1].value).toBe(0);
    });

    it('should correctly parse numeric labels like buttons[\'10\'->10]', () => {
      const result = inflateScoringColumn({ formula: 'buttons[\'10\'->10, \'20\'->20]' });
      expect(result.inputType).toBe('clicker');
      expect(result.quickActions[0].label).toBe('10');
      expect(result.quickActions[0].value).toBe(10);
    });
  });

  describe('Lookup Parsing', () => {
    it('should parse lookup[0->-1, 1~3->1, 4~5->2, 6->3]', () => {
      const result = inflateScoringColumn({ formula: 'lookup[0->-1, 1~3->1, 4~5->2, 6->3]' });
      expect(result.formula).toBe('f1(a1)');
      expect(result.f1).toBeDefined();
      expect(result.f1).toEqual([
        { min: 0, max: 'next', score: -1, isLinear: false },
        { min: 1, max: 'next', score: 1, isLinear: false },
        { min: 4, max: 'next', score: 2, isLinear: false },
        { min: 6, score: 3, isLinear: false }
      ]);
    });

    it('should handle function keyword instead of lookup', () => {
      const result = inflateScoringColumn({ formula: 'function[0->-1, 1~3->1]' });
      expect(result.formula).toBe('f1(a1)');
      expect(result.f1).toBeDefined();
      expect(result.f1.length).toBe(2);
      expect(result.f1[0].min).toBe(0);
      expect(result.f1[1].min).toBe(1);
    });

    it('should parse linear extension +3->5 correctly', () => {
      const result = inflateScoringColumn({ formula: 'lookup[1->1, 2->3, 3->7, +3->5]' });
      expect(result.formula).toBe('f1(a1)');
      expect(result.f1).toEqual([
        { min: 1, max: 'next', score: 1, isLinear: false },
        { min: 2, max: 'next', score: 3, isLinear: false },
        { min: 3, max: 'next', score: 7, isLinear: false },
        { min: 4, isLinear: true, unitScore: 5, unit: 3 }
      ]);
    });

    it('should perfectly parse any arbitrary step size like +2->5', () => {
      const result = inflateScoringColumn({ formula: 'lookup[0->-1, 1~2->1, 3~5->3, 6->6, +2->5]' });
      expect(result.formula).toBe('f1(a1)');
      expect(result.f1).toEqual([
        { min: 0, max: 'next', score: -1, isLinear: false },
        { min: 1, max: 'next', score: 1, isLinear: false },
        { min: 3, max: 'next', score: 3, isLinear: false },
        { min: 6, max: 'next', score: 6, isLinear: false },
        { min: 7, isLinear: true, unitScore: 5, unit: 2 }
      ]);
    });

    it('should handle standalone linear rule like lookup[+2->3]', () => {
      const result = inflateScoringColumn({ formula: 'lookup[+2->3]' });
      expect(result.formula).toBe('f1(a1)');
      expect(result.f1).toEqual([
        { min: 1, isLinear: true, unitScore: 3, unit: 2 }
      ]);
    });

    it('should handle case insensitivity and no spaces like Lookup[1->2,3->5]', () => {
      const result = inflateScoringColumn({ formula: 'Lookup[1->2,3->5]' });
      expect(result.formula).toBe('f1(a1)');
      expect(result.f1).toEqual([
        { min: 1, max: 'next', score: 2, isLinear: false },
        { min: 3, score: 5, isLinear: false }
      ]);
    });
  });
});
