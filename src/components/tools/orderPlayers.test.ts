import { describe, expect, it } from 'vitest';
import { Player } from '../../types';
import { shufflePlayersAndAssignStarter } from './orderPlayers';

const makePlayer = (
    id: string,
    overrides: Partial<Player> = {}
): Player => ({
    id,
    name: id,
    color: '#fff',
    scores: {},
    totalScore: 0,
    ...overrides
});

describe('shufflePlayersAndAssignStarter', () => {
    it('does not mutate source players and preserves manual identity state', () => {
        const players = [
            makePlayer('a', { isStarter: true, isIdentityManuallySet: true }),
            makePlayer('b', { isIdentityManuallySet: false }),
            makePlayer('c')
        ];

        const result = shufflePlayersAndAssignStarter(players, () => 0);

        expect(result.map(player => player.id)).toEqual(['b', 'c', 'a']);
        expect(result.map(player => player.isStarter)).toEqual([true, false, false]);
        expect(result.find(player => player.id === 'a')?.isIdentityManuallySet).toBe(true);
        expect(result.find(player => player.id === 'b')?.isIdentityManuallySet).toBe(false);
        expect(players.map(player => player.isStarter)).toEqual([true, undefined, undefined]);
        expect(result.every(player => !players.includes(player))).toBe(true);
    });
});
