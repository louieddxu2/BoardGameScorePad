import type { GameSession, ScoreColumn, ScoreValue } from '../../types';
import { syncPartsFromIds } from '../../utils/scoring';

type ScoreInputValue = number | string | {
    value?: number | string;
    history?: string[];
    factors?: Array<number | string>;
    optionId?: string;
    multiOptionIds?: string[];
};

const toScoreValue = (column: ScoreColumn, value: ScoreInputValue): ScoreValue => {
    const input = typeof value === 'object' ? value : undefined;
    let parts: number[] = [];
    let optionId: string | undefined;
    let multiOptionIds: string[] | undefined;

    if ((column.formula || '').includes('+next')) {
        parts = (input?.history || []).map(part => parseFloat(part)).filter(n => !isNaN(n));
    } else if (column.formula === 'a1×a2') {
        parts = (input?.factors || []).map(factor => parseFloat(String(factor))).filter(n => !isNaN(n));
    } else if (column.isMultiSelect) {
        multiOptionIds = input?.multiOptionIds || [];
        parts = syncPartsFromIds(column, multiOptionIds);
    } else if (column.inputType === 'clicker') {
        optionId = input?.optionId;
        parts = optionId ? syncPartsFromIds(column, [optionId]) : [];
    } else {
        const rawValue = input?.value !== undefined ? input.value : value;
        const number = parseFloat(String(rawValue));
        if (!isNaN(number)) parts = [number];
    }

    return { parts, optionId, multiOptionIds };
};

/** Change stored inputs only; the session manager or room runtime derives the result. */
export const applyScoreInputValue = (
    session: GameSession,
    column: ScoreColumn,
    playerId: string,
    value: ScoreInputValue | null | undefined,
): GameSession => ({
    ...session,
    players: session.players.map(player => {
        if (!column.isShared && player.id !== playerId) return player;
        const scores = { ...player.scores };
        if (value === undefined || value === null) {
            delete scores[column.id];
        } else {
            scores[column.id] = toScoreValue(column, value);
        }
        return { ...player, scores };
    }),
});
