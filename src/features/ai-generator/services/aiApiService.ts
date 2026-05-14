
import { GameTemplate } from '../../../types';
import { SYSTEM_PROMPT_ZH, SYSTEM_PROMPT_EN } from '../aiSystemPrompt';
import { generateId } from '../../../utils/idGenerator';
import { inflateGameTemplate } from './aiExpander';

// 預設 Vercel Serverless API 路徑
const API_ENDPOINT = '/api/ai-generator';

export interface AiGenerateResponse {
    success: boolean;
    data?: Partial<GameTemplate>;
    error?: string;
    errorCode?: 'rate_limit' | 'invalid_response' | 'network_error' | 'server_error';
}

export interface TokenUsageInfo {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}

export interface AiGenerationResult {
    template: Partial<GameTemplate>;
    usage?: TokenUsageInfo;
}

/**
 * 向 Vercel 後端 API 發送請求以生成計分板
 * 採用 FormData 傳輸以最大化 Blob 傳送效率
 */
export const callAiScoreboardApi = async (
    images: Blob[],
    gameName: string,
    language: string,
    modelName: string = 'gemini-2.5-flash-lite'
): Promise<AiGenerationResult> => {
    const formData = new FormData();

    // 1. 附加多張圖片 (如果有兩頁的話)
    images.forEach((blob, index) => {
        formData.append(`image_${index}`, blob, `rulebook_${index}.jpg`);
    });

    // 2. 根據使用者的前端語系，智慧分流最合適的超頻提示詞
    const isChinese = language.toLowerCase().includes('zh');
    const systemPrompt = isChinese ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

    formData.append('gameName', gameName);
    formData.append('language', language);
    formData.append('modelName', modelName);
    formData.append('systemPrompt', systemPrompt);

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData,
            // 注意：Fetch 自動會設定正確的 multipart/form-data header 與 boundary，不需要手動加 Content-Type
        });

        // 3. 特判 429 流量限制錯誤
        if (response.status === 429) {
            throw new Error('ai_error_rate_limit');
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Service] HTTP ${response.status}: ${errorText}`);

            // 🛡️ 診斷升級：將 HTTP 500/400 等伺服器錯誤也打包成診斷格式
            const diagnosticInfo = JSON.stringify({
                raw: `HTTP ${response.status} Error`,
                error: errorText
            });
            throw new Error(`ai_error_json_parse_failed|${diagnosticInfo}`);
        }

        const rawResponse = await response.json();

        // 🌟 智慧診斷攔截：若後端回報解析失敗或伺服器錯誤，將診斷資料打包拋出
        if (rawResponse && (rawResponse.error === 'json_parse_failed' || rawResponse.error === 'server_error')) {
            const diagnosticInfo = JSON.stringify({
                raw: rawResponse.rawResponse || 'N/A',
                error: rawResponse.parseErrorMessage || rawResponse.message || 'Unknown server error'
            });
            throw new Error(`ai_error_json_parse_failed|${diagnosticInfo}`);
        }

        // 🌟 智慧相容解析器：後端可能回傳 { data, usage }，也可能直拋裸 JSON
        const isWrapped = rawResponse && rawResponse.data !== undefined;
        const result = isWrapped ? rawResponse.data : rawResponse;
        const usageData = isWrapped ? rawResponse.usage : undefined;

        if (!result || !result.columns || !Array.isArray(result.columns)) {
            throw new Error('ai_error_invalid_json');
        }

        // 🌟 【前端自我膨脹引擎】：調用獨立檔案裡的膨脹邏輯
        const finalTemplate = inflateGameTemplate(result);

        return {
            template: finalTemplate as GameTemplate,
            usage: usageData
        };

    } catch (error: any) {
        console.error('[AI Service] Request failed:', error);

        // 向上拋出原錯誤訊息，以便 Hooks 能精準顯示對應的 i18n 文字
        if (error.message.startsWith('ai_error_')) {
            throw error;
        }

        throw new Error('ai_error_network');
    }
};
