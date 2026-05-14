
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
            // 🎯 核心膨脹器：統一變數宣告
            let finalFormula = col.formula ?? 'a1';
            let finalConstants = col.constants;
            let finalColor = col.color;
            let finalInputType = col.inputType ?? 'keypad';
            let finalQuickActions = col.quickActions;
            let finalFunctions = col.functions;

            // 1. 智慧公式膨脹：偵測 "a1×3" 或 "a1*(-2)"，自動轉譯為標準常數結構
            if (typeof finalFormula === 'string') {
                const multiMatch = finalFormula.match(/[×\*xX]\(?(-?\d+(\.\d+)?)\)?/);
                if (multiMatch) {
                    const val = parseFloat(multiMatch[1]);
                    if (!isNaN(val)) {
                        finalFormula = 'a1×c1'; // 強制對齊前端引擎的全等於比對
                        finalConstants = { ...finalConstants, c1: val };
                    }
                }
            }

            // 2. 智慧顏色膨脹：將 "紅"、"藍色"、"blue" 等直覺字眼，膨脹回標準 Hex Code
            if (typeof finalColor === 'string' && !finalColor.startsWith('#')) {
                const colorLower = finalColor.toLowerCase();
                const matchKey = Object.keys(colorMap).find(key => colorLower.includes(key));
                if (matchKey) {
                    finalColor = colorMap[matchKey];
                } else {
                    finalColor = undefined;
                }
            }

            // 3. 智慧查表函數膨脹：解析超頻簡寫 "[0,1,3]>[0,1,3]"
            let finalFunctions = col.functions;
            if (finalFunctions && typeof finalFunctions === 'object') {
                const processedFuncs = { ...finalFunctions };
                let hasChanged = false;

                for (const fKey of Object.keys(processedFuncs)) {
                    const rule = processedFuncs[fKey];
                    // 🎯 第一型態：超壓縮運算子 "[0,1,3,+]>[-1,1,2,2]"
                    if (typeof rule === 'string' && rule.includes('>')) {
                        const parts = rule.split('>');
                        if (parts.length === 2) {
                            const inList = parts[0].replace(/[\[\]]/g, '').split(',').map(s => s.trim());
                            const outList = parts[1].replace(/[\[\]]/g, '').split(',').map(s => s.trim());
                            
                            if (inList.length > 0 && inList.length === outList.length) {
                                const newRules: any[] = [];
                                inList.forEach((inVal, idx) => {
                                    const isPlus = inVal === '+' || inVal.toLowerCase() === 'next';
                                    
                                    if (isPlus) {
                                        // 🎯 終極收斂：遇到結尾加號，不在原地覆寫，而是自動新增一個「min = 前一節點 min + 1」的線性累加節點！
                                        // 這能確保「前一節點」保持平鋪邊界，且線性疊加精準在 val >= prev.min + 1 時完美啟動！
                                        if (newRules.length > 0) {
                                            const prev = newRules[newRules.length - 1];
                                            // 前一節點保留 max: 'next' 屬性，使其能鏈接到我們即將新增的下一個節點
                                            
                                            const stepScore = parseFloat(outList[idx]);
                                            if (!isNaN(stepScore)) {
                                                newRules.push({
                                                    min: prev.min + 1,
                                                    isLinear: true,
                                                    unitScore: stepScore,
                                                    unit: 1 // 預設單位增量為 1
                                                });
                                            }
                                        }
                                    } else {
                                        const minVal = parseFloat(inVal);
                                        const scoreVal = parseFloat(outList[idx]);
                                        newRules.push({
                                            min: isNaN(minVal) ? 0 : minVal,
                                            max: 'next', // 先假設有下一個
                                            score: isNaN(scoreVal) ? 0 : scoreVal
                                        });
                                    }
                                });

                                // 雙重保險：如果結尾不是加號，則強行拔除最後一項的 max 使其符合 schema
                                if (newRules.length > 0) {
                                    const last = newRules[newRules.length - 1];
                                    if (last.max) delete last.max;
                                }

                                processedFuncs[fKey] = newRules;
                                hasChanged = true;
                            }
                        }
                    } 
                    // 🎯 第二型態：扁平平鋪物件 { "0": 1, "4": 2 }
                    else if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
                        const sortedKeys = Object.keys(rule)
                            .map(k => parseFloat(k))
                            .filter(n => !isNaN(n))
                            .sort((a, b) => a - b);

                        if (sortedKeys.length > 0) {
                            processedFuncs[fKey] = sortedKeys.map((keyVal, idx) => {
                                const isLast = idx === sortedKeys.length - 1;
                                const score = (rule as any)[String(keyVal)];
                                if (isLast) {
                                    return { min: keyVal, score };
                                } else {
                                    return { min: keyVal, max: 'next', score };
                                }
                            });
                            hasChanged = true;
                        }
                    }
                }
                if (hasChanged) {
                    finalFunctions = processedFuncs;
                }
            }

            // 4. 智慧按鈕清單膨脹：支援超頻字串簡寫 '["是","否"]>[10,0]'
            let finalQuickActions = col.quickActions;
            let finalInputType = col.inputType ?? 'keypad';

            if (typeof finalQuickActions === 'string' && finalQuickActions.includes('>')) {
                const parts = finalQuickActions.split('>');
                if (parts.length === 2) {
                    const labels = parts[0].replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/['"]/g, ''));
                    const values = parts[1].replace(/[\[\]]/g, '').split(',').map(s => parseFloat(s.trim()));
                    
                    if (labels.length > 0 && labels.length === values.length) {
                        finalQuickActions = labels.map((lbl, idx) => ({
                            id: generateId(6),
                            label: lbl,
                            value: isNaN(values[idx]) ? 0 : values[idx]
                        }));
                        finalInputType = 'clicker'; // 🎯 核心智慧：自動改寫為按鈕選單模式！
                    }
                }
            } else if (Array.isArray(finalQuickActions)) {
                // 傳統陣列相容性處理
                finalQuickActions = finalQuickActions.map((act: any) => ({
                    ...act,
                    id: act.id ?? generateId(6)
                }));
            }

            return {
                ...col,
                id: generateId(8),
                isScoring: col.isScoring ?? true,
                inputType: finalInputType,
                formula: finalFormula,
                constants: finalConstants,
                color: finalColor,
                unit: col.unit ?? '',
                functions: finalFunctions,
                quickActions: finalQuickActions
            };
        });

        const finalTemplate: Partial<GameTemplate> = {
            ...result,
            defaultScoringRule: result.defaultScoringRule || 'HIGHEST_WINS',
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
