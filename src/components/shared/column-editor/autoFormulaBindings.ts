import type { MappingRule, ScoreColumn } from '../../../types';
import type { extractIdentifiers } from '../../../utils/formulaEvaluator';

export const PLAYER_COUNT_ID = '__PLAYER_COUNT__';

type VariableMap = NonNullable<ScoreColumn['variableMap']>;

export function buildAutoFormulaBindings(
    { vars, funcs }: ReturnType<typeof extractIdentifiers>,
    variableMap: VariableMap,
    functions: Record<string, MappingRule[]>,
    firstAvailableColumn: ScoreColumn | undefined,
    getPlayerCountLabel: () => string,
) {
    const nextVariables: VariableMap = {};
    const nextFunctions: Record<string, MappingRule[]> = {};

    for (const name of vars) {
        nextVariables[name] = variableMap[name] || (firstAvailableColumn
            ? { id: firstAvailableColumn.id, name: firstAvailableColumn.name, mode: 'value' }
            : { id: PLAYER_COUNT_ID, name: getPlayerCountLabel(), mode: 'value' });
    }
    for (const name of funcs) {
        nextFunctions[name] = functions[name] || [{ min: 0, score: 0 }];
    }

    return { variableMap: nextVariables, functions: nextFunctions };
}
