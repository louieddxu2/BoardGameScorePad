
import { useState, useCallback } from 'react';
import { GameTemplate } from '../../../types';
import { compressImageForAi } from '../utils/imageProcessor';
import { callAiScoreboardApi, TokenUsageInfo } from '../services/aiApiService';
import { useTranslation } from '../../../i18n';

export type AiProcessStatus = 'idle' | 'compressing' | 'generating' | 'success' | 'error';

export interface UseAiGeneratorResult {
    status: AiProcessStatus;
    errorMessage: string | null;
    tokenUsage: TokenUsageInfo | null;
    processAndGenerate: (
        files: File[],
        gameName: string,
        modelName?: string
    ) => Promise<Partial<GameTemplate> | null>;
    reset: () => void;
    isAiUnlocked: boolean;
}

/**
 * AI 生成器狀態管理控制器
 */
export const useAiGenerator = (): UseAiGeneratorResult => {
    const [status, setStatus] = useState<AiProcessStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo | null>(null);
    const { language } = useTranslation();

    // 檢查解鎖狀態 (改用 advance_user)
    const isAiUnlocked = localStorage.getItem('advance_user') === 'true';

    const reset = useCallback(() => {
        setStatus('idle');
        setErrorMessage(null);
        setTokenUsage(null);
    }, []);

    /**
     * 主流程：接收原始 File -> 壓縮成輕量 Blob -> 發送 API -> 回傳 JSON
     */
    const processAndGenerate = useCallback(async (
        files: File[],
        gameName: string,
        modelName: string = 'gemini-2.5-flash-lite'
    ): Promise<Partial<GameTemplate> | null> => {
        if (files.length === 0) return null;
        
        setErrorMessage(null);
        setTokenUsage(null);
        
        try {
            // 階段 1: 圖片高速壓縮
            setStatus('compressing');
            const compressedBlobs = await Promise.all(
                files.map(file => compressImageForAi(file))
            );

            // 階段 2: 傳送給 AI
            setStatus('generating');
            
            // 確定要傳遞給 AI 的語系字串
            const currentLang = language === 'zh-TW' ? '繁體中文 (zh-TW)' : '英文 (en)';
            
            const { template, usage } = await callAiScoreboardApi(
                compressedBlobs,
                gameName,
                currentLang,
                modelName
            );
            
            if (usage) {
                setTokenUsage(usage);
            }

            setStatus('success');
            return template;

        } catch (error: any) {
            console.error('[useAiGenerator] Process failed:', error);
            setStatus('error');
            
            // 將底層丟出來的特殊錯誤 key 存下來，供 UI i18n 解析
            setErrorMessage(error.message || 'ai_error_generic');
            return null;
        }
    }, [language]);

    return {
        status,
        errorMessage,
        tokenUsage,
        processAndGenerate,
        reset,
        isAiUnlocked
    };
};
