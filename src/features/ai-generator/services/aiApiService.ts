
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
    rawText: string;
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
    modelName: string = 'gemini-2.5-flash-lite',
    onStream?: (chunk: string) => void
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

        // 🌟 SSE 解析邏輯
        if (!response.body) throw new Error('ai_error_network');

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let usageData: TokenUsageInfo | undefined = undefined;

        let done = false;
        let buffer = ""; // 用來處理跨 chunk 被截斷的資料行

        while (!done) {
            const { value, done: isDone } = await reader.read();
            done = isDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // 依換行符號分割，保留最後一個可能不完整的行
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (!dataStr) continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            
                            // 擷取 Token 使用量 (通常在最後一個 chunk 伴隨回傳)
                            if (data.usageMetadata) {
                                usageData = data.usageMetadata;
                            }
                            
                            // 擷取文字碎片
                            const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (textChunk) {
                                accumulatedText += textChunk;
                                if (onStream) onStream(accumulatedText);
                            }
                        } catch (e) {
                            // 若因為 JSON 結構問題解析失敗，則忽略該行
                            console.warn('[AI Stream] Failed to parse SSE data chunk:', dataStr);
                        }
                    }
                }
            }
        }

        // 串流結束，處理累積的文字
        if (!accumulatedText) {
             const diagnosticInfo = JSON.stringify({
                raw: 'N/A',
                error: 'ai_error_empty_response'
            });
            throw new Error(`ai_error_json_parse_failed|${diagnosticInfo}`);
        }

        let parsedData;
        try {
            // 🌟 更強大的 JSON 提取器，自動忽略 Gemma 4 的思考過程與雜訊
            let cleanJson = accumulatedText;
            const jsonMatch = accumulatedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            
            if (jsonMatch && jsonMatch[1]) {
                cleanJson = jsonMatch[1].trim();
            } else {
                // 🛡️ Fallback: 如果 AI 忘記包裝 markdown，強制尋找大括號區塊
                const startIdx = accumulatedText.indexOf('{');
                const endIdx = accumulatedText.lastIndexOf('}');
                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                    cleanJson = accumulatedText.substring(startIdx, endIdx + 1);
                } else {
                    cleanJson = accumulatedText.trim();
                }
            }
            
            parsedData = JSON.parse(cleanJson);
        } catch (parseError: any) {
            const diagnosticInfo = JSON.stringify({
                raw: accumulatedText,
                error: parseError.message
            });
            throw new Error(`ai_error_json_parse_failed|${diagnosticInfo}`);
        }

        // 🌟 彈性解析：支援純陣列 [{}, {}] 或舊有的 { columns: [] } 結構
        const rawColumns = Array.isArray(parsedData) ? parsedData : (parsedData.columns || []);
        
        if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
            throw new Error('ai_error_invalid_json');
        }

        // 🌟 【前端自我膨脹引擎】：調用獨立檔案裡的膨脹邏輯
        const finalTemplate = inflateGameTemplate(Array.isArray(parsedData) ? { columns: parsedData } : parsedData);

        // 🌟 核心修正：若 AI 返回純陣列（無 name），則自動補回原始輸入的遊戲名稱
        if (!finalTemplate.name) {
            finalTemplate.name = gameName;
        }

        return {
            template: finalTemplate as GameTemplate,
            rawText: accumulatedText,
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
