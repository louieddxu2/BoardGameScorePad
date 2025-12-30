
import { Player, ScoreColumn, GameTemplate, ScoreValue, MappingRule } from '../types';
import { evaluateFormula } from './formulaEvaluator';
import { getScoreRank, getPlayerRank, getTieCount } from './ranking';

/**
 * Context required for auto-calculation.
 */
export interface ScoringContext {
  allColumns: ScoreColumn[];
  playerScores: Record<string, ScoreValue>;
  allPlayers?: Player[]; // Added for ranking calculations
  depth?: number; 
}

export type AutoErrorType = 'missing_dependency' | 'math_error' | null;

/**
 * 建立一個符合 MappingRule 邏輯的查表函數
 */
const createLookupFunction = (rules: MappingRule[]): Function => {
    return (val: number): number => {
        if (!rules || rules.length === 0) return 0;
        
        const ruleIndex = rules.findIndex((r, index, allRules) => {
            let effectiveMax = r.max === 'next'
              ? (allRules[index + 1]?.min ? allRules[index + 1].min! - 1 : Infinity)
              : (r.max === undefined ? Infinity : r.max);
            return (r.min === undefined || val >= r.min) && (val <= effectiveMax);
        });

        if (ruleIndex === -1) return 0;
        
        const rule = rules[ruleIndex];
        if (rule.isLinear) {
            const startVal = rule.min ?? 0; 
            const prevEnd = startVal - 1;
            const baseScore = ruleIndex > 0 ? (createLookupFunction(rules)(prevEnd)) : 0;
            const unit = Math.max(1, rule.unit || 1);
            const offset = val - prevEnd;
            const increments = Math.floor(offset / unit);
            const stepScore = rule.unitScore !== undefined ? rule.unitScore : rule.score;
            return baseScore + (increments * stepScore);
        }
        return rule.score;
    };
};

/**
 * 整合所有函數定義 (Legacy f1 + New functions)
 */
const getFunctionMap = (col: ScoreColumn): Record<string, Function> => {
    const funcs: Record<string, Function> = {};
    
    // 1. 優先處理新版多函數定義物件
    if (col.functions && Object.keys(col.functions).length > 0) {
        Object.keys(col.functions).forEach(fKey => {
            funcs[fKey] = createLookupFunction(col.functions![fKey]);
        });
    }

    // 2. 處理 legacy f1 (相容舊資料)
    // 如果 functions 裡還沒有 f1，但外層有 f1，則補上
    if (col.f1 && col.f1.length > 0 && !funcs['f1']) {
        funcs['f1'] = createLookupFunction(col.f1);
    }

    return funcs;
};

export const getAutoColumnError = (
  col: ScoreColumn, 
  context?: ScoringContext
): AutoErrorType => {
  if (!col.isAuto || !context) return null;
  const { variableMap, formula } = col;
  if (!variableMap) return null;

  for (const key in variableMap) {
    const targetId = variableMap[key].id;
    // 允許特殊變數 ID
    if (targetId === '__PLAYER_COUNT__') continue;
    
    if (!context.allColumns.find(c => c.id === targetId)) {
      return 'missing_dependency';
    }
  }

  if (formula) {
      try {
          // Mock variables for syntax check
          const variables: Record<string, number> = {};
          Object.keys(variableMap).forEach(key => variables[key] = 1);
          
          const funcs = getFunctionMap(col);

          const result = evaluateFormula(formula, variables, funcs);
          if (!isFinite(result) || isNaN(result)) {
              return 'math_error';
          }
      } catch (e) {
          return 'math_error';
      }
  }
  return null;
};

