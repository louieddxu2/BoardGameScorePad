import { describe, expect, it } from 'vitest';
import type { GameSession, ScoreColumn, ScoreValue } from '../../types';
import { applyScoreInputValue } from './scoreInputUpdate';

const column: ScoreColumn = {
    id: 'points', name: 'Points', formula: 'a1', inputType: 'keypad', isScoring: true,
    quickActions: [{ id: 'a', label: 'A', value: 2 }, { id: 'b', label: 'B', value: 5 }],
};

const makeSession = (): GameSession => ({
    id: 'session-1', templateId: 'template-1', name: 'Input test', startTime: 1,
    status: 'active', scoringRule: 'HIGHEST_WINS', lastUpdatedAt: 17, winnerIds: ['p2'],
    players: [
        { id: 'p1', name: 'P1', color: '#fff', scores: { points: { parts: [3] } }, totalScore: 3 },
        { id: 'p2', name: 'P2', color: '#000', scores: { points: { parts: [7] } }, totalScore: 7 },
    ],
});

describe('applyScoreInputValue', () => {
    it('preserves numeric, accumulated, product, and option input formats without changing other players', () => {
        const cases: Array<{
            name: string;
            column?: Partial<ScoreColumn>;
            value: Parameters<typeof applyScoreInputValue>[3];
            expected: ScoreValue;
        }> = [
            { name: 'decimal keypad', value: { value: '-2.5' }, expected: { parts: [-2.5] } },
            { name: 'plain zero', value: '0', expected: { parts: [0] } },
            { name: 'invalid numeric draft', value: { value: '-' }, expected: { parts: [] } },
            {
                name: 'accumulated products use history, not the current factors',
                column: { formula: 'a1×a2+next' },
                value: { history: ['2.5', 'invalid', '-1'], factors: [8, 9], value: 999 },
                expected: { parts: [2.5, -1] },
            },
            { name: 'product', column: { formula: 'a1×a2' }, value: { factors: ['3', '-2'] }, expected: { parts: [3, -2] } },
            {
                name: 'multi-select preserves IDs while resolving current option values',
                column: { inputType: 'clicker', isMultiSelect: true },
                value: { multiOptionIds: ['b', 'removed', 'a'] },
                expected: { parts: [5, 2], multiOptionIds: ['b', 'removed', 'a'] },
            },
            { name: 'single select', column: { inputType: 'clicker' }, value: { optionId: 'a' }, expected: { parts: [2], optionId: 'a' } },
            { name: 'empty selection', column: { inputType: 'clicker' }, value: {}, expected: { parts: [] } },
        ];

        for (const testCase of cases) {
            const session = makeSession();
            const next = applyScoreInputValue(session, { ...column, ...testCase.column }, 'p1', testCase.value);
            expect(next.players[0].scores.points, testCase.name).toEqual({
                optionId: undefined, multiOptionIds: undefined, ...testCase.expected,
            });
            expect(next.players[1], testCase.name).toBe(session.players[1]);
            expect(session.players[0].scores.points, testCase.name).toEqual({ parts: [3] });
        }
    });

    it('updates or clears shared inputs without aliasing score parts or changing derived data', () => {
        const session = makeSession();
        const shared = { ...column, isShared: true };
        const next = applyScoreInputValue(session, shared, 'p1', { value: 4 });
        expect(next.players.map(player => player.scores.points.parts)).toEqual([[4], [4]]);
        expect(next.players[0].scores.points.parts).not.toBe(next.players[1].scores.points.parts);
        expect(next.players.map(player => player.totalScore)).toEqual([3, 7]);
        expect(next.winnerIds).toBe(session.winnerIds);
        expect(next.lastUpdatedAt).toBe(17);

        for (const empty of [null, undefined]) {
            const cleared = applyScoreInputValue(next, shared, 'p2', empty);
            expect(cleared.players.every(player => !('points' in player.scores))).toBe(true);
        }
        expect(next.players.map(player => player.scores.points.parts)).toEqual([[4], [4]]);
        expect(session.players.map(player => player.scores.points.parts)).toEqual([[3], [7]]);
    });
});
