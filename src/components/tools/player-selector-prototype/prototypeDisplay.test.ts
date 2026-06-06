import { describe, expect, it } from 'vitest';
import { PrototypePlayer } from './types';
import {
    closePrototypePlayerPalettes,
    getBadgeTextRotation,
    getRetreatedDisplayPosition
} from './prototypeDisplay';

const makePlayer = (overrides: Partial<PrototypePlayer> = {}): PrototypePlayer => ({
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

describe('prototypeDisplay', () => {
    it('closes every player palette without moving seats or changing colors', () => {
        const players = [
            makePlayer({ id: 'player-1', x: 120, y: 180, state: 'COLOR_PICKING', color: '#ef4444' }),
            makePlayer({ id: 'player-2', x: 320, y: 380, state: 'READY', color: '#3b82f6' })
        ];

        const closedPlayers = closePrototypePlayerPalettes(players);

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

    it('counter-rotates badge text to the requested screen direction', () => {
        expect(getBadgeTextRotation(30, 180)).toBe(150);
        expect(getBadgeTextRotation(-45, 90)).toBe(135);
    });
});
