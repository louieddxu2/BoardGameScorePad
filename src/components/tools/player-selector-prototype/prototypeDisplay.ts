import { PrototypePlayer } from './types';

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

export const closePrototypePlayerPalettes = (players: PrototypePlayer[]): PrototypePlayer[] => {
    return players.map(player => ({
        ...player,
        state: 'READY'
    }));
};

export const getRetreatedDisplayPosition = (
    player: PrototypePlayer,
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
