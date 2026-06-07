import { SelectorPlayer } from './types';

export interface DisplayBounds {
    width: number;
    height: number;
}

export interface DisplayPoint {
    x: number;
    y: number;
}

const CENTER_CLEAR_RADIUS = 158;
const CENTER_CLEAR_GUTTER = 22;
const EDGE_MARGIN = 76;
const RETREAT_POSITION_EASE = 0.18;
const RETREAT_POSITION_SNAP_DIST = 0.6;

export const closeSelectorPlayerPalettes = (players: SelectorPlayer[]): SelectorPlayer[] => {
    return players.map(player => ({
        ...player,
        state: 'READY'
    }));
};

export const getRetreatedDisplayPosition = (
    player: SelectorPlayer,
    bounds: DisplayBounds,
    shouldRetreat: boolean
): DisplayPoint => {
    if (!shouldRetreat) {
        return { x: player.x, y: player.y };
    }

    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const dx = player.x - centerX;
    const dy = player.y - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance >= CENTER_CLEAR_RADIUS) {
        return { x: player.x, y: player.y };
    }

    const fallbackAngle = player.textRotationDeg * Math.PI / 180;
    const directionX = distance > 0.1 ? dx / distance : Math.cos(fallbackAngle);
    const directionY = distance > 0.1 ? dy / distance : Math.sin(fallbackAngle);
    const targetDistance = CENTER_CLEAR_RADIUS + CENTER_CLEAR_GUTTER;

    return {
        x: Math.min(Math.max(centerX + directionX * targetDistance, EDGE_MARGIN), bounds.width - EDGE_MARGIN),
        y: Math.min(Math.max(centerY + directionY * targetDistance, EDGE_MARGIN), bounds.height - EDGE_MARGIN)
    };
};

export const getBadgeTextRotation = (playerRotationDeg: number, desiredScreenRotationDeg: number): number => {
    return desiredScreenRotationDeg - playerRotationDeg;
};

export const getAnimatedDisplayPosition = (
    player: SelectorPlayer,
    targetPosition: DisplayPoint,
    currentPosition: DisplayPoint | undefined,
    shouldAnimate: boolean
): DisplayPoint => {
    if (!shouldAnimate) {
        return targetPosition;
    }

    const origin = currentPosition || { x: player.x, y: player.y };
    const dx = targetPosition.x - origin.x;
    const dy = targetPosition.y - origin.y;

    if (Math.hypot(dx, dy) <= RETREAT_POSITION_SNAP_DIST) {
        return targetPosition;
    }

    return {
        x: origin.x + dx * RETREAT_POSITION_EASE,
        y: origin.y + dy * RETREAT_POSITION_EASE
    };
};
