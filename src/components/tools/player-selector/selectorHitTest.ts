import { SelectorPlayer } from './types';

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

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

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

export const isPlayerBodyHit = (localPoint: Point): boolean => {
    return Math.abs(localPoint.x) <= PLAYER_BOX_HALF_WIDTH &&
        Math.abs(localPoint.y) <= PLAYER_BOX_HALF_HEIGHT;
};

/**
 * 計算某位玩家當前可用的調色盤推薦色（排除被其他玩家選走的顏色，最多 7 色）
 */
export const getPlayerPaletteColors = (
    preferredColors: string[] | undefined,
    currentPlayers: SelectorPlayer[],
    currentPlayerId: string
): string[] => {
    const otherSelectedColors = new Set(
        currentPlayers
            .filter(p => p.id !== currentPlayerId)
            .map(p => p.color)
    );

    const availableColors: string[] = [];

    // 1. 優先加入未被佔用的偏好顏色
    if (preferredColors) {
        preferredColors.forEach(color => {
            if (!otherSelectedColors.has(color) && color !== 'transparent') {
                availableColors.push(color);
            }
        });
    }

    // 2. 補充預設調色盤中未被佔用的顏色
    PALETTE.forEach(color => {
        if (!availableColors.includes(color) && !otherSelectedColors.has(color)) {
            availableColors.push(color);
        }
    });

    return availableColors.slice(0, 7);
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
    point: Point
): PaletteHitResult => {
    for (const player of players) {
        if (player.state !== 'COLOR_PICKING') continue;

        const paletteColors = getPlayerPaletteColors(player.suggestedColors, players, player.id);
        const color = getPaletteColorAtLocalPoint(getPlayerLocalPoint(player, point), paletteColors);
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
                        state: candidate.state === 'COLOR_PICKING' ? 'READY' as const : 'COLOR_PICKING' as const
                    }
                    : candidate
                )
            };
        }
    }

    return { handled: false, players };
};
