import { describe, it, expect, vi } from 'vitest';
import { callAiScoreboardApi } from './aiApiService';

describe('aiApiService - callAiScoreboardApi Expansion Logic', () => {
  it('should correctly expand AI response to match built-in template standards', async () => {
    // 模擬 AI 回傳極簡數據
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
      json: async () => ({ data: mockAiData })
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await callAiScoreboardApi([], 'Agricola', 'zh-TW');
    const template = result.template;

    // 🚩 驗證 1: f1 應該被提升至根目錄 (與內建模板一致)
    const fieldCol = template.columns![0];
    expect(fieldCol.f1).toBeDefined();
    expect(fieldCol.f1![0].isLinear).toBe(false); // 應該自動補完 isLinear

    // 🚩 驗證 2: 應該自動產生 variableMap (靈魂對應)
    expect(fieldCol.variableMap).toBeDefined();
    expect(fieldCol.variableMap?.a1?.id).toBe(fieldCol.id);

    // 🚩 驗證 3: 負數倍率膨脹且 variableMap 同步產生
    const spaceCol = template.columns![1];
    expect(spaceCol.formula).toBe('a1×c1');
    expect(spaceCol.constants?.c1).toBe(-1);
    expect(spaceCol.variableMap?.a1?.id).toBe(spaceCol.id);

    vi.unstubAllGlobals();
  });
});
