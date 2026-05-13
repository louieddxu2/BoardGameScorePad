
import { GameTemplate } from '../../../types';
import { SYSTEM_PROMPT_ZH, SYSTEM_PROMPT_EN } from '../aiSystemPrompt';
import { generateId } from '../../../utils/idGenerator';

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
            throw new Error(`ai_error_server_${response.status}`);
        }

        const rawResponse = await response.json();

        // 🌟 智慧相容解析器：後端可能回傳 { data, usage }，也可能直拋裸 JSON
        const isWrapped = rawResponse && rawResponse.data !== undefined;
        const result = isWrapped ? rawResponse.data : rawResponse;
        const usageData = isWrapped ? rawResponse.usage : undefined;

        if (!result || !result.columns || !Array.isArray(result.columns)) {
            throw new Error('ai_error_invalid_json');
        }

        // 🌟 【前端自我膨脹引擎】：將資料與結構換算體力活推給瀏覽器，解放 AI 認知壓力
        const colorMap: Record<string, string> = {
            '\u7da0': '#10b981', '\u85cd': '#3b82f6', '\u9ec3': '#facc15', '\u7d05': '#ef4444', // 綠, 藍, 黃, 紅
            '\u6a58': '#f97316', '\u6a59': '#f97316', '\u7d2b': '#8b5cf6', '\u9ed1': '#1f2937', // 橘, 橙, 紫, 黑
            '\u7c89': '#ec4899', '\u9752': '#06b6d4', '\u7425': '#f59e0b', '\u677e': '#14b8a6', // 粉, 青, 琥, 松
            '\u68d5': '#a16207', '\u8910': '#a16207', '\u7070': '#6b7280',                      // 棕, 褐, 灰
            'green': '#10b981', 'blue': '#3b82f6', 'yellow': '#facc15', 'red': '#ef4444',
            'orange': '#f97316', 'purple': '#8b5cf6', 'black': '#1f2937', 'pink': '#ec4899',
            'cyan': '#06b6d4', 'amber': '#f59e0b', 'turquoise': '#14b8a6', 'brown': '#a16207', 'gray': '#6b7280', 'grey': '#6b7280'
        };

        const inflatedColumns = result.columns.map((col: any) => {
            let finalFormula = col.formula ?? 'a1';
            let finalConstants = col.constants;

            // 1. 智慧公式膨脹：偵測 "a1×3" 或 "a1*-2" 的直寫語法，自動轉譯為標準常數結構
            if (typeof finalFormula === 'string') {
                const multMatch = finalFormula.match(/a1\s*[×*xX]\s*(-?\d+(\.\d+)?)/);
                if (multMatch) {
                    const num = parseFloat(multMatch[1]);
                    finalFormula = 'a1×c1';
                    finalConstants = { c1: num };
                }
            }

            // 2. 智慧顏色膨脹：將 "紅"、"藍色"、"blue" 等直覺字眼，膨脹回標準 Hex Code
            let finalColor = col.color;
            if (typeof finalColor === 'string' && !finalColor.startsWith('#')) {
                const colorLower = finalColor.toLowerCase();
                const matchKey = Object.keys(colorMap).find(key => colorLower.includes(key));
                if (matchKey) {
                    finalColor = colorMap[matchKey];
                } else {
                    // 無法識別則直接清空，避免髒資料污染 CSS
                    finalColor = undefined;
                }
            }

            return {
                ...col,
                // 自動為欄位生成系統合規的 8 碼短 ID，消滅碰撞風險
                id: generateId(8),
                isScoring: col.isScoring ?? true,
                inputType: col.inputType ?? 'keypad',
                formula: finalFormula,
                constants: finalConstants,
                color: finalColor,
                unit: col.unit ?? '',
                // 若有按鈕，也自動幫按鈕配發系統 6 碼短 ID
                quickActions: Array.isArray(col.quickActions)
                    ? col.quickActions.map((act: any) => ({
                        ...act,
                        id: generateId(6)
                    }))
                    : col.quickActions
            };
        });

        const finalTemplate: Partial<GameTemplate> = {
            ...result,
            defaultScoringRule: result.defaultScoringRule || 'HIGHEST_WINS', // 系統自動保底預設模式
            columns: inflatedColumns
        };

        return {
            template: finalTemplate,
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
