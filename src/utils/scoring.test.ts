
import { describe, it, expect } from 'vitest';
import { calculateColumnScore, getRawValue, getScoreHistory } from './scoring';
import { ScoreColumn } from '../types';

// 建立一個產生假 Column 的 helper，方便測試
const createColumn = (overrides: Partial<ScoreColumn> = {}): ScoreColumn => ({
  id: 'test-col',
  name: 'Test',
  type: 'number',
  isScoring: true,
  weight: 1,
  options: [],
  mappingRules: [],
  unit: '',
  rounding: 'none',
  quickButtons: [],
  calculationType: 'standard', // Default
  ...overrides,
});

describe('計分邏輯測試 (Scoring Logic)', () => {
  
  describe('數值提取 (getRawValue & getScoreHistory)', () => {
    it('應正確提取基礎數值', () => {
      expect(getRawValue(10)).toBe(10);
      expect(getRawValue("42")).toBe(42);
      expect(getRawValue({ value: 100, history: [] })).toBe(100);
      expect(getRawValue(null)).toBe(0);
    });

    it('應正確提取歷史紀錄', () => {
      expect(getScoreHistory(10)).toEqual([]);
      expect(getScoreHistory({ value: 10, history: ["5", "5"] })).toEqual(["5", "5"]);
    });
  });

  describe('基本加權與小數點 (Standard & Rounding)', () => {
    it('應正確計算權重', () => {
      const col = createColumn({ weight: 2 });
      expect(calculateColumnScore(col, 5)).toBe(10);
      expect(calculateColumnScore(col, -3)).toBe(-6);
    });

    it('應正確處理小數點 (Floor/Ceil/Round)', () => {
      const floorCol = createColumn({ rounding: 'floor' });
      expect(calculateColumnScore(floorCol, 3.9)).toBe(3);

      const ceilCol = createColumn({ rounding: 'ceil' });
      expect(calculateColumnScore(ceilCol, 3.1)).toBe(4);

      const roundCol = createColumn({ rounding: 'round' });
      expect(calculateColumnScore(roundCol, 3.5)).toBe(4);
      expect(calculateColumnScore(roundCol, 3.4)).toBe(3);
    });
  });

  describe('查表規則 (Mapping Rules)', () => {
    // 模擬農家樂羊的規則
    const rules = [
      { max: 0, score: -1 },
      { min: 1, max: 3, score: 1 },
      { min: 4, score: 2 } // 4+
    ];
    const col = createColumn({ mappingRules: rules });

    it('應正確匹配區間', () => {
      expect(calculateColumnScore(col, 0)).toBe(-1);
      expect(calculateColumnScore(col, 2)).toBe(1);
      expect(calculateColumnScore(col, 4)).toBe(2);
      expect(calculateColumnScore(col, 99)).toBe(2);
    });
  });

  describe('線性累加規則 (Linear Rules)', () => {
    // 情境：前 3 個 1 分，之後每 2 個 +5 分
    const linearCol = createColumn({
      mappingRules: [
        { max: 3, score: 1, isLinear: false },
        { min: 4, score: 5, unit: 2, isLinear: true } // Base is score at 3 (1)
      ]
    });

    it('應正確計算混合線性分數', () => {
      // 3 => 1分
      expect(calculateColumnScore(linearCol, 3)).toBe(1);
      
      // 4 => 1 + floor((4-3)/2)*5 = 1 + 0 = 1
      expect(calculateColumnScore(linearCol, 4)).toBe(1);
      
      // 5 => 1 + floor((5-3)/2)*5 = 1 + 5 = 6
      expect(calculateColumnScore(linearCol, 5)).toBe(6);
      
      // 7 => 1 + floor((7-3)/2)*5 = 1 + 10 = 11
      expect(calculateColumnScore(linearCol, 7)).toBe(11);
    });
  });

  describe('特殊計算模式 (Special Calculation Types)', () => {
    it('乘積模式 (Product): 應忽略 Weight 並計算數值', () => {
      const prodCol = createColumn({ calculationType: 'product', weight: 10 }); 
      // Weight should be ignored in product mode logic if standard implementation follows it, 
      // but strictly speaking product mode usually calculates raw value directly.
      // Based on implementation: if type is product, it returns valNum directly (without weight).
      // Let's verify standard behavior.
      
      // Mocking a product value input structure
      // In the app, product is stored as simple number in value, but derived from factors UI.
      // The calculateColumnScore receives the total value.
      expect(calculateColumnScore(prodCol, 25)).toBe(25);
    });

    it('布林值 (Boolean)', () => {
      const boolCol = createColumn({ type: 'boolean', weight: 5 });
      expect(calculateColumnScore(boolCol, true)).toBe(5);
      expect(calculateColumnScore(boolCol, false)).toBe(0);
    });
    
    it('選項 (Select)', () => {
      const selectCol = createColumn({ type: 'select', weight: 2 });
      // Select passes the value directly, usually defined in options
      expect(calculateColumnScore(selectCol, 5)).toBe(10); // 5 * 2
    });
  });

});
