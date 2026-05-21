
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

import { classifyColumnFormula } from './templateUtils';

describe('高精度公式分類純函式測試 (Formula Classification)', () => {
    it('1. 應判定自動計算', () => {
        const col = { id: 'col1', isAuto: true, formula: 'a1+a2' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_auto');
        expect(res.textClass).toBe('text-violet-500');
    });

    it('2. 應判定按鈕多選', () => {
        const col = { id: 'col1', inputType: 'clicker', isMultiSelect: true };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_button_multi');
        expect(res.textClass).toBe('text-purple-500');
    });

    it('3. 應判定按鈕累加', () => {
        const col = { id: 'col1', inputType: 'clicker', isMultiSelect: false, formula: 'a1+next' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_button_addition');
        expect(res.textClass).toBe('text-fuchsia-500');
    });

    it('4. 應判定按鈕單選', () => {
        const col = { id: 'col1', inputType: 'clicker', isMultiSelect: false, formula: 'a1' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_button');
        expect(res.textClass).toBe('text-sky-500');
    });

    it('5. 應判定範圍查表', () => {
        const col1 = { id: 'col1', formula: 'f1(a1)' };
        const res1 = classifyColumnFormula(col1);
        expect(res1.formulaKey).toBe('formula_label_table');
        expect(res1.textClass).toBe('text-amber-500');

        const col2 = { id: 'col2', formula: 'a1', f1: [ { min: 0, score: 5 } ] };
        const res2 = classifyColumnFormula(col2);
        expect(res2.formulaKey).toBe('formula_label_table');
    });

    it('6. 應判定倍率扣分', () => {
        const col1 = { id: 'col1', formula: 'a1×c1', constants: { c1: -2 } };
        const res1 = classifyColumnFormula(col1);
        expect(res1.formulaKey).toBe('formula_label_subtraction');
        expect(res1.textClass).toBe('text-red-500');

        const col2 = { id: 'col2', formula: 'a1 - a2' };
        const res2 = classifyColumnFormula(col2);
        expect(res2.formulaKey).toBe('formula_label_subtraction');
    });

    it('7. 應判定相乘累加', () => {
        const col = { id: 'col1', formula: '(a1×a2)+next' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_product_addition');
        expect(res.textClass).toBe('text-indigo-500');
    });

    it('8. 應判定兩數相乘', () => {
        const col = { id: 'col1', formula: 'a1×a2' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_product');
        expect(res.textClass).toBe('text-purple-500');
    });

    it('9. 應判定分項累加', () => {
        const col = { id: 'col1', formula: 'a1+next' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_addition');
        expect(res.textClass).toBe('text-emerald-500');
    });

    it('10. 應判定固定倍率', () => {
        const col = { id: 'col1', formula: 'a1×c1', constants: { c1: 3 } };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_multiplier');
        expect(res.textClass).toBe('text-cyan-500');
    });

    it('11. 應判定直接輸入', () => {
        const col = { id: 'col1', formula: 'a1' };
        const res = classifyColumnFormula(col);
        expect(res.formulaKey).toBe('formula_label_plain');
        expect(res.textClass).toBe('text-txt-secondary');
    });
});

