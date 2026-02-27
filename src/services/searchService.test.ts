import { describe, it, expect } from 'vitest';
import { searchService } from './searchService';

describe('searchService 核心邏輯測試', () => {
    const mockGames = [
        { id: '1', name: 'Gloomhaven', _searchTokens: ['暗黑港', '幽港迷城', 'GH'] },
        { id: '2', name: 'Terraforming Mars', _searchTokens: ['殖民火星', 'TM'] },
        { id: '3', name: 'Brass: Birmingham', _searchTokens: ['黃銅：伯明翰', '工業革命'] },
    ];

    describe('tokenize 分詞系統', () => {
        it('應能正確分詞中文', () => {
            // 這是利用 searchWithMatches 內部的 tokenize 邏輯
            // 我們透過搜尋結果來間接驗證
            const results = searchService.search(mockGames, '火星', ['_searchTokens']);
            expect(results[0].name).toBe('Terraforming Mars');
        });

        it('應能處理空格與特殊連結號', () => {
            const results = searchService.search(mockGames, ' 伯明翰 ', ['_searchTokens']);
            expect(results[0].name).toBe('Brass: Birmingham');
        });
    });

    describe('searchWithMatches 別名命中提取', () => {
        it('別名精確命中時，應能回傳正確的匹配資訊', () => {
            const query = '幽港迷城';
            const results = searchService.searchWithMatches(mockGames, query, ['_searchTokens']);

            expect(results).toHaveLength(1);
            const firstMatch = results[0];

            // 驗證 Fuse 是否抓到了 matches
            expect(firstMatch.matches).toBeDefined();
            const searchTokenMatch = firstMatch.matches?.find(m => m.key === '_searchTokens');
            expect(searchTokenMatch).toBeDefined();

            // 在 hooks 中，我們會抓取這個 value:
            const matchedValue = searchTokenMatch?.value;
            expect(matchedValue).toBe('幽港迷城');
        });

        it('模糊匹配別名時，應仍能識別出對應的 Token', () => {
            // 故意打錯一個字，測試模糊搜尋
            const query = '幽港彌城';
            const results = searchService.searchWithMatches(mockGames, query, ['_searchTokens']);

            expect(results.length).toBeGreaterThan(0);
            const searchTokenMatch = results[0].matches?.find(m => m.key === '_searchTokens');
            expect(searchTokenMatch?.value).toBe('幽港迷城');
        });

        it('多欄位加權時，應優先回傳權重高的結果', () => {
            const keys = [
                { name: 'name', weight: 2 },
                { name: '_searchTokens', weight: 1 }
            ];
            // 搜尋 'Mars'，'name' 欄位有精確匹配，權重應更高
            const results = searchService.search(mockGames, 'Mars', keys);
            expect(results[0].name).toBe('Terraforming Mars');
        });
    });
});
