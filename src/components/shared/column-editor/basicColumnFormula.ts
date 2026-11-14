import type { InputMethod, ScoreColumn } from '../../../types';

export type CalculationMode = 'standard' | 'product';

export function getCalculationMode(formula: string): CalculationMode {
    return formula.includes('×a2') ? 'product' : 'standard';
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
    const sumParts = (column.formula || '').includes('+next');
    const multiplier = column.constants?.c1 ?? 1;
    const inputType = column.inputType !== 'auto' ? column.inputType : undefined;
    const fallbackInputType = mode === 'standard' ? cachedSumPartsInputType : undefined;

    return {
        // Saved weighted sums retain the existing serialized formula.
        formula: mode === 'standard' && sumParts && multiplier !== 1
            ? '(a1+next)×c1'
            : buildDraftFormula(mode, sumParts, multiplier),
        inputType: sumParts ? inputType || fallbackInputType || 'keypad' : 'keypad',
    };
}
