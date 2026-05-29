import { GameTemplate } from "../../../types";
import { generateId } from "../../../utils/idGenerator";

/**
 * 🌟 【前端自我膨脹引擎】：單個欄位的膨脹邏輯
 * 負責將 AI 的極簡寫法轉換為計分引擎可執行的標準格式
 */
export const inflateScoringColumn = (col: any): any => {
    const colorMap: Record<string, string> = {
        '\u7da0': '#10b981', '\u85cd': '#3b82f6', '\u9ec3': '#facc15', '\u7d05': '#ef4444', // 綠, 藍, 黃, 紅
        '\u6a58': '#f97316', '\u6a59': '#f97316', '\u7d2b': '#8b5cf6', '\u9ed1': '#1f2937', // 橘, 橙, 紫, 黑
        '\u7c89': '#ec4899', '\u9752': '#06b6d4', '\u7425': '#f59e0b', '\u677e': '#14b8a6', // 粉, 青, 琥, 松
        '\u68d5': '#a16207', '\u8910': '#a16207', '\u7070': '#6b7280',                      // 棕, 褐, 灰
        'green': '#10b981', 'blue': '#3b82f6', 'yellow': '#facc15', 'red': '#ef4444',
        'orange': '#f97316', 'purple': '#8b5cf6', 'black': '#1f2937', 'pink': '#ec4899',
        'cyan': '#06b6d4', 'amber': '#f59e0b', 'turquoise': '#14b8a6', 'brown': '#a16207', 'gray': '#6b7280', 'grey': '#6b7280'
    };

    let finalFormula = col.formula ?? 'a1';
    let finalConstants = col.constants;
    let finalColor = col.color;
    let finalInputType = col.inputType ?? 'keypad';
    let finalQuickActions = col.quickActions;
    let finalFunctions = col.functions;
    let finalButtonGridColumns = col.buttonGridColumns;

    // --- V7 Semantic Formula Parsing START ---
    if (typeof finalFormula === 'string') {
        let trimmedFormula = finalFormula.trim();

        // 🌟 0. D1/AI 容錯防線：自動將錯誤的 lookup[]+next 轉化為極致 UX 的 buttons[]+next
        const lookupNextMatch = trimmedFormula.match(/^(?:lookup|function)\[(.*)\]\+next$/i);
        if (lookupNextMatch) {
            const rulesStr = lookupNextMatch[1];
            trimmedFormula = `buttons[${rulesStr}]+next`;
            finalFormula = trimmedFormula;
        }

        // 1. Buttons Parsing: buttons['有'->10, "無"->0] and buttons[...]+next
        const buttonsNextMatch = trimmedFormula.match(/^buttons\[(.*)\]\+next$/i);
        const buttonsMatch = trimmedFormula.match(/^buttons\[(.*)\]$/i);

        if (buttonsNextMatch || buttonsMatch) {
            const isAccumulator = !!buttonsNextMatch;
            const rulesStr = isAccumulator ? buttonsNextMatch![1] : buttonsMatch![1];
            const rules = rulesStr.split(',').map(s => s.trim());
            const newQuickActions = [];
            for (const rule of rules) {
                const parts = rule.split('->');
                if (parts.length === 2) {
                    const labelMatch = parts[0].match(/['"]([^'"]+)['"]/);
                    const label = labelMatch ? labelMatch[1] : parts[0].trim().replace(/['"]/g, '');
                    const rawValueStr = parts[1].trim();

                    // 🌟 核心：如果分數以 '+' 開頭，或標籤以 '+' 開頭 (相容 lookup 轉化)，即為增益微調按鈕 (isModifier: true)
                    const isModifier = rawValueStr.startsWith('+') || parts[0].trim().startsWith('+');
                    const value = parseFloat(rawValueStr);

                    if (!isNaN(value)) {
                        newQuickActions.push({ id: generateId(8), label, value, isModifier });
                    }
                }
            }
            if (newQuickActions.length > 0) {
                finalInputType = 'clicker';
                finalQuickActions = newQuickActions;
                finalFormula = isAccumulator ? 'a1+next' : 'a1';

                // 🌟 智慧判定按鈕網格佈局欄數 (cols)
                if (finalButtonGridColumns === undefined) {
                    const btnCount = newQuickActions.length;
                    if (btnCount <= 5) {
                        finalButtonGridColumns = 1;
                    } else if (btnCount >= 6 && btnCount <= 8) {
                        finalButtonGridColumns = 2;
                    } else {
                        finalButtonGridColumns = 3;
                    }
                }
            }
        }

        // 2. Lookup Parsing: lookup[0->-1, 1~3->1, +3->5] or function[...]
        const lookupMatch = trimmedFormula.match(/^(?:lookup|function)\[(.*)\]$/i);
        if (lookupMatch) {
            const rules = lookupMatch[1].split(',').map(s => s.trim());
            const newF1: any[] = [];
            let lastMin = 0;
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                const parts = rule.split('->');
                if (parts.length === 2) {
                    const left = parts[0].trim();
                    const score = parseFloat(parts[1]);
                    if (!isNaN(score)) {
                        if (left.startsWith('+')) {
                            const unit = parseFloat(left);
                            if (!isNaN(unit)) {
                                newF1.push({ min: lastMin + 1, isLinear: true, unitScore: score, unit });
                            }
                        } else {
                            const min = parseFloat(left);
                            if (!isNaN(min)) {
                                newF1.push({ min, max: 'next', score, isLinear: false });
                                lastMin = min;
                            }
                        }
                    }
                }
            }
            if (newF1.length > 0) {
                const last = newF1[newF1.length - 1];
                if (!last.isLinear && last.max) {
                    delete last.max;
                }
                finalFunctions = { f1: newF1 };
                finalFormula = 'f1(a1)';
            }
        }

        // 3. Pure Algebra Parsing
        if (!buttonsMatch && !lookupMatch) {
            if (trimmedFormula === 'x') {
                finalFormula = 'a1';
            } else if (trimmedFormula.endsWith('x') && trimmedFormula !== 'x') {
                let coeffStr = trimmedFormula.slice(0, -1).trim();
                let coeff = NaN;
                const fracMatch = coeffStr.match(/^\((\d+)\/(\d+)\)$/);
                if (fracMatch) {
                    coeff = parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
                } else {
                    coeff = parseFloat(coeffStr);
                }
                if (!isNaN(coeff)) {
                    finalFormula = 'a1×c1';
                    finalConstants = { ...finalConstants, c1: coeff };
                }
            } else if (trimmedFormula === 'xy') {
                finalFormula = 'a1×a2';
            } else if (trimmedFormula === 'x+next') {
                finalFormula = 'a1+next';
            } else if (trimmedFormula === 'xy+next') {
                finalFormula = '(a1×a2)+next';
            }
        }
    }
    // --- V7 Semantic Formula Parsing END ---

    // 1. 公式膨脹 (向下相容舊版 a1x3)
    if (typeof finalFormula === 'string') {
        const multiMatch = finalFormula.match(/[×\*xX]\(?(-?\d+(\.\d+)?)\)?/);
        if (multiMatch && finalFormula.includes('a1')) { // 確保只處理包含 a1 的舊公式
            const val = parseFloat(multiMatch[1]);
            if (!isNaN(val)) {
                finalFormula = 'a1×c1';
                finalConstants = { ...finalConstants, c1: val };
            }
        }
    }

    // 2. 顏色膨脹
    if (typeof finalColor === 'string' && !finalColor.startsWith('#')) {
        const colorLower = finalColor.toLowerCase();
        const matchKey = Object.keys(colorMap).find(key => colorLower.includes(key));
        if (matchKey) {
            finalColor = colorMap[matchKey];
        } else {
            finalColor = undefined;
        }
    }

    // 3. 查表函數膨脹 (向下相容舊版 [0,1]>[1,2])
    if (finalFunctions && typeof finalFunctions === 'object' && !Array.isArray(finalFunctions.f1)) {
        const processedFuncs = { ...finalFunctions };
        let hasChanged = false;
        for (const fKey of Object.keys(processedFuncs)) {
            const rule = processedFuncs[fKey];
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
                                if (newRules.length > 0) {
                                    const prev = newRules[newRules.length - 1];
                                    const stepScore = parseFloat(outList[idx]);
                                    if (!isNaN(stepScore)) {
                                        newRules.push({ min: prev.min + 1, isLinear: true, unitScore: stepScore, unit: 1 });
                                    }
                                }
                            } else {
                                const minVal = parseFloat(inVal);
                                const scoreVal = parseFloat(outList[idx]);
                                newRules.push({ min: isNaN(minVal) ? 0 : minVal, max: 'next', score: isNaN(scoreVal) ? 0 : scoreVal });
                            }
                        });
                        if (newRules.length > 0) {
                            const last = newRules[newRules.length - 1];
                            if (last.max) delete last.max;
                        }
                        processedFuncs[fKey] = newRules;
                        hasChanged = true;
                    }
                }
            } else if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
                const sortedKeys = Object.keys(rule).map(k => parseFloat(k)).filter(n => !isNaN(n)).sort((a, b) => a - b);
                if (sortedKeys.length > 0) {
                    processedFuncs[fKey] = sortedKeys.map((keyVal, idx) => {
                        const isLast = idx === sortedKeys.length - 1;
                        const score = (rule as any)[String(keyVal)];
                        return isLast ? { min: keyVal, score } : { min: keyVal, max: 'next', score };
                    });
                    hasChanged = true;
                }
            }
        }
        if (hasChanged) finalFunctions = processedFuncs;
    }

    // 4. 按鈕清單膨脹 (向下相容舊版)
    if (typeof finalQuickActions === 'string' && finalQuickActions.includes('>') && !finalFormula.includes('buttons[')) {
        const parts = finalQuickActions.split('>');
        if (parts.length === 2) {
            const labels = parts[0].replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/['"]/g, ''));
            const values = parts[1].replace(/[\[\]]/g, '').split(',').map(s => parseFloat(s.trim()));
            if (labels.length > 0 && labels.length === values.length) {
                finalInputType = 'clicker';
                finalQuickActions = labels.map((label, idx) => ({ id: generateId(8), label, value: isNaN(values[idx]) ? 0 : values[idx], isModifier: false }));
            }
        }
    }

    // 1. 基礎屬性補全 (確保後續邏輯一致)
    const finalRounding = col.rounding || 'none';
    const finalDisplayMode = col.displayMode || 'row';
    const finalUnit = col.unit || '';
    const finalIsScoring = col.isScoring ?? true;

    // 2. 名稱與 ID
    const name = col.name || 'Unknown';
    const colId = col.id || generateId(8);

    // 5. 結構正規化：將 f1 提升至最外層，補全 isLinear
    let finalF1 = col.f1;
    if (finalFunctions && finalFunctions.f1) {
        finalF1 = (finalFunctions.f1 as any[]).map(r => ({ ...r, isLinear: r.isLinear ?? false }));
        delete finalFunctions.f1;
    }

    // 6. 智慧變數對應與自動計算判定 (對齊內建模板邏輯)
    let finalVariableMap = col.variableMap;

    // 如果公式中包含 a1 且沒有指定 variableMap
    if (!finalVariableMap && (finalFormula.includes('a1') || finalF1)) {
        // 內建標準 (如農家樂): f1(a1) 且 a1 指向自己時，不應產出 variableMap
        // 引擎會自動隱含對應。手動補上反而會導致 isAuto 判斷混亂。
        finalVariableMap = undefined;
    }

    // 關鍵修正：isAuto 只有在「引用了別的欄位」時才是 true
    // 如果沒有 variableMap，表示它是手動輸入欄位 (或是隱含自引用)
    const finalIsAuto = !!finalVariableMap && Object.values(finalVariableMap).some((v: any) => v.id !== colId);

    // 清理空的 functions 物件
    const cleanFunctions = (finalFunctions && Object.keys(finalFunctions).length > 0) ? finalFunctions : undefined;

    const result: any = {
        ...col,
        id: colId,
        isScoring: finalIsScoring,
        isAuto: finalIsAuto,
        inputType: finalInputType,
        formula: finalFormula,
        variableMap: finalVariableMap,
        constants: finalConstants,
        color: finalColor,
        unit: finalUnit,
        rounding: finalRounding,
        displayMode: finalDisplayMode,
        f1: finalF1,
        functions: cleanFunctions,
        quickActions: finalQuickActions,
        buttonGridColumns: finalButtonGridColumns
    };

    // 🌟 屬性剪裁：僅移除「真正」多餘且內建模板不寫的預設值
    // 註：isScoring, inputType, rounding 雖然有預設值，但內建模板傾向於顯式寫出，故保留。
    if (result.displayMode === 'row') delete result.displayMode;
    if (result.isAuto === false) delete result.isAuto;
    if (result.unit === '') delete result.unit;
    if (result.buttonGridColumns === undefined) delete result.buttonGridColumns;

    return result;
};

/**
 * 🌟 【前端自我膨脹引擎】：膨脹整個模板資料
 */
export const inflateGameTemplate = (input: any): Partial<GameTemplate> => {
    if (!input) return input;

    // 🌟 自動膨脹：支援純陣列格式 [{}, {}] 或標準物件格式 { columns: [] }
    const result = Array.isArray(input) ? { columns: input } : input;

    if (!result.columns || !Array.isArray(result.columns)) {
        return result;
    }

    const inflatedColumns = result.columns.map((col: any) => inflateScoringColumn(col));

    return {
        ...result,
        defaultScoringRule: result.defaultScoringRule || 'HIGHEST_WINS',
        columns: inflatedColumns
    };
};
