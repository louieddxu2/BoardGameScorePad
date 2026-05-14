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
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

    // 2. 執行 API 呼叫 (帶入假資料)
    const result = await callAiScoreboardApi([], 'Test', 'zh-TW');
    const template = result.template;

    // 3. 驗證膨脹是否在內部正確發生
    
    // 倍率與負數
    expect(template.columns![0].formula).toBe('a1×c1');
    expect(template.columns![0].constants?.c1).toBe(-5);
    expect(template.columns![0].color).toBe('#ef4444'); // 顏色膨脹

    // 查表
    const f1 = template.columns![1].functions?.f1 as any[];
    expect(f1).toBeDefined();
    expect(f1[0].min).toBe(0);
    expect(f1[0].score).toBe(10);

    // 按鈕
    expect(template.columns![2].inputType).toBe('clicker');
    expect(template.columns![2].quickActions![0].label).toBe('A');

    fetchSpy.mockRestore();
  });
});
