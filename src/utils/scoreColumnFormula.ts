export function isSumPartsFormula(formula: string | null | undefined): boolean {
    return (formula || '').includes('+next');
}

/** Matches both standalone products and products within a sum of parts. */
export function hasSecondFactor(formula: string): boolean {
    return formula.includes('×a2');
}
