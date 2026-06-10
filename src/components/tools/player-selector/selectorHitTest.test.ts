import { describe, expect, it } from 'vitest';
import { SelectorPlayer } from './types';
import {
    applyPaletteClick,
    applyPlayerClick,
    COLOR_PALETTE_RADIUS,
    getPlayerLocalPoint,
    isPlayerBodyHit,
    isPlayerDeleteHit
} from './selectorHitTest';

const makePlayer = (overrides: Partial<SelectorPlayer> = {}): SelectorPlayer => ({
    id: 'player-1',
    text: 'Alice',
    x: 100,
    y: 100,
    textRotationDeg: 0,
    color: '#ef4444',
    state: 'READY',
    ...overrides
});

describe('selectorHitTest', () => {
    it('transforms a screen point into player-local coordinates', () => {
        const point = getPlayerLocalPoint(makePlayer({ textRotationDeg: 90 }), { x: 100, y: 120 });

        expect(point.x).toBeCloseTo(20);
        expect(point.y).toBeCloseTo(0);
    });

    it('detects body and delete hit regions independently', () => {
        expect(isPlayerBodyHit({ x: 0, y: 0 })).toBe(true);
        expect(isPlayerBodyHit({ x: 60, y: 0 })).toBe(false);
        expect(isPlayerDeleteHit({ x: 0, y: -42 })).toBe(true);
        expect(isPlayerDeleteHit({ x: 0, y: 28 })).toBe(false);
    });

    it('selects a palette color and closes the player palette', () => {
        const players = [makePlayer({ state: 'COLOR_PICKING', color: '#ef4444' })];

        // 正下方 (90°) 是第一推薦色，角度 90° 對應 local y = +RADIUS
        const result = applyPaletteClick(players, { x: 100, y: 100 + COLOR_PALETTE_RADIUS });

        expect(result.handled).toBe(true);
        // 第一推薦色是 COLORS[0] = 'rgb(var(--c-p-emerald))'（自身顏色 #ef4444 不在 COLORS 中，所以不排除）
        expect(result.color).toBe('rgb(var(--c-p-emerald))');
        expect(result.players[0]).toMatchObject({
            color: 'rgb(var(--c-p-emerald))',
            state: 'READY'
        });
    });

    it('does not select a color at the hidden top slot (270° / index 6)', () => {
        const players = [makePlayer({ state: 'COLOR_PICKING', color: '#ef4444' })];

        // 正上方 (270°) 是刪除按鈕位置，不應該有調色盤圓點
        const result = applyPaletteClick(players, { x: 100, y: 100 - COLOR_PALETTE_RADIUS });

        expect(result.handled).toBe(false);
        expect(result.players[0].state).toBe('COLOR_PICKING');
    });

    it('keeps the hidden palette gap above the rotated player name', () => {
        const players = [makePlayer({ state: 'COLOR_PICKING', textRotationDeg: 90, color: '#ef4444' })];

        // 旋轉 90° 後，正上方在螢幕上變為正右方，那個位置不應有調色盤圓點
        const result = applyPaletteClick(players, { x: 100 + COLOR_PALETTE_RADIUS, y: 100 });

        expect(result.handled).toBe(false);
        expect(result.players[0].state).toBe('COLOR_PICKING');
    });

    it('deletes a color-picking player from the upper delete control', () => {
        const players = [
            makePlayer({ id: 'player-1', state: 'COLOR_PICKING' }),
            makePlayer({ id: 'player-2' })
        ];

        const result = applyPlayerClick(players, { x: 100, y: 58 });

        expect(result.handled).toBe(true);
        expect(result.players.map(player => player.id)).toEqual(['player-2']);
    });

    it('toggles the player color palette from the name body', () => {
        const result = applyPlayerClick([makePlayer()], { x: 100, y: 100 });

        expect(result.handled).toBe(true);
        expect(result.players[0].state).toBe('COLOR_PICKING');
    });
});
