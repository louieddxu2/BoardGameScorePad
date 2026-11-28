import { SelectorPlayer } from './types';
import { COLORS } from '../../../colors';
import type { Player } from '../../../types';

export const PLAYER_BOX_HALF_WIDTH = 43;
export const PLAYER_BOX_HALF_HEIGHT = 17;
export const COLOR_PALETTE_RADIUS = 64;
export const COLOR_PALETTE_HIT_RADIUS = 22;

const DELETE_HIT_HALF_WIDTH = 26;
const DELETE_HIT_TOP = -54;
const DELETE_HIT_BOTTOM = -30;

// 調色盤槽位優先順序：正下方(90°) -> 右下(45°) -> 左下(135°) -> 右(0°) -> 左(180°) -> 右上(315°) -> 左上(225°)
// 每個值是原始 8 格調色盤的 index (角度 = index * 45°)
export const SLOT_INDICES = [2, 1, 3, 0, 4, 7, 5];

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

export const getPlayerLocalPoint = (
    player: SelectorPlayer,
    point: Point,
    displayPos?: Point
): Point => {
    const targetX = displayPos ? displayPos.x : player.x;
    const targetY = displayPos ? displayPos.y : player.y;
    const rad = -player.textRotationDeg * Math.PI / 180;
    const dx = point.x - targetX;
    const dy = point.y - targetY;

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

export const isPlayerBodyHit = (localPoint: Point): boolean => {
    return Math.abs(localPoint.x) <= PLAYER_BOX_HALF_WIDTH &&
        Math.abs(localPoint.y) <= PLAYER_BOX_HALF_HEIGHT;
};

/**
 * 決定器的新選擇會取代同一位玩家原先在計分板選的顏色。
 */
const getAvailableColors = (
    preferredColors: string[] | undefined,
    currentPlayers: SelectorPlayer[],
    sessionPlayers: Player[],
    currentPlayerId?: string
): string[] => {
    const assignedIds = new Set<string>();
    const reservedColors = new Set<string>();
    for (const player of currentPlayers) {
        if (player.sessionPlayerId) assignedIds.add(player.sessionPlayerId);
        if (player.id !== currentPlayerId && player.isColorManuallySet) reservedColors.add(player.color);
    }
    for (const player of sessionPlayers) {
        if (player.isColorManuallySet && !assignedIds.has(player.id)) reservedColors.add(player.color);
    }
    const sourceColors = preferredColors && preferredColors.length > 0 ? preferredColors : COLORS;
    return sourceColors.filter(color => color !== 'transparent' && !reservedColors.has(color));
};

export const getPlayerPaletteColors = (
    preferredColors: string[] | undefined,
    currentPlayers: SelectorPlayer[],
    currentPlayerId: string,
    sessionPlayers: Player[] = []
): string[] => {
    const available = getAvailableColors(preferredColors, currentPlayers, sessionPlayers, currentPlayerId);
    const palette = available.slice(0, SLOT_INDICES.length);
    const currentColor = currentPlayers.find(player => player.id === currentPlayerId)?.color;
    // An automatic color can sit beyond the first seven suggestions in a larger group.
    if (currentColor && available.includes(currentColor) && !palette.includes(currentColor)) {
        palette[palette.length - 1] = currentColor;
    }
    return palette;
};

export const getInitialSelectorColor = (
    preferredColors: string[] | undefined,
    currentPlayers: SelectorPlayer[],
    sessionPlayers: Player[]
): string | undefined => {
    const available = getAvailableColors(preferredColors, currentPlayers, sessionPlayers);
    const usedColors = new Set(currentPlayers.map(player => player.color));
    return available.find(color => !usedColors.has(color)) ?? available[0];
};

/**
 * 判定本地座標系中的點擊是否命中動態調色盤的某一個顏色圓點
 */
export const getPaletteColorAtLocalPoint = (localPoint: Point, paletteColors: string[]): string | null => {
    for (let idx = 0; idx < paletteColors.length; idx++) {
        const slotIndex = SLOT_INDICES[idx];
        const angle = (slotIndex * 45) * Math.PI / 180;
        const dotX = Math.cos(angle) * COLOR_PALETTE_RADIUS;
        const dotY = Math.sin(angle) * COLOR_PALETTE_RADIUS;

        if (Math.hypot(localPoint.x - dotX, localPoint.y - dotY) <= COLOR_PALETTE_HIT_RADIUS) {
            return paletteColors[idx];
        }
    }

    return null;
};

export const applyPaletteClick = (
    players: SelectorPlayer[],
    point: Point,
    displayPositions?: Map<string, Point>,
    sessionPlayers?: Player[]
): PaletteHitResult => {
    for (const player of players) {
        if (player.state !== 'COLOR_PICKING') continue;

        const paletteColors = getPlayerPaletteColors(player.suggestedColors, players, player.id, sessionPlayers);
        const displayPos = displayPositions?.get(player.id);
        const color = getPaletteColorAtLocalPoint(getPlayerLocalPoint(player, point, displayPos), paletteColors);
        if (!color) continue;

        return {
            handled: true,
            color,
            players: players.map(candidate => candidate.id === player.id
                ? { ...candidate, color, isColorManuallySet: true, state: 'READY' as const }
                : candidate
            )
        };
    }

    return { handled: false, color: null, players };
};

export const applyPlayerClick = (
    players: SelectorPlayer[],
    point: Point,
    displayPositions?: Map<string, Point>
): PlayerHitResult => {
    for (const player of players) {
        const displayPos = displayPositions?.get(player.id);
        const localPoint = getPlayerLocalPoint(player, point, displayPos);

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
                        state: candidate.state === 'COLOR_PICKING' ? 'READY' as const : 'COLOR_PICKING' as const
                    }
                    : candidate
                )
            };
        }
    }

    return { handled: false, players };
};
