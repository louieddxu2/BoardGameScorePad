import { Candidate } from './types';

export interface TouchState {
    id: string | number;
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
    canvasX: number;
    canvasY: number;
    anchorX: number;
    anchorY: number;
    radiusX: number;
    radiusY: number;
    rotationAngle: number;
    state: 'CHOOSING' | 'LOCKED';
    spawnTime: number;
    selectedOptionId: number | null;
    selectionStartTime: number;
    optionsFrozen: boolean;
    progress: number;
    forwardAngleRad: number;
    humanAngleRad: number;
    textRotationDeg: number;
}

export interface OptionState {
    id: number;
    touchId: string | number;
    idx: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    frozenX: number | null;
    frozenY: number | null;
    text: string;
    color: string;
    candidate: Candidate;
}
