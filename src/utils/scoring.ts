
import { Player, ScoreColumn, GameTemplate, MappingRule } from '../types';

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
    // 1. Check Mapping Rules (these override other calculations)
    if (col.mappingRules && col.mappingRules.length > 0) {
      
      let maxBoundary = -Infinity;
      let lastRuleScore = 0;
      let lastRuleIsInfinite = false;

      // First pass: Try to find a direct match
      const rule = col.mappingRules.find((r, index, allRules) => {
        // Determine effective Max
        let effectiveMax: number;
        if (r.max === 'next') {
            const nextRule = allRules[index + 1];
            if (nextRule && typeof nextRule.min === 'number') {
                effectiveMax = nextRule.min - 1;
            } else {
                effectiveMax = Infinity; // Should technically not happen if structure is valid
            }
        } else {
            effectiveMax = r.max === undefined ? Infinity : r.max;
        }
        
        // Track the "global" max boundary for overflow logic later
        if (effectiveMax > maxBoundary) {
            maxBoundary = effectiveMax;
            lastRuleScore = r.score;
        }
        if (effectiveMax === Infinity) {
            lastRuleIsInfinite = true;
        }

        const aboveMin = r.min === undefined || valNum >= r.min;
        const belowMax = valNum <= effectiveMax;
        return aboveMin && belowMax;
      });

      if (rule) {
          return rule.score;
      }

      // If no direct match, check Overflow Strategy
      // Only apply if the last rule is NOT infinite (i.e., we have hit a hard ceiling)
      if (!lastRuleIsInfinite && valNum > maxBoundary) {
          const strategy = col.mappingStrategy || 'linear'; // Default to linear
          
          if (strategy === 'zero') {
              return 0; // Return 0 score (not 0 calculation, literally 0 points)
          }
          
          if (strategy === 'linear') {
              // Formula: BaseScore + floor((Val - Max) / Unit) * ScorePerUnit
              const unit = col.linearUnit || 1; // Default "Per 1 unit"
              const scorePerUnit = col.linearScore ?? 1; // Default "Add 1 score"
              
              const excess = valNum - maxBoundary;
              const increments = Math.floor(excess / unit);
              
              return lastRuleScore + (increments * scorePerUnit);
          }
      }
      
      // If below min or no rules matched
      return 0; 
    }

    let calculated;

    // 2. Product vs. Standard/Sum-Parts Calculation
    if (col.calculationType === 'product') {
        // Product mode: The raw value is already the score (A*B). Weight is ignored.
        calculated = valNum;
    } else {
        // Standard & Sum-Parts mode: Value * Weight. For Sum-Parts, valNum is the pre-calculated sum.
        calculated = valNum * (col.weight ?? 1);
    }

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
