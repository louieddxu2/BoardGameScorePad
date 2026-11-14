import type { ScoreValue } from '../../types';
import { getScoreHistory } from '../../utils/scoring';

export function buildScoreHistoryInput(history: string[]) {
    const value = history.reduce((sum, part) => sum + (parseFloat(part) || 0), 0);
    return { value, history };
}

export function appendScoreHistoryPart(score: ScoreValue | undefined, part: number, modifyLast = false) {
    const history = [...getScoreHistory(score)];
    const lastIndex = history.length - 1;
    if (modifyLast && lastIndex >= 0) {
        history[lastIndex] = String(parseFloat(history[lastIndex]) + part);
    } else {
        history.push(String(part));
    }
    return buildScoreHistoryInput(history);
}
