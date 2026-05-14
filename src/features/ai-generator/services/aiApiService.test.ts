import { describe, it, expect, vi } from 'vitest';
import { callAiScoreboardApi } from './aiApiService';

describe('aiApiService - callAiScoreboardApi Expansion Logic', () => {
  it('should correctly expand AI response to match built-in template standards', async () => {
    // 模擬 AI 回傳極簡數據 (與農家樂結構相似)
    const mockAiData = {
      name: 'Agricola Style',
      columns: [
        { 
          name: '農田', 
          formula: 'f1(a1)', 
          functions: { f1: '[0,2,3,4,5]>[-1,1,2,3,4]' } 
        },
        { 
          name: '未使用空間', 
          formula: 'a1×(-1)' 
        }
      ]
    };

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ 
        data: mockAiData,
        usage: { totalTokenCount: 100 }
      })
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await callAiScoreboardApi([], 'Agricola', 'zh-TW');
    const template = result.template;

    // 🚩 驗證 1: f1 應該被提升至根目錄
    const fieldCol = template.columns![0];
    expect(fieldCol.f1).toBeDefined();

    // 🚩 驗證 2: 對齊內建標準，自引用公式不應產生 variableMap
    expect(fieldCol.variableMap).toBeUndefined();

    // 🚩 驗證 3: 自引用欄位不應該是 isAuto，且多餘屬性應被剪裁
    expect(fieldCol.isAuto).toBeUndefined();
    expect(fieldCol.rounding).toBeUndefined();
    expect(fieldCol.displayMode).toBeUndefined();

    // 🚩 驗證 4: 負數倍率膨脹，且因為是自引用，也不應有 variableMap
    const spaceCol = template.columns![1];
    expect(spaceCol.formula).toBe('a1×c1');
    expect(spaceCol.constants?.c1).toBe(-1);
    expect(spaceCol.variableMap).toBeUndefined();
    expect(spaceCol.isAuto).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
