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

    const mockSseData = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(mockAiData) }]
          }
        }
      ],
      usageMetadata: { totalTokenCount: 100 }
    };

    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify(mockSseData) + '\n\n'));
        controller.close();
      }
    });

    const mockResponse = {
      ok: true,
      status: 200,
      body: mockStream,
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const images = Array.from({ length: 6 }, () => new Blob(['x'], { type: 'image/jpeg' }));
    const result = await callAiScoreboardApi(images, 'Agricola', 'zh-TW');
    const template = result.template;
    const fetchMock = vi.mocked(fetch);
    const requestBody = fetchMock.mock.calls[0][1]?.body as FormData;

    expect(requestBody.get('turnstileToken')).toBe('test-token-ai_generate');
    expect(requestBody.get('systemPrompt')).toBeNull();
    expect(requestBody.get('image_4')).toBeInstanceOf(File);
    expect(requestBody.get('image_5')).toBeNull();

    // 🚩 驗證 1: f1 應該被提升至根目錄
    const fieldCol = template.columns![0];
    expect(fieldCol.f1).toBeDefined();

    // 🚩 驗證 2: 對齊內建標準，自引用公式不應產生 variableMap
    expect(fieldCol.variableMap).toBeUndefined();

    // 🚩 驗證 3: 自引用欄位不應該是 isAuto (被剪除)，但基礎屬性應保留 (對齊內建顯式風格)
    expect(fieldCol.isAuto).toBeUndefined();
    expect(fieldCol.rounding).toBe('none');
    expect(fieldCol.inputType).toBe('keypad');

    // 🚩 驗證 4: 負數倍率膨脹
    const spaceCol = template.columns![1];
    expect(spaceCol.formula).toBe('a1×c1');
    expect(spaceCol.constants?.c1).toBe(-1);
    expect(spaceCol.isAuto).toBeUndefined();
    expect(spaceCol.isScoring).toBe(true);

    // 🚩 驗證 5: 原始文字
    expect(result.rawText).toBeDefined();

    vi.unstubAllGlobals();
  });
});
