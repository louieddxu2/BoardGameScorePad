import { describe, expect, it } from 'vitest';
import { SelectorPlayer } from './types';
import {
    closeSelectorPlayerPalettes,
    getAnimatedDisplayPosition,
    getRetreatedDisplayPosition
} from './selectorDisplay';

const makePlayer = (overrides: Partial<SelectorPlayer> = {}): SelectorPlayer => ({
    id: 'player-1',
    linkedPlayerId: 'session-player-1',
    x: 200,
    y: 200,
    textRotationDeg: 0,
    text: 'Alice',
    color: '#ef4444',
    state: 'COLOR_PICKING',
    ...overrides
});

describe('selectorDisplay', () => {
    it('closes every player palette without moving seats or changing colors', () => {
        const players = [
            makePlayer({ id: 'player-1', x: 120, y: 180, state: 'COLOR_PICKING', color: '#ef4444' }),
            makePlayer({ id: 'player-2', x: 320, y: 380, state: 'READY', color: '#3b82f6' })
        ];

        const closedPlayers = closeSelectorPlayerPalettes(players);

        expect(closedPlayers).toEqual([
            { ...players[0], state: 'READY' },
            { ...players[1], state: 'READY' }
        ]);
        expect(closedPlayers[0].x).toBe(120);
        expect(closedPlayers[0].y).toBe(180);
        expect(closedPlayers[0].color).toBe('#ef4444');
    });

    it('retreats only the display position for players inside the center action area', () => {
        const player = makePlayer({ x: 200, y: 300, textRotationDeg: 90 });
        const displayPosition = getRetreatedDisplayPosition(player, { width: 400, height: 600 }, true);

        expect(displayPosition.y).toBeGreaterThan(player.y);
        expect(player.x).toBe(200);
        expect(player.y).toBe(300);
    });

    it('keeps display position unchanged outside result retreat mode', () => {
        const player = makePlayer({ x: 200, y: 300 });

        expect(getRetreatedDisplayPosition(player, { width: 400, height: 600 }, false)).toEqual({
            x: 200,
            y: 300
        });
    });


    it('eases display position toward the retreat target without mutating the player seat', () => {
        const player = makePlayer({ x: 100, y: 100 });
        const next = getAnimatedDisplayPosition(player, { x: 200, y: 100 }, undefined, true);

        expect(next.x).toBeCloseTo(118);
        expect(next.y).toBe(100);
        expect(player.x).toBe(100);
    });

    it('snaps animated display position when it is close enough to the target', () => {
        const player = makePlayer({ x: 100, y: 100 });

        expect(getAnimatedDisplayPosition(player, { x: 100.4, y: 100 }, { x: 100, y: 100 }, true)).toEqual({
            x: 100.4,
            y: 100
        });
    });
});
