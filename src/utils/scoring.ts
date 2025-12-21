
import { Player, ScoreColumn, GameTemplate, ScoreValue } from '../types';

/**
 * Calculates the score for a single column based on its formula and input parts.
 */
export const calculateColumnScore = (col: ScoreColumn, parts: number[]): number => {
  if (!col.isScoring) return 0;
  if (!parts || parts.length === 0) return 0;

  let calculated = 0;

  // --- Formula Parsing and Calculation ---

  // 1. Sum of Parts: a1+next
  if ((col.formula || '').includes('+next')) {
    calculated = parts.reduce((sum, part) => sum + part, 0);
  }
  // 2. Product: a1×a2
  else if (col.formula === 'a1×a2') {
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 1; // 預設值改為 1
    calculated = a * b;
  }
  // 3. Function Mapping: f1(a1)
  else if (col.formula.startsWith('f1')) {
    const valNum = parts[0] ?? 0;
    const rules = col.f1 || [];
    if (rules.length > 0) {
      const ruleIndex = rules.findIndex((r, index, allRules) => {
        let effectiveMax = r.max === 'next'
          ? (allRules[index + 1]?.min ? allRules[index + 1].min! - 1 : Infinity)
          : (r.max === undefined ? Infinity : r.max);
        return (r.min === undefined || valNum >= r.min) && (valNum <= effectiveMax);
      });

      if (ruleIndex !== -1) {
          const rule = rules[ruleIndex];
          if (rule.isLinear) {
            const startVal = rule.min ?? 0; 
            const prevEnd = startVal - 1;
            // Recursively call to get base score
            const baseScore = calculateColumnScore(col, [prevEnd]);
            const unit = Math.max(1, rule.unit || 1);
            const offset = valNum - prevEnd;
            const increments = Math.floor(offset / unit);
            // 關鍵修改：優先使用 unitScore，若無則 fallback 到 score (向上相容)
            const stepScore = rule.unitScore !== undefined ? rule.unitScore : rule.score;
            calculated = baseScore + (increments * stepScore);
          } else {
            calculated = rule.score;
          }
      } else {
        calculated = 0;
      }
    }
  }
  // 4. Standard Weighting: a1 or a1×c1
  else {
    const valNum = parts[0] ?? 0;
    if (col.formula === 'a1×c1') {
        calculated = valNum * (col.constants?.c1 ?? 1);
    } else { // 'a1'
        calculated = valNum;
    }
  }

  // --- Final Rounding ---
  if (col.rounding && col.rounding !== 'none') {
    switch (col.rounding) {
      case 'floor': calculated = Math.floor(calculated); break;
      case 'ceil': calculated = Math.ceil(calculated); break;
      case 'round': calculated = Math.round(calculated); break;
    }
  }
  
  return calculated;
};

/**
 * Calculates the total score for a player based on the template columns.
 */
export const calculatePlayerTotal = (player: Player, template: GameTemplate): number => {
  let total = 0;
  template.columns.forEach(col => {
    if (col.isScoring) {
      const scoreValue: ScoreValue | undefined = player.scores[col.id];
      const parts = scoreValue?.parts || [];
      total += calculateColumnScore(col, parts);
    }
  });
  return total;
};

export const getRawValue = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (value.parts && value.parts.length > 0) return value.parts[0];
    if (typeof value === 'object' && 'value' in value) return parseFloat(String(value.value)) || 0;
    if (typeof value === 'number' || typeof value === 'string') return parseFloat(String(value)) || 0;
    return 0;
};

export const getScoreHistory = (value: any): string[] => {
    if (value === null || value === undefined) return [];
    if (value.parts) return value.parts.map(String);
    if (typeof value === 'object' && Array.isArray(value.history)) return value.history;
    return [];
};
