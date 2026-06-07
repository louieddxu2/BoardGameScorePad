import { SelectorPlayer } from './types';

export const PLAYER_BOX_HALF_WIDTH = 43;
export const PLAYER_BOX_HALF_HEIGHT = 17;
export const COLOR_PALETTE_RADIUS = 64;
export const COLOR_PALETTE_HIT_RADIUS = 22;

const DELETE_HIT_HALF_WIDTH = 26;
const DELETE_HIT_TOP = -54;
const DELETE_HIT_BOTTOM = -30;
const HIDDEN_PALETTE_COLOR_INDICES = new Set([6]);

export interface Point {
    x: number;
    y: number;
}

export interface PlayerHitResult {
    handled: boolean;
    players: SelectorPlayer[];
}

export interface PaletteHitResult extends PlayerHitResult {
    color: string | null;
}

export const getPlayerLocalPoint = (player: SelectorPlayer, point: Point): Point => {
    const rad = -player.textRotationDeg * Math.PI / 180;
    const dx = point.x - player.x;
    const dy = point.y - player.y;

    return {
        x: dx * Math.cos(rad) - dy * Math.sin(rad),
        y: dx * Math.sin(rad) + dy * Math.cos(rad)
    };
};

export const isPlayerDeleteHit = (localPoint: Point): boolean => {
    return Math.abs(localPoint.x) <= DELETE_HIT_HALF_WIDTH &&
        localPoint.y >= DELETE_HIT_TOP &&
        localPoint.y <= DELETE_HIT_BOTTOM;
};

export const shouldRenderPaletteColor = (index: number): boolean => {
    return !HIDDEN_PALETTE_COLOR_INDICES.has(index);
};

export const isPlayerBodyHit = (localPoint: Point): boolean => {
    return Math.abs(localPoint.x) <= PLAYER_BOX_HALF_WIDTH &&
        Math.abs(localPoint.y) <= PLAYER_BOX_HALF_HEIGHT;
};

export const getPaletteColorAtLocalPoint = (localPoint: Point, palette: string[]): string | null => {
    for (let i = 0; i < palette.length; i++) {
        if (!shouldRenderPaletteColor(i)) continue;

        const angle = (i * 45) * Math.PI / 180;
        const dotX = Math.cos(angle) * COLOR_PALETTE_RADIUS;
        const dotY = Math.sin(angle) * COLOR_PALETTE_RADIUS;

        if (Math.hypot(localPoint.x - dotX, localPoint.y - dotY) <= COLOR_PALETTE_HIT_RADIUS) {
            return palette[i];
        }
    }

    return null;
};

export const applyPaletteClick = (
    players: SelectorPlayer[],
    point: Point,
    palette: string[]
): PaletteHitResult => {
    for (const player of players) {
        if (player.state !== 'COLOR_PICKING') continue;

        const color = getPaletteColorAtLocalPoint(getPlayerLocalPoint(player, point), palette);
        if (!color) continue;

        return {
            handled: true,
            color,
            players: players.map(candidate => candidate.id === player.id
                ? { ...candidate, color, state: 'READY' }
                : candidate
            )
        };
    }

    return { handled: false, color: null, players };
};

export const applyPlayerClick = (
    players: SelectorPlayer[],
    point: Point
): PlayerHitResult => {
    for (const player of players) {
        const localPoint = getPlayerLocalPoint(player, point);

        if (player.state === 'COLOR_PICKING' && isPlayerDeleteHit(localPoint)) {
            return {
                handled: true,
                players: players.filter(candidate => candidate.id !== player.id)
            };
        }

        if (isPlayerBodyHit(localPoint)) {
            return {
                handled: true,
                players: players.map(candidate => candidate.id === player.id
                    ? {
                        ...candidate,
                        state: candidate.state === 'COLOR_PICKING' ? 'READY' : 'COLOR_PICKING'
                    }
                    : candidate
                )
            };
        }
    }

    return { handled: false, players };
};
