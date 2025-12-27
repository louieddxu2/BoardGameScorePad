
import { Player, ScoreColumn, GameTemplate, ScoreValue } from '../types';
import { evaluateFormula } from './formulaEvaluator';

/**
 * Context required for auto-calculation.
 * Contains the definitions of all columns and the full scores object of the player.
 */
export interface ScoringContext {
  allColumns: ScoreColumn[];
  playerScores: Record<string, ScoreValue>;
  depth?: number; // To prevent infinite recursion crash
}

export type AutoErrorType = 'missing_dependency' | 'math_error' | null;

/**
 * Validates an auto-calculated column to check for errors like missing references or divide-by-zero.
 */
export const getAutoColumnError = (
  col: ScoreColumn, 
  context?: ScoringContext
): AutoErrorType => {
  if (!col.isAuto || !context) return null;

  const { variableMap, formula } = col;
  if (!variableMap) return null;

  // 1. Check Missing Dependencies (Reference Broken)
  // Loop through all variables mapped in the column
  for (const key in variableMap) {
    const targetId = variableMap[key].id;
    // If the target column ID is not found in the provided allColumns list
    if (!context.allColumns.find(c => c.id === targetId)) {
      return 'missing_dependency';
    }
  }

  // 2. Check Math Error (Divide by Zero, etc.)
  // We need to perform a "raw" evaluation to catch Infinity/NaN
  if (formula) {
      try {
          const variables: Record<string, number> = {};
          // Resolve variables purely for validation
          Object.entries(variableMap).forEach(([varName, targetColRef]) => {
              const targetCol = context.allColumns.find(c => c.id === targetColRef.id);
              if (targetCol) {
                  const targetScoreValue = context.playerScores[targetColRef.id];
                  const targetParts = targetScoreValue?.parts || [];
                  // Reuse existing calculation logic, assuming recursive deps are valid or handled by depth limit
                  variables[varName] = calculateColumnScore(targetCol, targetParts, { 
                      ...context, 
                      depth: (context.depth || 0) + 1 
                  });
              } else {
                  variables[varName] = 0;
              }
          });

          // Inline simplified evaluation to catch Infinity (evaluateFormula usually suppresses it to 0)
          // We replicate the substitution logic briefly just to test validity
          // FIX: Replace '×' with '*' before evaluation, just like evaluateFormula
          let processedFormula = formula.toLowerCase().replace(/×/g, '*');
          
          const sortedVars = Object.keys(variables).sort((a, b) => b.length - a.length);
          sortedVars.forEach(key => {
              processedFormula = processedFormula.split(key.toLowerCase()).join(`(${variables[key]})`);
          });
          
          // eslint-disable-next-line no-new-func
          const result = new Function(`"use strict"; return (${processedFormula})`)();
          
          if (!isFinite(result) || isNaN(result)) {
              return 'math_error';
          }

      } catch (e) {
          // Syntax errors or other issues
          return 'math_error';
      }
  }

  return null;
};

/**
 * Calculates the score for a single column based on its formula and input parts.
 * Now supports 'context' for Auto columns.
 */
export const calculateColumnScore = (
  col: ScoreColumn, 
  parts: number[], 
  context?: ScoringContext
): number => {
  // UPDATE: We calculate the score regardless of isScoring.
  // This allows the UI to show the value (e.g. for reference columns).
  // The 'total' calculation will filter based on isScoring.
  
  // --- 0. Auto Calculation Mode ---
  if (col.isAuto) {
    if (!context) return 0; // Cannot calculate without context
    if ((context.depth || 0) > 5) return 0; // Circuit breaker for recursion

    const { variableMap, formula } = col;
    if (!formula || !variableMap) return 0;

    // Resolve variables (x1, x2...) to actual numbers
    const variables: Record<string, number> = {};
    
    Object.entries(variableMap).forEach(([varName, targetColRef]) => {
      const targetColId = targetColRef.id;
      const targetCol = context.allColumns.find(c => c.id === targetColId);
      
      if (targetCol) {
        // Recursive call to get the value of the referenced column
        // We pass the SAME playerScores context, but increment depth
        const targetScoreValue = context.playerScores[targetColId];
        const targetParts = targetScoreValue?.parts || [];
        
        variables[varName] = calculateColumnScore(targetCol, targetParts, { 
          ...context, 
          depth: (context.depth || 0) + 1 
        });
      } else {
        variables[varName] = 0; // Target column not found
      }
    });

    let calculated = evaluateFormula(formula, variables);

    // Apply Rounding for Auto columns too
    if (col.rounding && col.rounding !== 'none') {
        switch (col.rounding) {
          case 'floor': calculated = Math.floor(calculated); break;
          case 'ceil': calculated = Math.ceil(calculated); break;
          case 'round': calculated = Math.round(calculated); break;
        }
    }
    return calculated;
  }

  // --- Standard Calculation Logic (Pre-existing) ---
  if (!parts || parts.length === 0) return 0;

  let calculated = 0;

  // 1. Sum of Parts: a1+next
  if ((col.formula || '').includes('+next')) {
    calculated = parts.reduce((sum, part) => sum + part, 0);
  }
  // 2. Product: a1×a2
  else if (col.formula === 'a1×a2') {
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 1;
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
            // Recursively call to get base score (using standard logic, no context needed for f1 mapping)
            const baseScore = calculateColumnScore(col, [prevEnd]);
            const unit = Math.max(1, rule.unit || 1);
            const offset = valNum - prevEnd;
            const increments = Math.floor(offset / unit);
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
  
  // Create context for Auto columns
  const context: ScoringContext = {
      allColumns: template.columns,
      playerScores: player.scores
  };

  template.columns.forEach(col => {
    // Only add to total if isScoring is true
    if (col.isScoring) {
      const scoreValue: ScoreValue | undefined = player.scores[col.id];
      const parts = scoreValue?.parts || [];
      total += calculateColumnScore(col, parts, context);
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
