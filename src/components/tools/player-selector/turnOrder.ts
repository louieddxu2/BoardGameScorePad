import { SelectorPlayer, SelectorTurnOrderEntry } from './types';

export type RandomSource = () => number;

export const drawTurnOrder = (
    players: SelectorPlayer[],
    rng: RandomSource = Math.random
): SelectorTurnOrderEntry[] => {
    const shuffledIds = players.map(player => player.id);

    for (let i = shuffledIds.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }

    return shuffledIds.map((prototypePlayerId, index) => ({
        prototypePlayerId,
        order: index + 1
    }));
};

export const getStarterSelectorPlayerId = (
    turnOrder: SelectorTurnOrderEntry[]
): string | undefined => turnOrder.find(entry => entry.order === 1)?.prototypePlayerId;

