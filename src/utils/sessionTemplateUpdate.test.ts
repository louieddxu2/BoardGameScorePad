import { describe, expect, it } from 'vitest';
import type { GameSession, GameTemplate } from '../types';
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
});
