import { describe, it, expect } from 'vitest';
import { injectSoftHyphens } from './text';

const SHY = '\u00AD';

/** 移除所有軟連字號，還原原始文字 */
const stripShy = (s: string) => s.replace(new RegExp(SHY, 'g'), '');

describe('injectSoftHyphens', () => {
    it('短單字（< 5 字母）不插入軟連字號', () => {
        expect(injectSoftHyphens('Cats')).toBe('Cats');
        expect(injectSoftHyphens('Elk')).toBe('Elk');
        expect(injectSoftHyphens('Pigs')).toBe('Pigs');
    });

    it('長單字包含軟連字號', () => {
        const result = injectSoftHyphens('Emigrations');
        expect(result).toContain(SHY);
    });

    it('去掉軟連字號後等於原始輸入（不裁切字尾）', () => {
        const words = [
            'strength', 'Emigrations', 'Fromagerie', 'Harbourmaster',
            'Exploration', 'Discoveries', 'Financiers', 'Specialists',
            'Buildings', 'Vegetables', 'Plantations', 'Connections',
            'Milestones', 'Storehouses', 'Trailblazers', 'Pathfinder',
        ];
        for (const word of words) {
            expect(stripShy(injectSoftHyphens(word))).toBe(word);
        }
    });

    it('非英文字元不受影響', () => {
        expect(injectSoftHyphens('探索板塊')).toBe('探索板塊');
        expect(injectSoftHyphens('田地數量')).toBe('田地數量');
    });

    it('含換行的混合文字中英文各自處理', () => {
        const input = 'Exploration\nBoards';
        const result = injectSoftHyphens(input);
        expect(result).toContain('\n');
        expect(stripShy(result)).toBe(input);
    });

    it('空字串與 falsy 值原樣返回', () => {
        expect(injectSoftHyphens('')).toBe('');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(injectSoftHyphens(null as any)).toBe(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(injectSoftHyphens(undefined as any)).toBe(undefined);
    });

    it('多個單字的句子各自正確處理', () => {
        const input = 'Active Employees';
        const result = injectSoftHyphens(input);
        // "Active" 有 6 個字母，應該被處理
        expect(stripShy(result)).toBe(input);
        // 空格保留
        expect(result).toContain(' ');
    });
});
