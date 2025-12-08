
import { Player, ScoreColumn, GameTemplate } from '../types';

/**
 * Extracts a numeric value from a potential ScoreValue object or primitive number.
 * Handles string inputs (e.g. "5.") by parsing them.
 */
export const getRawValue = (score: any): number | undefined => {
  if (score === undefined || score === null) return undefined;
  if (typeof score === 'object' && 'value' in score) {
    const val = score.value;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    }
    return Number(val);
  }
  if (typeof score === 'string') {
      const parsed = parseFloat(score);
      return isNaN(parsed) ? 0 : parsed;
  }
  return Number(score);
};

/**
 * Extracts the history array from a potential ScoreValue object.
 */
export const getScoreHistory = (score: any): string[] => {
  if (score && typeof score === 'object' && 'history' in score && Array.isArray(score.history)) {
    return score.history;
  }
  return [];
};

/**
 * Calculates the score for a single column based on the raw value and column rules.
 * Handles multipliers (weight), rounding, and mapping rules.
 */
export const calculateColumnScore = (col: ScoreColumn, rawValue: any): number => {
  // Boolean logic
  if (col.type === 'boolean') {
    return rawValue === true ? (col.weight ?? 0) : 0;
  }

  const valNum = getRawValue(rawValue);
  if (valNum === undefined || isNaN(valNum)) return 0;

  // Select logic (Simple multiplication)
  if (col.type === 'select') {
    return valNum * (col.weight ?? 1);
  }

  // Number logic
  if (col.type === 'number') {
    // 1. Check Mapping Rules
    if (col.mappingRules && col.mappingRules.length > 0) {
      const rule = col.mappingRules.find(r => {
        const aboveMin = r.min === undefined || valNum >= r.min;
        const belowMax = r.max === undefined || valNum <= r.max;
        return aboveMin && belowMax;
      });
      // If mapped, return the mapped score directly
      return rule ? rule.score : 0; 
    }

    // 2. Standard Calculation: Value * Weight
    let calculated = valNum * (col.weight ?? 1);

    // 3. Rounding
    if (col.rounding) {
      switch (col.rounding) {
        case 'floor': calculated = Math.floor(calculated); break;
        case 'ceil': calculated = Math.ceil(calculated); break;
        case 'round': calculated = Math.round(calculated); break;
      }
    }
    return calculated;
  }

  return 0;
};

/**
 * Calculates the total score for a player based on the template columns.
 */
export const calculatePlayerTotal = (player: Player, template: GameTemplate): number => {
  let total = 0;
  template.columns.forEach(col => {
    if (col.isScoring) {
      const rawScore = player.scores[col.id];
      total += calculateColumnScore(col, rawScore);
    }
  });
  return total;
};