export const calculateColumnScore = (
  col: ScoreColumn, 
  parts: number[], 
  context?: ScoringContext
): number => {
  // --- 0. Auto Calculation Mode ---
  if (col.isAuto) {
    if (!context) return 0; 
    if ((context.depth || 0) > 5) return 0; 

    const { variableMap, formula } = col;
    if (!formula || !variableMap) return 0;

    const variables: Record<string, number> = {};
    
    Object.entries(variableMap).forEach(([varName, targetColRef]) => {
      const targetColId = targetColRef.id;
      
      let currentValue = 0;

      // 處理特殊變數：玩家人數
      if (targetColId === '__PLAYER_COUNT__') {
          currentValue = context.allPlayers ? context.allPlayers.length : 0;
      } 
      // 處理一般欄位參照
      else {
          const targetCol = context.allColumns.find(c => c.id === targetColId);
          if (targetCol) {
            const targetScoreValue = context.playerScores[targetColId];
            const targetParts = targetScoreValue?.parts || [];
            
            // Base value calculation (recursion)
            currentValue = calculateColumnScore(targetCol, targetParts, { 
              ...context, 
              depth: (context.depth || 0) + 1 
            });

            // --- Ranking Logic ---
            if (targetColRef.mode && targetColRef.mode !== 'value') {
                if (context.allPlayers && context.allPlayers.length > 0) {
                    // Calculate scores for all players for this target column
                    const allValues = context.allPlayers.map(p => {
                        const pScoreValue = p.scores[targetColId];
                        const pParts = pScoreValue?.parts || [];
                        // Important: We need to pass the context with allPlayers to recursive calls as well
                        // to ensure nested ranking calculations work correctly.
                        return calculateColumnScore(targetCol, pParts, {
                            allColumns: context.allColumns,
                            playerScores: p.scores,
                            allPlayers: context.allPlayers,
                            depth: (context.depth || 0) + 1
                        });
                    });

                    if (targetColRef.mode === 'rank_score') {
                        currentValue = getScoreRank(currentValue, allValues);
                    } else if (targetColRef.mode === 'rank_player') {
                        currentValue = getPlayerRank(currentValue, allValues);
                    } else if (targetColRef.mode === 'tie_count') {
                        currentValue = getTieCount(currentValue, allValues);
                    }
                } else {
                    // Fallback if no player context (e.g. in simplified preview)
                    // Default to 1 (1st place or 1 tie count)
                    currentValue = 1; 
                }
            }
          }
      }
      
      variables[varName] = currentValue;
    });

    const funcs = getFunctionMap(col);
    let calculated = evaluateFormula(formula, variables, funcs);

    if (col.rounding && col.rounding !== 'none') {
        switch (col.rounding) {
          case 'floor': calculated = Math.floor(calculated); break;
          case 'ceil': calculated = Math.ceil(calculated); break;
          case 'round': calculated = Math.round(calculated); break;
        }
    }
    return calculated;
  }

  // --- Standard Calculation Logic ---
  if (!parts || parts.length === 0) return 0;
  let calculated = 0;

  if ((col.formula || '').includes('+next')) {
    calculated = parts.reduce((sum, part) => sum + part, 0);
  } else if (col.formula === 'a1×a2') {
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 1;
    calculated = a * b;
  } else if (col.formula.startsWith('f1')) {
    const rules = col.f1 || [];
    calculated = createLookupFunction(rules)(parts[0] ?? 0);
  } else {
    const valNum = parts[0] ?? 0;
    calculated = col.formula === 'a1×c1' ? valNum * (col.constants?.c1 ?? 1) : valNum;
  }

  if (col.rounding && col.rounding !== 'none') {
    switch (col.rounding) {
      case 'floor': calculated = Math.floor(calculated); break;
      case 'ceil': calculated = Math.ceil(calculated); break;
      case 'round': calculated = Math.round(calculated); break;
    }
  }
  return calculated;
};

export const calculatePlayerTotal = (player: Player, template: GameTemplate, allPlayers?: Player[]): number => {
  let total = 0;
  // Pass allPlayers to context to support total score depending on rank columns
  const context: ScoringContext = { 
      allColumns: template.columns, 
      playerScores: player.scores,
      allPlayers: allPlayers 
  };
  
  template.columns.forEach(col => {
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
