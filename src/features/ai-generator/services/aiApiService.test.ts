import { describe, it, expect, vi } from 'vitest';
import { callAiScoreboardApi } from './aiApiService';

describe('aiApiService - callAiScoreboardApi Expansion Logic', () => {
  it('should correctly expand AI response within callAiScoreboardApi', async () => {
    // 1. 模擬 Fetch 回應，包含極簡 AI 數據
    const mockAiData = {
      name: 'Test Game',
      columns: [
        { name: 'Mult', formula: 'a1×(-5)', color: '紅' },
        { name: 'Chart', formula: 'f1(a1)', functions: { f1: '[0,1]>[10,20]' } },
        { name: 'Btns', quickActions: '["A","B"]>[1,2]' }
      ]
    };

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: mockAiData, usage: { totalTokenCount: 100 } })
    };

    // 攔截全域 fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    // 2. 執行 API 呼叫 (帶入假資料)
    const result = await callAiScoreboardApi([], 'Test', 'zh-TW');
    const template = result.template;

    // 3. 驗證膨脹是否在內部正確發生
    const multCol = template.columns![0];
    expect(multCol.formula).toBe('a1×c1');
    expect(multCol.constants?.c1).toBe(-5);

    // 🚩 關鍵驗證：a1 必須被對應到本欄位 ID，否則計分引擎無法運作
    // 如果這裡失敗，說明我們的膨脹引擎目前只有「外殼」，沒有「靈魂」
    expect(multCol.variableMap).toBeDefined();
    expect(multCol.variableMap?.a1?.id).toBe(multCol.id);

    vi.unstubAllGlobals();
  });
});
