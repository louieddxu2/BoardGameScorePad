import { describe, expect, it, vi } from 'vitest';
import type { GameSession, GameTemplate } from '../types';
import * as scoring from './scoring';
import { applyTemplateToSession } from './sessionTemplateUpdate';

describe('template attribute updates', () => {
    it('migrates single/multi selections in both directions and refreshes identity, totals and winners without mutating input', () => {
        const oldTemplate: GameTemplate = {
            id: 'old-template', name: 'Old', createdAt: 1,
            columns: [
                { id: 'to-multi', name: 'Multi', formula: 'a1', inputType: 'clicker', isScoring: true,
                    quickActions: [{ id: 'a', label: 'A', value: 3 }] },
                { id: 'to-single', name: 'Single', formula: 'a1', inputType: 'clicker', isScoring: true, isMultiSelect: true,
                    quickActions: [{ id: 'b', label: 'B', value: 5 }, { id: 'c', label: 'C', value: 2 }] }
            ]
        };
        const session: GameSession = {
            id: 'session', templateId: oldTemplate.id, name: 'Old', startTime: 1, status: 'active',
            scoringRule: 'HIGHEST_WINS', winnerIds: ['p2'],
            players: [
                { id: 'p1', name: 'Alice', color: '#ff0000', totalScore: 0,
                    scores: { 'to-multi': { parts: [3], optionId: 'a' }, 'to-single': { parts: [7], multiOptionIds: ['b', 'c'] } } },
                { id: 'p2', name: 'Bob', color: '#0000ff', totalScore: 99, scores: {} }
            ]
        };
        const nextTemplate: GameTemplate = {
            ...oldTemplate, id: 'new-template', name: 'Updated', bggId: '42',
            columns: oldTemplate.columns.map(col => ({ ...col, isMultiSelect: col.id === 'to-multi' }))
        };
        const original = JSON.stringify({ session, oldTemplate, nextTemplate });
        const next = applyTemplateToSession(session, oldTemplate, nextTemplate);
        expect(next).toMatchObject({
            id: 'session', templateId: 'new-template', name: 'Updated', bggId: '42', winnerIds: ['p1'],
            players: [
                { totalScore: 8, scores: { 'to-multi': { multiOptionIds: ['a'] }, 'to-single': { optionId: 'b' } } },
                { totalScore: 0, scores: {} }
            ]
        });
        expect(next.players[1].scores).toBe(session.players[1].scores);
        expect(next.lastUpdatedAt).toBeGreaterThan(1);
        expect(JSON.stringify({ session, oldTemplate, nextTemplate })).toBe(original);
    });

    it('uses fully migrated players for cross-player sums and ranks in both selection-mode directions', () => {
        const calculate = vi.spyOn(scoring, 'calculatePlayerTotal');
        try {
            for (const wasMultiSelect of [false, true]) {
                const oldTemplate: GameTemplate = {
                    id: 'template', name: 'Cross-player scoring', createdAt: 1,
                    columns: [
                        { id: 'choice', name: 'Choice', formula: 'a1', inputType: 'clicker', isScoring: false,
                            isMultiSelect: wasMultiSelect,
                            quickActions: [{ id: 'a', label: 'A', value: 10 }, { id: 'b', label: 'B', value: 5 }] },
                        { id: 'sum', name: 'Sum', formula: 'x', inputType: 'auto', isAuto: true, isScoring: true,
                            variableMap: { x: { id: 'choice', name: 'Choice', mode: 'sum_all' } } },
                        { id: 'rank', name: 'Rank points', formula: '3-x', inputType: 'auto', isAuto: true, isScoring: true,
                            variableMap: { x: { id: 'choice', name: 'Choice', mode: 'rank_score' } } }
                    ]
                };
                const session: GameSession = {
                    id: 'session', templateId: oldTemplate.id, name: oldTemplate.name, startTime: 1, status: 'active',
                    scoringRule: 'HIGHEST_WINS', winnerIds: ['p2'], lastUpdatedAt: 17,
                    players: [
                        // A's option value changed from 3 to 10 after the input was recorded.
                        { id: 'p1', name: 'Alice', color: '#ff0000', totalScore: 99,
                            scores: { choice: { parts: [3], ...(wasMultiSelect ? { multiOptionIds: ['a'] } : { optionId: 'a' }) } } },
                        { id: 'p2', name: 'Bob', color: '#0000ff', totalScore: 99,
                            scores: { choice: { parts: [5], ...(wasMultiSelect ? { multiOptionIds: ['b'] } : { optionId: 'b' }) } } }
                    ]
                };
                const nextTemplate: GameTemplate = {
                    ...oldTemplate,
                    columns: oldTemplate.columns.map(col => col.id === 'choice'
                        ? { ...col, isMultiSelect: !wasMultiSelect } : col)
                };
                const original = JSON.stringify({ session, oldTemplate, nextTemplate });
                calculate.mockClear();

                const next = applyTemplateToSession(session, oldTemplate, nextTemplate);

                // Sum is 15 for both players; rank points are 2 for Alice and 1 for Bob.
                expect(next.players.map(player => player.totalScore)).toEqual([17, 16]);
                expect(next.winnerIds).toEqual(['p1']);
                expect(next.players[0].scores.choice).toMatchObject(wasMultiSelect
                    ? { optionId: 'a' } : { multiOptionIds: ['a'] });
                expect(calculate).toHaveBeenCalledTimes(2); // Each player's total is derived once.
                expect(next.lastUpdatedAt).toBeGreaterThan(17);
                expect(JSON.stringify({ session, oldTemplate, nextTemplate })).toBe(original);
            }
        } finally {
            calculate.mockRestore();
        }
    });
});
