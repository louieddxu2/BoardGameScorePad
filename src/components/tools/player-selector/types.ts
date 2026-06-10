export interface Candidate {
    id: string;
    name: string;
    linkedPlayerId?: string;
    suggestedColors?: string[];
}

export interface SelectorPlayer {
    id: string;
    text: string;
    linkedPlayerId?: string;
    touchId?: string | number;
    suggestedColors?: string[];
    x: number;
    y: number;
    textRotationDeg: number;
    color: string;
    state: 'COLOR_PICKING' | 'READY';
}

export interface SelectorTurnOrderEntry {
    prototypePlayerId: string;
    order: number;
}
