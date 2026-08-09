import { Player } from '../../types';

export type OrderRandomSource = () => number;

export const shufflePlayersAndAssignStarter = (
    players: Player[],
    rng: OrderRandomSource = Math.random
): Player[] => {
    const shuffledPlayers = [...players];

    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }

    return shuffledPlayers.map((player, index) => ({
        ...player,
        isStarter: index === 0
    }));
};
