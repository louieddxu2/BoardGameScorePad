export interface Candidate {
    id: string;
    name: string;
    linkedPlayerId?: string;
    suggestedColors?: string[];
}

export interface PrototypePlayer {
    id: string;
    text: string;
    linkedPlayerId?: string;
    x: number;
    y: number;
    textRotationDeg: number;
    color: string;
    state: 'COLOR_PICKING' | 'READY';
}

export interface PrototypeTurnOrderEntry {
    prototypePlayerId: string;
    order: number;
}
