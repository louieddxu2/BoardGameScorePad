
import { GameTemplate, ScoreColumn, ScoreValue, MappingRule, QuickAction, InputMethod } from '../types';
import { generateId } from './idGenerator';
import { DATA_LIMITS } from '../dataLimits';

export const migrateColumn = (oldCol: any): ScoreColumn => {
  let formula = oldCol.formula || 'a1';
  let constants: { c1?: number } | undefined = oldCol.constants;
  let f1: MappingRule[] | undefined = oldCol.f1;
  let quickActions: QuickAction[] | undefined = oldCol.quickActions;
  let inputType: InputMethod = oldCol.inputType || 'keypad';

  if (!oldCol.formula || !oldCol.inputType) {
    if (oldCol.type === 'select' || oldCol.type === 'boolean') {
      inputType = 'clicker';
      formula = 'a1';
      const oldOptions = oldCol.options || (oldCol.type === 'boolean' ? [
          { label: 'YES (達成)', value: oldCol.weight ?? 1 },
          { label: 'NO (未達成)', value: 0 }
      ] : []);
      
      quickActions = oldOptions.map((opt: any) => ({
          id: generateId(DATA_LIMITS.ID_LENGTH.SHORT),
          label: opt.label,
          value: opt.value,
          color: opt.color,
          isModifier: false
      }));
    } else if (oldCol.calculationType === 'sum-parts') {
      formula = 'a1+next';
      if (Array.isArray(oldCol.quickActions) && oldCol.quickActions.length > 0) {
          inputType = 'clicker';
      }
    } else if (oldCol.calculationType === 'product') {
      formula = 'a1×a2';
    } else if (Array.isArray(oldCol.mappingRules) && oldCol.mappingRules.length > 0) {
      formula = 'f1(a1)';
      f1 = oldCol.mappingRules;
    } else { 
      if (oldCol.weight !== undefined && oldCol.weight !== 1) {
        formula = 'a1×c1';
        constants = { c1: oldCol.weight };
      }
      if (!oldCol.inputType && Array.isArray(oldCol.quickButtons) && oldCol.quickButtons.length > 0) {
          inputType = 'clicker';
          formula = 'a1+next';
          quickActions = oldCol.quickButtons.map((v: number) => ({
              id: generateId(DATA_LIMITS.ID_LENGTH.SHORT),
              label: `${v > 0 ? '+' : ''}${v}`,
              value: v,
          }));
      }
    }
  }

  if (f1 && Array.isArray(f1)) {
    f1 = f1.map(rule => {
      if (rule.isLinear && rule.unitScore === undefined) {
        return { ...rule, unitScore: rule.score };
      }
      return rule;
    });
  }

  // 確保 functions 內部的規則也經過標準化檢查 (例如補上 unitScore)
  let functions = oldCol.functions;
  if (functions) {
      const sanitizedFunctions: Record<string, MappingRule[]> = {};
      Object.keys(functions).forEach(key => {
          if (Array.isArray(functions[key])) {
              sanitizedFunctions[key] = functions[key].map((rule: any) => {
                  if (rule.isLinear && rule.unitScore === undefined) {
                      return { ...rule, unitScore: rule.score };
                  }
                  return rule;
              });
          }
      });
      functions = sanitizedFunctions;
  }

  let displayMode: 'row' | 'overlay' | 'hidden' = oldCol.displayMode || 'row';

  const newCol: ScoreColumn = {
    id: oldCol.id,
    name: oldCol.name,
    color: oldCol.color,
    isScoring: oldCol.isScoring ?? true,
    formula,
    constants,
    f1,
    functions, // CRITICAL FIX: Preserve the functions object (f2, f3...)
    inputType,
    quickActions,
    unit: oldCol.unit,
    subUnits: oldCol.subUnits,
    rounding: oldCol.rounding || 'none',
    showPartsInGrid: oldCol.showPartsInGrid,
    renderMode: oldCol.renderMode, // Added to persistence list
    buttonGridColumns: oldCol.buttonGridColumns,
    displayMode: displayMode, 
    visuals: oldCol.visuals,
    contentLayout: oldCol.contentLayout,
    isAuto: oldCol.isAuto,
    variableMap: oldCol.variableMap
  };
  return newCol;
};

export const migrateTemplate = (template: any): GameTemplate => {
    if (!template || !template.columns?.length) return template;
    
    return {
        ...template,
        bggId: template.bggId || '', 
        supportedColors: template.supportedColors || [], // [New] Initialize supportedColors
        hasImage: template.hasImage || false, 
        columns: template.columns.map(migrateColumn),
        updatedAt: template.updatedAt || template.createdAt, 
    };
};

export const migrateScores = (scores: Record<string, any>, template: GameTemplate): Record<string, ScoreValue> => {
    const newScores: Record<string, ScoreValue> = {};
    Object.keys(scores).forEach(colId => {
        const oldScore = scores[colId];
        const col = template.columns.find(c => c.id === colId);
        if (!col || oldScore === undefined || oldScore === null) return;
        
        if (typeof oldScore === 'object' && oldScore !== null && oldScore.parts) {
            newScores[colId] = oldScore;
            return;
        }

        let parts: number[] = [];
        if ((col.formula || '').includes('+next')) {
            if (typeof oldScore === 'object' && oldScore !== null && oldScore.history) {
                parts = oldScore.history.map((s: string) => parseFloat(s)).filter((n: number) => !isNaN(n));
            }
        } else if (col.formula === 'a1×a2') {
             if (typeof oldScore === 'object' && oldScore !== null && oldScore.factors) {
                parts = oldScore.factors.map((f: any) => parseFloat(String(f))).filter((n: number) => !isNaN(n));
             }
        } else {
             let rawVal: number | undefined;
             if (typeof oldScore === 'object' && oldScore !== null && 'value' in oldScore) rawVal = oldScore.value;
             else if (typeof oldScore === 'number') rawVal = oldScore;
             else if (typeof oldScore === 'boolean') rawVal = oldScore ? 1 : 0;
             
             if (rawVal !== undefined) {
                const num = parseFloat(String(rawVal));
                if (!isNaN(num)) parts = [num];
             }
        }
        newScores[colId] = { parts };
    });
    return newScores;
};
