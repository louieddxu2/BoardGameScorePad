import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiSimpleGenerator } from './useAiSimpleGenerator';
import { callAiScoreboardApi } from '../services/aiApiService';

// Mock 圖片壓縮
vi.mock('../utils/imageProcessor', () => ({
    compressImageForAi: vi.fn().mockImplementation((file) => Promise.resolve(file))
}));

// Mock 翻譯 Provider 包裝
vi.mock('../../../i18n', () => ({
    useTranslation: () => ({ language: 'zh-TW' })
}));

// Mock 底層 API 服務，精確控制雙軌賽馬的成功與重試
vi.mock('../services/aiApiService', () => ({
    callAiScoreboardApi: vi.fn()
}));

describe('useAiSimpleGenerator Hook Racing and Safeguard Tests (Slim Version)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    const mockResult = {
        template: { name: 'Racing Game', columns: [{ name: '點數', formula: 'a1', inputType: 'keypad' }] },
        rawText: 'mocked'
    } as any;

    it('should successfully racing both tracks and record elapsed times', async () => {
        // 模擬左/右軌首次呼叫直接成功
        vi.mocked(callAiScoreboardApi).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useAiSimpleGenerator());

        let promise: any;
        act(() => {
            promise = result.current.processAndGenerateSimple([new File([], 'test.jpg')], 'Racing Game');
        });

        // 🛡️ 透過 empty act 結清壓縮與 fetch 微任務
        await act(async () => {});

        // 等待平行 Promise resolved
        await act(async () => {
            await promise;
        });

        // 驗證最終雙路皆成功並結算
        expect(result.current.simpleStatus).toBe('success');
        expect(result.current.flashStatus).toBe('success');
        expect(result.current.gemmaStatus).toBe('success');
        expect(result.current.flashTryCount).toBe(1);
        expect(result.current.gemmaTryCount).toBe(1);
    });

    it('should retry second-choice models silently if primary models fail', async () => {
        // 模擬首次呼叫失敗 (丟出錯誤)，第二次重試成功
        vi.mocked(callAiScoreboardApi)
            .mockRejectedValueOnce(new Error('First Flash failed')) // 左軌首次
            .mockRejectedValueOnce(new Error('First Gemma failed')) // 右軌首次
            .mockResolvedValue(mockResult); // 後續重試成功

        const { result } = renderHook(() => useAiSimpleGenerator());

        let promise: any;
        act(() => {
            promise = result.current.processAndGenerateSimple([new File([], 'test.jpg')], 'Racing Game');
        });

        await act(async () => {}); // 結清微任務
        await act(async () => { await vi.advanceTimersByTimeAsync(600); }); // 推進 500ms 觸發重試
        await act(async () => { await promise; });

        // 驗證首選失敗後依靠次選重試成功
        expect(result.current.simpleStatus).toBe('success');
        expect(result.current.flashTryCount).toBe(2);
        expect(result.current.gemmaTryCount).toBe(2);
    });

    it('should handle complete failure on both tracks properly', async () => {
        vi.mocked(callAiScoreboardApi).mockRejectedValue(new Error('API failed'));

        const { result } = renderHook(() => useAiSimpleGenerator());

        let promise: any;
        act(() => {
            promise = result.current.processAndGenerateSimple([new File([], 'test.jpg')], 'Racing Game');
        });

        await act(async () => {});
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        await act(async () => { await promise; });

        expect(result.current.simpleStatus).toBe('error');
        expect(result.current.flashStatus).toBe('error');
        expect(result.current.gemmaStatus).toBe('error');
    });

    it('should abort in-flight requests and clear timers when resetSimple is invoked', async () => {
        // 模擬懸空 Promise
        vi.mocked(callAiScoreboardApi).mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useAiSimpleGenerator());

        act(() => {
            result.current.processAndGenerateSimple([new File([], 'test.jpg')], 'Racing Game');
        });

        await act(async () => {});
        act(() => { vi.advanceTimersByTime(5000); });
        expect(result.current.flashElapsedTime).toBe(5);

        act(() => { result.current.resetSimple(); });

        expect(result.current.simpleStatus).toBe('idle');
        expect(result.current.flashElapsedTime).toBe(0);
    });

    it('should update streamText states during streaming generation', async () => {
        // 模擬串流：當 callAiScoreboardApi 被呼叫時，主動調用傳入的 onStream 回呼
        vi.mocked(callAiScoreboardApi).mockImplementation(async (blobs, game, lang, model, onStream) => {
            if (onStream) {
                onStream('{"col');
                onStream('{"columns": []}');
            }
            return mockResult;
        });

        const { result } = renderHook(() => useAiSimpleGenerator());

        let promise: any;
        act(() => {
            promise = result.current.processAndGenerateSimple([new File([], 'test.jpg')], 'Racing Game');
        });

        await act(async () => {});
        await act(async () => { await promise; });

        expect(result.current.flashStreamText).toBe('{"columns": []}');
        expect(result.current.gemmaStreamText).toBe('{"columns": []}');
    });
});
