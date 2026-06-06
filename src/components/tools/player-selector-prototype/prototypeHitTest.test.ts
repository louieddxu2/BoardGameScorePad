import { describe, expect, it } from 'vitest';
import { PrototypePlayer } from './types';
import {
    applyPaletteClick,
    applyPlayerClick,
    COLOR_PALETTE_RADIUS,
    getPlayerLocalPoint,
    isPlayerBodyHit,
    isPlayerDeleteHit
} from './prototypeHitTest';

const makePlayer = (overrides: Partial<PrototypePlayer> = {}): PrototypePlayer => ({
    id: 'player-1',
    text: 'Alice',
    x: 100,
    y: 100,
    textRotationDeg: 0,
    color: '#ef4444',
    state: 'READY',
    ...overrides
});

describe('prototypeHitTest', () => {
    it('transforms a screen point into player-local coordinates', () => {
        const point = getPlayerLocalPoint(makePlayer({ textRotationDeg: 90 }), { x: 100, y: 120 });

        expect(point.x).toBeCloseTo(20);
        expect(point.y).toBeCloseTo(0);
    });

    it('detects body and delete hit regions independently', () => {
        expect(isPlayerBodyHit({ x: 0, y: 0 })).toBe(true);
        expect(isPlayerBodyHit({ x: 60, y: 0 })).toBe(false);
        expect(isPlayerDeleteHit({ x: 0, y: 28 })).toBe(true);
        expect(isPlayerDeleteHit({ x: 0, y: 50 })).toBe(false);
    });

    it('selects a palette color and closes the player palette', () => {
        const palette = ['#111111', '#222222'];
        const players = [makePlayer({ state: 'COLOR_PICKING', color: '#111111' })];

        const result = applyPaletteClick(players, { x: 100 + COLOR_PALETTE_RADIUS, y: 100 }, palette);

        expect(result.handled).toBe(true);
        expect(result.color).toBe('#111111');
        expect(result.players[0]).toMatchObject({
            color: '#111111',
            state: 'READY'
        });
    });

    it('deletes a color-picking player from the lower delete control', () => {
        const players = [
            makePlayer({ id: 'player-1', state: 'COLOR_PICKING' }),
            makePlayer({ id: 'player-2' })
        ];

        const result = applyPlayerClick(players, { x: 100, y: 128 });

        expect(result.handled).toBe(true);
        expect(result.players.map(player => player.id)).toEqual(['player-2']);
    });

    it('toggles the player color palette from the name body', () => {
        const result = applyPlayerClick([makePlayer()], { x: 100, y: 100 });

        expect(result.handled).toBe(true);
        expect(result.players[0].state).toBe('COLOR_PICKING');
    });
});
