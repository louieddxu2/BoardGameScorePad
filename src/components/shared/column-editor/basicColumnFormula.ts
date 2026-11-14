import type { InputMethod, ScoreColumn } from '../../../types';
import { hasSecondFactor, isSumPartsFormula } from '../../../utils/scoreColumnFormula';

export type CalculationMode = 'standard' | 'product';

export function getCalculationMode(formula: string): CalculationMode {
    return hasSecondFactor(formula) ? 'product' : 'standard';
}

export function buildDraftFormula(mode: CalculationMode, sumParts: boolean, multiplier: number): string {
    const formula = mode === 'product' ? 'a1×a2' : multiplier !== 1 ? 'a1×c1' : 'a1';
    if (!sumParts) return formula;
    return formula === 'a1' ? 'a1+next' : `(${formula})+next`;
}

export function getSavedBasicFormula(
    column: ScoreColumn,
    cachedSumPartsInputType: InputMethod,
): Pick<ScoreColumn, 'formula' | 'inputType'> {
    const mode = getCalculationMode(column.formula);
    const sumParts = isSumPartsFormula(column.formula);
    const multiplier = column.constants?.c1 ?? 1;
    const inputType = column.inputType !== 'auto' ? column.inputType : undefined;
    const fallbackInputType = mode === 'standard' ? cachedSumPartsInputType : undefined;

    return {
        formula: buildDraftFormula(mode, sumParts, multiplier),
        inputType: sumParts ? inputType || fallbackInputType || 'keypad' : 'keypad',
    };
}
