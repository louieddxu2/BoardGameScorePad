
import { GameTemplate } from '../../../types';
import { SYSTEM_PROMPT } from '../aiSystemPrompt';

// 預設 Vercel Serverless API 路徑
const API_ENDPOINT = '/api/ai-generator';

export interface AiGenerateResponse {
    success: boolean;
    data?: Partial<GameTemplate>;
    error?: string;
    errorCode?: 'rate_limit' | 'invalid_response' | 'network_error' | 'server_error';
}

/**
 * 向 Vercel 後端 API 發送請求以生成計分板
 * 採用 FormData 傳輸以最大化 Blob 傳送效率
 */
export const callAiScoreboardApi = async (
    images: Blob[],
    gameName: string,
    language: string,
    modelName: string = 'gemini-3.1-flash-lite'
): Promise<Partial<GameTemplate>> => {
    const formData = new FormData();

    // 1. 附加多張圖片 (如果有兩頁的話)
    images.forEach((blob, index) => {
        formData.append(`image_${index}`, blob, `rulebook_${index}.jpg`);
    });

    // 2. 附加動態變數與提示詞
    formData.append('gameName', gameName);
    formData.append('language', language);
    formData.append('modelName', modelName);
    formData.append('systemPrompt', SYSTEM_PROMPT);

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
            throw new Error(`ai_error_server_${response.status}`);
        }

        const result = await response.json();

        if (!result || !result.columns) {
            throw new Error('ai_error_invalid_json');
        }

        return result as Partial<GameTemplate>;

    } catch (error: any) {
        console.error('[AI Service] Request failed:', error);
        
        // 向上拋出原錯誤訊息，以便 Hooks 能精準顯示對應的 i18n 文字
        if (error.message.startsWith('ai_error_')) {
            throw error;
        }
        
        throw new Error('ai_error_network');
    }
};
