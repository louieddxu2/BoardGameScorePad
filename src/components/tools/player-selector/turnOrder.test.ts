import { describe, expect, it } from 'vitest';
import { SelectorPlayer } from './types';
import { drawTurnOrder, getStarterSelectorPlayerId } from './turnOrder';

const makePlayer = (id: string, x: number): SelectorPlayer => ({
    id,
    text: id,
    linkedPlayerId: id,
    x,
    y: x + 10,
    textRotationDeg: 0,
    color: '#ef4444',
    state: 'READY'
});

describe('player selector prototype turn order', () => {
    it('draws one order entry per player and one starter', () => {
        const players = [makePlayer('a', 10), makePlayer('b', 20), makePlayer('c', 30)];
        const turnOrder = drawTurnOrder(players, () => 0);

        expect(turnOrder).toHaveLength(players.length);
        expect(new Set(turnOrder.map(entry => entry.prototypePlayerId)).size).toBe(players.length);
        expect(turnOrder.map(entry => entry.order).sort()).toEqual([1, 2, 3]);
        expect(getStarterSelectorPlayerId(turnOrder)).toBeDefined();
    });

    it('does not mutate player identity, color, or seat positions', () => {
        const players = [makePlayer('a', 10), makePlayer('b', 20), makePlayer('c', 30)];
        const before = structuredClone(players);

        drawTurnOrder(players, () => 0.99);

        expect(players).toEqual(before);
    });

    it('can redraw order without changing the players array', () => {
        const players = [makePlayer('a', 10), makePlayer('b', 20), makePlayer('c', 30)];
        const before = structuredClone(players);

        const first = drawTurnOrder(players, () => 0);
        const second = drawTurnOrder(players, () => 0.99);

        expect(players).toEqual(before);
        expect(second).not.toEqual(first);
    });
});

