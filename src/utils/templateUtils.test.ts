
import { describe, it, expect } from 'vitest';
import { calculateWinners } from './templateUtils';
import { Player } from '../types';

// Helper to create a mock player
const createPlayer = (id: string, totalScore: number, overrides: Partial<Player> = {}): Player => ({
    id,
    name: `Player ${id}`,
    color: 'red',
    scores: {},
    totalScore,
    ...overrides
});

describe('遊戲贏家計算測試 (Winner Calculation)', () => {
    
    describe('最高分獲勝 (HIGHEST_WINS)', () => {
        it('應選出最高分的玩家', () => {
            const players = [
                createPlayer('A', 10),
                createPlayer('B', 20),
                createPlayer('C', 15)
            ];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual(['B']);
        });

        it('平手時應選出所有最高分玩家', () => {
            const players = [
                createPlayer('A', 20),
                createPlayer('B', 20),
                createPlayer('C', 15)
            ];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual(['A', 'B']);
        });

        it('應考慮 Tie Breaker 標記', () => {
            const players = [
                createPlayer('A', 20),
                createPlayer('B', 20, { tieBreaker: true }),
                createPlayer('C', 15)
            ];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual(['B']);
        });

        it('多個玩家有 Tie Breaker 且平手時，應選出這些 Tie Breaker 玩家', () => {
            const players = [
                createPlayer('A', 20, { tieBreaker: true }),
                createPlayer('B', 20, { tieBreaker: true }),
                createPlayer('C', 20)
            ];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual(['A', 'B']);
        });
    });

    describe('最低分獲勝 (LOWEST_WINS)', () => {
        it('應選出最低分的玩家', () => {
            const players = [
                createPlayer('A', 10),
                createPlayer('B', 20),
                createPlayer('C', 15)
            ];
            expect(calculateWinners(players, 'LOWEST_WINS')).toEqual(['A']);
        });

        it('平手時應選出所有最低分玩家', () => {
            const players = [
                createPlayer('A', 10),
                createPlayer('B', 10),
                createPlayer('C', 15)
            ];
            expect(calculateWinners(players, 'LOWEST_WINS')).toEqual(['A', 'B']);
        });
    });

    describe('合作模式 (COOP)', () => {
        it('若無人強制落敗，則全員皆贏', () => {
            const players = [
                createPlayer('A', 10),
                createPlayer('B', 20)
            ];
            expect(calculateWinners(players, 'COOP')).toEqual(['A', 'B']);
        });

        it('若有人強制落敗，則全員不贏 (空陣列)', () => {
            const players = [
                createPlayer('A', 10),
                createPlayer('B', 20, { isForceLost: true })
            ];
            expect(calculateWinners(players, 'COOP')).toEqual([]);
        });
    });

    describe('強制落敗 (isForceLost)', () => {
        it('在競爭模式下，強制落敗的玩家不應成為贏家，即使分數最高', () => {
            const players = [
                createPlayer('A', 100, { isForceLost: true }),
                createPlayer('B', 50),
                createPlayer('C', 10)
            ];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual(['B']);
        });

        it('若所有玩家都強制落敗，贏家應為空', () => {
            const players = [
                createPlayer('A', 20, { isForceLost: true }),
                createPlayer('B', 20, { isForceLost: true })
            ];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual([]);
        });
    });

    describe('邊界案例 (Edge Cases)', () => {
        it('空玩家列表應回傳空贏家', () => {
            expect(calculateWinners([], 'HIGHEST_WINS')).toEqual([]);
        });
        
        it('單一玩家應預設為贏家', () => {
            const players = [createPlayer('A', 5)];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual(['A']);
        });

        it('單一玩家但強制落敗應回傳空', () => {
            const players = [createPlayer('A', 5, { isForceLost: true })];
            expect(calculateWinners(players, 'HIGHEST_WINS')).toEqual([]);
        });
    });
});
