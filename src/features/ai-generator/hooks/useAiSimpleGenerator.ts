import { useState, useCallback, useRef, useEffect } from 'react';
import { compressImageForAi } from '../utils/imageProcessor';
import { useTranslation } from '../../../i18n';
import { callAiScoreboardApi } from '../services/aiApiService';
import { AiGenerationResult } from '../services/aiApiService';
import { recordAiGenerationAttempt } from '../services/aiUsageLimit';

export type SimpleProcessStatus = 'idle' | 'compressing' | 'generating' | 'success' | 'error';
export type ModelRunStatus = 'idle' | 'generating' | 'success' | 'error';

export interface UseAiSimpleGeneratorResult {
    simpleStatus: SimpleProcessStatus;
    flashStatus: ModelRunStatus;
    gemmaStatus: ModelRunStatus;
    flashResult: AiGenerationResult | null;
    gemmaResult: AiGenerationResult | null;
    flashStreamText: string;
    gemmaStreamText: string;
    flashTryCount: number;
    gemmaTryCount: number;
    flashElapsedTime: number;
    gemmaElapsedTime: number;
    flashError: string | null;
    gemmaError: string | null;
    processAndGenerateSimple: (files: File[], gameName: string) => Promise<void>;
    resetSimple: () => void;
    abortSimpleAll: () => void;
}

/**
 * AI 雙軌極簡生成器狀態管理控制器 (極致精簡型別安全版)
 */
