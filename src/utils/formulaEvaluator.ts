
/**
 * 安全地評估數學公式
 * @param formula 公式字串，例如 "x1 * 2 + x2"
 * @param variables 變數對照表，例如 { x1: 10, x2: 5 }
 * @returns 計算結果 (number)
 */
export const evaluateFormula = (formula: string, variables: Record<string, number>): number => {
  if (!formula || !formula.trim()) return 0;

  try {
    // 0. 符號標準化：將視覺用的 '×' 替換為運算用的 '*'
    let processedFormula = formula.toLowerCase().replace(/×/g, '*');

    // 1. 準備變數替換
    // 必須依照變數名稱長度由長到短排序，避免部分取代 (例如 x11 被 x1 取代剩 1)
    const sortedVars = Object.keys(variables).sort((a, b) => b.length - a.length);
    
    // 2. 替換變數為數值
    sortedVars.forEach(key => {
      const val = variables[key];
      // 使用 Regex 全域替換，並確保變數邊界 (避免 ax1 被取代) - 雖然目前我們的變數都是 x 開頭數字結尾，簡單替換即可
      processedFormula = processedFormula.split(key.toLowerCase()).join(`(${val})`);
    });

    // 3. 安全性檢查 (Sanitization)
    // 只允許：數字、小數點、運算符 (+ - * / % ( ))、空格
    // 嚴格禁止字母 (除了 e 用於科學記號，但在這裡我們主要處理簡單數學，暫不考慮複雜科學記號以免漏洞)
    const allowedChars = /^[0-9+\-*/().\s]*$/;
    
    if (!allowedChars.test(processedFormula)) {
      console.warn("Formula contains invalid characters:", processedFormula);
      return 0;
    }

    // 4. 執行計算
    // 使用 new Function 比 eval 稍微安全一點點，且在嚴格模式下運行
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${processedFormula})`)();

    // 5. 處理結果
    if (!isFinite(result) || isNaN(result)) {
      return 0;
    }

    return result;

  } catch (error) {
    console.error("Formula evaluation failed:", error, formula);
    return 0;
  }
};
