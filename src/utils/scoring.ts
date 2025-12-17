
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
    // Note: The old 'weight' for sum-parts is intentionally ignored as per new design.
  }
  // 2. Product: a1×a2
  else if (col.formula === 'a1×a2') {
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
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
            // Recursively call to get base score, passing only the value part.
            const baseScore = calculateColumnScore(col, [prevEnd]);
            const unit = Math.max(1, rule.unit || 1);
            const offset = valNum - prevEnd;
            const increments = Math.floor(offset / unit);
            calculated = baseScore + (increments * rule.score);
          } else {
            calculated = rule.score;
          }
      } else {
        calculated = 0; // Default for gaps
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

// --- Fix: Add missing helper functions for backward compatibility ---
/**
 * Extracts the primary numeric value from a ScoreValue object or legacy formats.
 */
export const getRawValue = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (value.parts && value.parts.length > 0) return value.parts[0]; // New format
    if (typeof value === 'object' && 'value' in value) return parseFloat(String(value.value)) || 0; // Legacy
    if (typeof value === 'number' || typeof value === 'string') return parseFloat(String(value)) || 0;
    return 0;
};

/**
 * Extracts the history array from score formats that support it.
 */
export const getScoreHistory = (value: any): string[] => {
    if (value === null || value === undefined) return [];
    if (value.parts) return value.parts.map(String); // New format
    if (typeof value === 'object' && Array.isArray(value.history)) return value.history; // Legacy
    return [];
};