export const useAiSimpleGenerator = (): UseAiSimpleGeneratorResult => {
    const [simpleStatus, setSimpleStatus] = useState<SimpleProcessStatus>('idle');
    const [flashStatus, setFlashStatus] = useState<ModelRunStatus>('idle');
    const [gemmaStatus, setGemmaStatus] = useState<ModelRunStatus>('idle');

    const [flashResult, setFlashResult] = useState<AiGenerationResult | null>(null);
    const [gemmaResult, setGemmaResult] = useState<AiGenerationResult | null>(null);

    const [flashStreamText, setFlashStreamText] = useState<string>('');
    const [gemmaStreamText, setGemmaStreamText] = useState<string>('');

    const [flashTryCount, setFlashTryCount] = useState<number>(0);
    const [gemmaTryCount, setGemmaTryCount] = useState<number>(0);

    const [flashElapsedTime, setFlashElapsedTime] = useState<number>(0);
    const [gemmaElapsedTime, setGemmaElapsedTime] = useState<number>(0);

    const [flashError, setFlashError] = useState<string | null>(null);
    const [gemmaError, setGemmaError] = useState<string | null>(null);

    const { language } = useTranslation();

    // 儲存連線中的 AbortController 與 Intervals
    const flashAbortRef = useRef<AbortController | null>(null);
    const gemmaAbortRef = useRef<AbortController | null>(null);
    const flashTimerRef = useRef<any>(null);
    const gemmaTimerRef = useRef<any>(null);

    const clearTimers = useCallback(() => {
        if (flashTimerRef.current) { clearInterval(flashTimerRef.current); flashTimerRef.current = null; }
        if (gemmaTimerRef.current) { clearInterval(gemmaTimerRef.current); gemmaTimerRef.current = null; }
    }, []);

    const abortSimpleAll = useCallback(() => {
        clearTimers();
        if (flashAbortRef.current) { flashAbortRef.current.abort(); flashAbortRef.current = null; }
        if (gemmaAbortRef.current) { gemmaAbortRef.current.abort(); gemmaAbortRef.current = null; }
    }, [clearTimers]);

    const resetSimple = useCallback(() => {
        abortSimpleAll();
        setSimpleStatus('idle');
        setFlashStatus('idle');
        setGemmaStatus('idle');
        setFlashResult(null);
        setGemmaResult(null);
        setFlashStreamText('');
        setGemmaStreamText('');
        setFlashTryCount(0);
        setGemmaTryCount(0);
        setFlashElapsedTime(0);
        setGemmaElapsedTime(0);
        setFlashError(null);
        setGemmaError(null);
    }, [abortSimpleAll]);

    useEffect(() => {
        return () => {
            clearTimers();
            if (flashAbortRef.current) flashAbortRef.current.abort();
            if (gemmaAbortRef.current) gemmaAbortRef.current.abort();
        };
    }, [clearTimers]);

    const processAndGenerateSimple = useCallback(async (
        files: File[],
        gameName: string
    ): Promise<void> => {
        if (files.length === 0) return;

        resetSimple();

        if (!recordAiGenerationAttempt()) {
            setSimpleStatus('error');
            setFlashStatus('error');
            setGemmaStatus('error');
            setFlashError('ai_error_local_rate_limit');
            setGemmaError('ai_error_local_rate_limit');
            return;
        }

        setSimpleStatus('compressing');

        let compressedBlobs: Blob[] = [];
        try {
            compressedBlobs = await Promise.all(files.map(file => compressImageForAi(file)));
        } catch (err) {
            setSimpleStatus('error');
            setFlashError('ai_error_compression');
            setGemmaError('ai_error_compression');
            return;
        }

        setSimpleStatus('generating');
        setFlashStatus('generating');
        setGemmaStatus('generating');

        const currentLang = language === 'zh-TW' ? 'Traditional Chinese (zh-tw)' : 'English (en)';

        // 啟動計時器
        flashTimerRef.current = setInterval(() => setFlashElapsedTime(prev => prev + 1), 1000);
        gemmaTimerRef.current = setInterval(() => setGemmaElapsedTime(prev => prev + 1), 1000);

        const flashAbort = new AbortController();
        const gemmaAbort = new AbortController();
        flashAbortRef.current = flashAbort;
        gemmaAbortRef.current = gemmaAbort;

        // 👈 左最速平行軌道：3.0 flash -> 3.1 lite
        const runFlashTrack = async () => {
            try {
                setFlashTryCount(1);
                const res = await callAiScoreboardApi(compressedBlobs, gameName, currentLang, 'gemini-3-flash-preview', (stream) => setFlashStreamText(stream), flashAbort.signal);
                if (flashTimerRef.current) clearInterval(flashTimerRef.current);
                setFlashResult(res);
                setFlashStatus('success');
                return res;
            } catch (err: any) {
                if (err.name === 'AbortError') return null;
                await new Promise(r => setTimeout(r, 500));
                if (flashAbort.signal.aborted) return null;
                try {
                    setFlashTryCount(2);
                    setFlashStreamText(''); // 降級重新嘗試前清空上一版串流
                    const resRetry = await callAiScoreboardApi(compressedBlobs, gameName, currentLang, 'gemini-3.1-flash-lite', (stream) => setFlashStreamText(stream), flashAbort.signal);
                    if (flashTimerRef.current) clearInterval(flashTimerRef.current);
                    setFlashResult(resRetry);
                    setFlashStatus('success');
                    return resRetry;
                } catch (retryErr: any) {
                    if (retryErr.name === 'AbortError') return null;
                    if (flashTimerRef.current) clearInterval(flashTimerRef.current);
                    setFlashStatus('error');
                    setFlashError(retryErr.message || 'ai_error_generic');
                    return null;
                }
            }
        };

        // 👉 右思考平行軌道：Gemma 4-31b -> Gemma 4-26b
        const runGemmaTrack = async () => {
            try {
                setGemmaTryCount(1);
                const res = await callAiScoreboardApi(compressedBlobs, gameName, currentLang, 'gemma-4-31b-it', (stream) => setGemmaStreamText(stream), gemmaAbort.signal);
                if (gemmaTimerRef.current) clearInterval(gemmaTimerRef.current);
                setGemmaResult(res);
                setGemmaStatus('success');
                return res;
            } catch (err: any) {
                if (err.name === 'AbortError') return null;
                await new Promise(r => setTimeout(r, 500));
                if (gemmaAbort.signal.aborted) return null;
                try {
                    setGemmaTryCount(2);
                    setGemmaStreamText(''); // 降級重新嘗試前清空上一版串流
                    const resRetry = await callAiScoreboardApi(compressedBlobs, gameName, currentLang, 'gemma-4-26b-a4b-it', (stream) => setGemmaStreamText(stream), gemmaAbort.signal);
                    if (gemmaTimerRef.current) clearInterval(gemmaTimerRef.current);
                    setGemmaResult(resRetry);
                    setGemmaStatus('success');
                    return resRetry;
                } catch (retryErr: any) {
                    if (retryErr.name === 'AbortError') return null;
                    if (gemmaTimerRef.current) clearInterval(gemmaTimerRef.current);
                    setGemmaStatus('error');
                    setGemmaError(retryErr.message || 'ai_error_generic');
                    return null;
                }
            }
        };

        Promise.allSettled([runFlashTrack(), runGemmaTrack()]).then(results => {
            const [f, g] = results;
            const fOk = f.status === 'fulfilled' && f.value !== null;
            const gOk = g.status === 'fulfilled' && g.value !== null;
            setSimpleStatus(fOk || gOk ? 'success' : 'error');
        });
    }, [language, resetSimple, abortSimpleAll]);

    return {
        simpleStatus, flashStatus, gemmaStatus,
        flashResult, gemmaResult,
        flashStreamText, gemmaStreamText,
        flashTryCount, gemmaTryCount,
        flashElapsedTime, gemmaElapsedTime,
        flashError, gemmaError,
        processAndGenerateSimple, resetSimple, abortSimpleAll
    };
};
