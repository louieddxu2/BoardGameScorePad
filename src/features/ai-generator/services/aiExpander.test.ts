import { describe, it, expect } from 'vitest';
import { inflateGameTemplate } from './aiExpander';

describe('aiExpander - inflateGameTemplate', () => {
    it('應該能正確將純陣列膨脹為包含 columns 的物件', () => {
        const mockAiOutput = [
            { name: "當前分數", formula: "x" },
            { name: "工人", formula: "3x" }
        ];

        const result = inflateGameTemplate(mockAiOutput);

        expect(result).toHaveProperty('columns');
        expect(Array.isArray(result.columns)).toBe(true);
        expect(result.columns!).toHaveLength(2);
        expect(result.columns![1].formula).toBe('a1×c1');
        expect(result.columns![1].constants).toEqual({ c1: 3 });
    });

    it('應該保留原有的物件結構 (向下相容)', () => {
        const mockAiOutput = {
            name: "舊格式測試",
            columns: [
                { name: "分數", formula: "x" }
            ]
        };

        const result = inflateGameTemplate(mockAiOutput);

        expect(result.name).toBe("舊格式測試");
        expect(result.columns!).toHaveLength(1);
    });

    it('應該自動補全預設計分規則', () => {
        const mockAiOutput = [{ name: "測試", formula: "x" }];
        const result = inflateGameTemplate(mockAiOutput);

        expect(result.defaultScoringRule).toBe('HIGHEST_WINS');
    });

    it('應該能處理複雜的進階公式陣列', () => {
        const mockAiOutput = [
            { name: "地形", formula: "xy", subUnits: ["格", "冠"] },
            { name: "卡片", formula: "lookup[1->1, 3->5, +1->2]" },
            { name: "是按鈕嗎", formula: "buttons['是'->10, '否'->0]" }
        ];

        const result = inflateGameTemplate(mockAiOutput);
        const cols = result.columns!;

        // xy 測試
        expect(cols[0].formula).toBe('a1×a2');
        expect(cols[0].subUnits).toEqual(["格", "冠"]);

        // lookup 測試
        expect(cols[1].formula).toBe('f1(a1)');
        expect(cols[1].f1).toHaveLength(3);
        expect(cols[1].f1![2].isLinear).toBe(true);

        // buttons 測試
        expect(cols[2].inputType).toBe('clicker');
        expect(cols[2].quickActions).toHaveLength(2);
        expect(cols[2].quickActions![0].label).toBe('是');
    });

    it('應該能處理 Formula 8 buttons[...]+next 累加按鈕與增益微調按鈕', () => {
        const mockAiOutput = [
            { name: "累加按鈕", formula: "buttons['1~5'->0, '6~8'->1,'9~10'->3]+next" },
            { name: "增益微調", formula: "buttons['3隻'->8,'4隻'->11,'4+?隻'->+5]+next" }
        ];

        const result = inflateGameTemplate(mockAiOutput);
        const cols = result.columns!;

        // 累加按鈕測試
        expect(cols[0].inputType).toBe('clicker');
        expect(cols[0].formula).toBe('a1+next');
        expect(cols[0].quickActions).toHaveLength(3);
        expect(cols[0].quickActions![0].label).toBe('1~5');
        expect(cols[0].quickActions![0].value).toBe(0);
        expect(cols[0].quickActions![0].isModifier).toBe(false);

        // 增益微調測試
        expect(cols[1].inputType).toBe('clicker');
        expect(cols[1].formula).toBe('a1+next');
        expect(cols[1].quickActions).toHaveLength(3);
        expect(cols[1].quickActions![2].label).toBe('4+?隻');
        expect(cols[1].quickActions![2].value).toBe(5);
        expect(cols[1].quickActions![2].isModifier).toBe(true);
    });
});
