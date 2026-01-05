
/**
 * 安全地評估數學公式，支援變數與自定義函數
 * @param formula 公式字串，例如 "f1(x1) * 2 + x2"
 * @param variables 變數對照表，例如 { x1: 10, x2: 5 }
 * @param functions 函數對照表，例如 { f1: (v) => v*10 }
 * @returns 計算結果 (number)
 */
export const evaluateFormula = (
  formula: string, 
  variables: Record<string, number>, 
  functions: Record<string, Function> = {}
): number => {
  if (!formula || !formula.trim()) return 0;

  try {
    // 0. 符號標準化：將視覺用的 '×' 替換為運算用的 '*'
    let processedFormula = formula.toLowerCase().replace(/×/g, '*');

    // 1. 準備變數替換
    const sortedVars = Object.keys(variables).sort((a, b) => b.length - a.length);
    
    // 2. 替換變數為數值
    sortedVars.forEach(key => {
      const val = variables[key];
      // 確保變數替換不會破壞函數名 (例如 x11 替換掉 f11 的 11)
      // 使用更精確的邊界判斷
      const regex = new RegExp(`\\b${key.toLowerCase()}\\b`, 'g');
      processedFormula = processedFormula.replace(regex, `(${val})`);
    });

    // 3. 安全性檢查 (Sanitization)
    // 允許：數字、小數點、運算符、括號、空格
    // [關鍵修改] 允許 f1, f2, f3... 這種模式的函數呼叫
    const allowedChars = /^[0-9+\-*/().\s,f]*$/;
    
    // 檢查公式中是否包含未經授權的英文字母
    // 我們移除所有合法函數名(f1, f2...)後，不應該剩下任何英文字母
    let checkStr = processedFormula;
    Object.keys(functions).forEach(fnName => {
        checkStr = checkStr.split(fnName.toLowerCase()).join('');
    });

    // 檢查剩下的是否只有安全字元
    if (!allowedChars.test(checkStr)) {
      console.warn("Formula contains invalid characters or unauthorized letters:", processedFormula);
      return 0;
    }

    // 4. 執行計算
    // 將 functions 中的 key 解構放入執行環境
    const fnNames = Object.keys(functions);
    const fnValues = fnNames.map(name => functions[name]);
    
    // eslint-disable-next-line no-new-func
    const evalFn = new Function(...fnNames, `"use strict"; return (${processedFormula})`);
    const result = evalFn(...fnValues);

    // 5. 回傳結果
    // 修改：不再強制歸零，允許回傳 Infinity/NaN 以便上層偵測錯誤 (如除以0)
    return result;

  } catch (error) {
    console.error("Formula evaluation failed:", error, formula);
    return 0;
  }
};

const MATH_KEYWORDS = new Set([
  'min', 'max', 'floor', 'ceil', 'round', 'abs', 'sin', 'cos', 'tan', 'log', 'sqrt', 'pow', 'pi', 'e'
]);

// 提取解析邏輯為獨立函數
export const extractIdentifiers = (formula: string) => {
    // 移除所有字串常數
    const cleanFormula = formula.replace(/×/g, '*');
    
    // 找出所有可能的識別字 (變數或函數)
    const regex = /\b([a-zA-Z][a-zA-Z0-9]*)\b/g;
    const matches = cleanFormula.match(regex) || [];
    
    const unique = Array.from(new Set(matches));
    
    const vars: string[] = [];
    const funcs: string[] = [];

    unique.forEach(token => {
        const lower = token.toLowerCase();
        if (MATH_KEYWORDS.has(lower)) return;
        
        // 判斷是函數還是變數：f 開頭 + 數字 = 函數，其他 = 變數
        if (/^f\d+$/.test(lower)) {
            funcs.push(lower);
        } else {
            vars.push(token);
        }
    });

    return { vars, funcs };
};
