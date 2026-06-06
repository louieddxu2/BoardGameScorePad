import { PrototypePlayer, PrototypeTurnOrderEntry } from './types';

export type RandomSource = () => number;

export const drawTurnOrder = (
    players: PrototypePlayer[],
    rng: RandomSource = Math.random
): PrototypeTurnOrderEntry[] => {
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

export const getStarterPrototypePlayerId = (
    turnOrder: PrototypeTurnOrderEntry[]
): string | undefined => turnOrder.find(entry => entry.order === 1)?.prototypePlayerId;

