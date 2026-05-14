import { describe, it, expect, vi } from 'vitest';
import { callAiScoreboardApi } from './aiApiService';

describe('aiApiService - callAiScoreboardApi Expansion Logic', () => {
  it('should correctly expand both minimal and full formats', async () => {
    // 模擬 AI 回傳：混合了極簡語法與已經完整定義的語法 (Agricola 風格)
    const mockAiData = {
      name: 'Mixed Formats',
      columns: [
        // 1. 極簡語法 (需要膨脹)
        { name: 'Minimal Mult', formula: 'a1×(-5)', color: '紅' },
        // 2. 完整語法 (應該保持原樣，不被誤傷)
        { 
          name: 'Full Mult', 
          formula: 'a1×c1', 
          constants: { c1: -1 },
          unit: '格'
        }
      ]
    };

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: mockAiData })
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await callAiScoreboardApi([], 'Test', 'zh-TW');
    const template = result.template;

    // 驗證 1: 極簡語法是否膨脹成功
    expect(template.columns![0].formula).toBe('a1×c1');
    expect(template.columns![0].constants?.c1).toBe(-5);
    expect(template.columns![0].color).toBe('#ef4444');

    // 驗證 2: 完整語法是否原封不動保留 (關鍵點！)
    expect(template.columns![1].formula).toBe('a1×c1');
    expect(template.columns![1].constants?.c1).toBe(-1);
    expect(template.columns![1].unit).toBe('格');

    vi.unstubAllGlobals();
  });
});
