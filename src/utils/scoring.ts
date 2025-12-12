
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
      
      // We look for the FIRST matching rule.
      // Since rules are usually ordered Min -> Max, this works.
      const ruleIndex = col.mappingRules.findIndex((r, index, allRules) => {
        // Determine effective Max
        let effectiveMax: number;
        if (r.max === 'next') {
            const nextRule = allRules[index + 1];
            if (nextRule && typeof nextRule.min === 'number') {
                effectiveMax = nextRule.min - 1;
            } else {
                effectiveMax = Infinity; 
            }
        } else {
            effectiveMax = r.max === undefined ? Infinity : r.max;
        }
        
        const aboveMin = r.min === undefined || valNum >= r.min;
        const belowMax = valNum <= effectiveMax;
        return aboveMin && belowMax;
      });

      if (ruleIndex !== -1) {
          const rule = col.mappingRules[ruleIndex];
          
          // Case A: Standard Fixed Score
          if (!rule.isLinear) {
              return rule.score;
          }

          // Case B: Linear Progression ("Every")
          // Formula: BaseScore + floor((Current - PrevEnd) / Unit) * Slope
          
          const unit = Math.max(1, rule.unit || 1);
          const startVal = rule.min ?? 0; 
          const prevEnd = startVal - 1;

          // Calculate Base Score (Score at PrevEnd)
          // We recursively call calculateColumnScore for the value 'prevEnd'
          // This ensures we chain correctly if the previous rule was also linear or just flat.
          // Note: If startVal is -Infinity (undefined min), this logic is fragile, but usually min is defined for linear rules.
          let baseScore = 0;
          if (rule.min !== undefined) {
             // We pass 'false' as 2nd arg to avoid treating prevEnd as a raw object? No, rawValue can be number.
             // We use a clone of column without the current linear rule to avoid infinite recursion?
             // Actually, since prevEnd < rule.min, it strictly matches an EARLIER rule (or no rule).
             // So recursion is safe and naturally terminates.
             baseScore = calculateColumnScore(col, prevEnd);
          }
          
          const offset = valNum - prevEnd;
          // If offset < 0, it shouldn't have matched this rule, but just in case.
          const increments = Math.floor(offset / unit);
          
          return baseScore + (increments * rule.score);
      }
      
      // Fallback: Legacy Overflow Logic (if no rule matched, e.g. gaps, though gaps usually return 0)
      // This supports old templates that relied on global mappingStrategy
      let maxBoundary = -Infinity;
      let lastRuleScore = 0;
      let lastRuleIsInfinite = false;

      col.mappingRules.forEach((r, idx, all) => {
          let eMax = r.max === 'next' ? (all[idx+1]?.min ? all[idx+1].min! - 1 : Infinity) : (r.max ?? Infinity);
          if (eMax > maxBoundary) {
              maxBoundary = eMax;
              lastRuleScore = r.score;
          }
          if (eMax === Infinity) lastRuleIsInfinite = true;
      });

      if (!lastRuleIsInfinite && valNum > maxBoundary) {
           const strategy = col.mappingStrategy || 'linear';
           if (strategy === 'zero') return 0;
           if (strategy === 'linear') {
               const unit = col.linearUnit || 1;
               const scorePerUnit = col.linearScore ?? 1;
               const excess = valNum - maxBoundary;
               const increments = Math.floor(excess / unit);
               return lastRuleScore + (increments * scorePerUnit);
           }
      }

      return 0; // Default for gaps
    }

    let calculated;

    // 2. Product vs. Standard/Sum-Parts Calculation
    if (col.calculationType === 'product') {
        calculated = valNum;
    } else {
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