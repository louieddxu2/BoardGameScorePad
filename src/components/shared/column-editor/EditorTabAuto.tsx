
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScoreColumn } from '../../../types';
import { Sparkles, ArrowRight, Lock, Unlock, Check, Calculator, AlertCircle, Plus, Delete } from 'lucide-react';

interface EditorTabAutoProps {
  column: ScoreColumn;
  allColumns?: ScoreColumn[];
  onChange: (updates: Partial<ScoreColumn>) => void;
}

// 常見數學函數關鍵字，解析變數時應排除
const MATH_KEYWORDS = new Set([
  'min', 'max', 'floor', 'ceil', 'round', 'abs', 'sin', 'cos', 'tan', 'log', 'sqrt', 'pow', 'pi', 'e'
]);

const EditorTabAuto: React.FC<EditorTabAutoProps> = ({ column, allColumns = [], onChange }) => {
  // Local state for the formula input to prevent constant re-parsing/updating parent
  const [localFormula, setLocalFormula] = useState(column.formula || '');
  const [isLocked, setIsLocked] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Ref for the input element to track cursor position
  const inputRef = useRef<HTMLInputElement>(null);

  const availableColumns = allColumns.filter(c => c.id !== column.id);
  
  // Explicitly type variableMap to ensure Object.entries returns correct types
  const variableMap: Record<string, { id: string; name: string }> = column.variableMap || {};
  const variableList = Object.entries(variableMap);

  // 初始化：如果已有公式且有對應變數，預設為鎖定狀態
  useEffect(() => {
    if (column.formula && Object.keys(column.variableMap || {}).length > 0) {
        setIsLocked(true);
    }
  }, []);

  // 解析目前的變數 (用於顯示按鈕)
  const existingXVars = useMemo(() => {
      const regex = /x(\d+)/g;
      const matches = localFormula.match(regex) || [];
      // 去重並排序
      const unique = Array.from(new Set(matches)).sort((a: string, b: string) => {
          const numA = parseInt(a.substring(1));
          const numB = parseInt(b.substring(1));
          return numA - numB;
      });
      return unique;
  }, [localFormula]);

  const extractVariables = (formula: string): string[] => {
    const regex = /[a-zA-Z][a-zA-Z0-9]*/g;
    const matches = formula.match(regex) || [];
    const uniqueVars = Array.from(new Set(matches));
    return uniqueVars.filter(v => !MATH_KEYWORDS.has(v.toLowerCase()));
  };

  const handleLock = () => {
    if (!localFormula.trim()) {
        setParseError("請輸入公式");
        return;
    }

    // --- 語法預檢查 (Dry Run) ---
    try {
        // 1. 將所有變數 (x1, x2...) 替換為數字 '1' 進行測試
        let testFormula = localFormula.toLowerCase();
        
        // 先檢查是否有非法字元 (只允許 變數, 數字, 運算符, 包括 ×)
        // 這裡的 Regex 允許 a-z0-9 (變數) 以及 +-*/(). 空白 和 ×
        if (!/^[a-z0-9+\-*/().\s×]+$/.test(testFormula)) {
             throw new Error("包含不合法的符號");
        }

        // 將視覺符號 × 替換為運算符 *
        testFormula = testFormula.replace(/×/g, '*');

        // 將變數替換為 1
        const vars = extractVariables(testFormula);
        vars.forEach(v => {
            testFormula = testFormula.split(v).join('1');
        });

        // 2. 嘗試執行
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${testFormula})`)();

        // 3. 檢查結果是否為數字 (防止 1/0 或 undefined)
        // 注意：這裡如果使用者故意寫 5/0，這裡會抓到 Infinity，我們會擋下來
        // 但如果寫 x1/x2，因為我們代入 1/1，所以會通過。這是正確的，因為 runtime 除以 0 是允許的(回傳0)。
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            throw new Error("公式計算結果無效");
        }

    } catch (e) {
        // 捕捉 SyntaxError (例如 "1++" 或 "x1 +")
        setParseError("公式語法錯誤，請檢查運算符號");
        return;
    }
    // --- 檢查通過 ---

    // 注意：變數提取不包含 ×，所以這裡直接提取即可
    const extractedVars = extractVariables(localFormula.replace(/×/g, '*'));
    
    // 建構新的 Variable Map
    const newMap: Record<string, { id: string; name: string }> = {};
    
    extractedVars.forEach(v => {
        if (variableMap[v]) {
            // 如果原本就有對應，保留原值 (需確保格式正確)
            newMap[v] = variableMap[v];
        } else {
            // 嘗試預設一個還沒被用過的欄位，或是第一個欄位
            const defaultCol = availableColumns[0];
            if (defaultCol) {
                newMap[v] = { id: defaultCol.id, name: defaultCol.name };
            }
        }
    });

    // 更新父層，同時寫入 isAuto 屬性
    onChange({ 
        formula: localFormula,
        variableMap: newMap,
        isAuto: true,
        inputType: 'auto'
    });

    setParseError(null);
    setIsLocked(true);
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleUpdateMapping = (key: string, targetColId: string) => {
      const targetCol = availableColumns.find(c => c.id === targetColId);
      if (targetCol) {
          const newMap = { 
              ...variableMap, 
              [key]: { id: targetCol.id, name: targetCol.name } 
          };
          onChange({ variableMap: newMap });
      }
  };

  const insertToken = (token: string) => {
      if (isLocked) return;
      
      const input = inputRef.current;
      if (!input) {
          // Fallback if ref is missing
          setLocalFormula(prev => prev + token);
          return;
      }

      const start = input.selectionStart ?? localFormula.length;
      const end = input.selectionEnd ?? localFormula.length;

      // 插入文字：保留選取範圍之前 + token + 選取範圍之後
      const newVal = localFormula.substring(0, start) + token + localFormula.substring(end);
      setLocalFormula(newVal);

      // 還原焦點並移動游標到插入文字之後
      // 使用 setTimeout 確保在 React 重新渲染後執行
      // 雖然 preventDefault 保留了焦點，但我們仍需更新 cursor 位置
      setTimeout(() => {
          // 確保焦點還在 (以防萬一)
          if (document.activeElement !== input) input.focus();
          const newCursorPos = start + token.length;
          input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
  };

  const handleDelete = () => {
      if (isLocked) return;

      const input = inputRef.current;
      if (!input) {
          setLocalFormula(prev => prev.slice(0, -1));
          return;
      }

      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      let newVal = localFormula;
      let newCursorPos = start;

      if (start !== end) {
          // 有選取範圍：刪除選取內容
          newVal = localFormula.substring(0, start) + localFormula.substring(end);
          newCursorPos = start;
      } else if (start > 0) {
          // 無選取範圍：刪除游標前一個字元 (Backspace)
          newVal = localFormula.substring(0, start - 1) + localFormula.substring(end);
          newCursorPos = start - 1;
      }

      setLocalFormula(newVal);

      setTimeout(() => {
          if (document.activeElement !== input) input.focus();
          input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
  };

  const handleAddNextVar = () => {
      if (isLocked) return;
      // 找出目前最大的 xN
      let maxIndex = 0;
      existingXVars.forEach(v => {
          const num = parseInt(v.substring(1));
          if (!isNaN(num) && num > maxIndex) maxIndex = num;
      });
      const nextVar = `x${maxIndex + 1}`;
      insertToken(nextVar);
  };

  // 關鍵 helper：阻止按鈕點擊時搶走 input 焦點
  const preventFocusLoss = (e: React.MouseEvent) => {
      e.preventDefault();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header Info */}
      <div className="flex items-start gap-3 bg-indigo-900/20 p-3 rounded-xl border border-indigo-500/30">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
              <Sparkles size={24} />
          </div>
          <div>
              <h3 className="font-bold text-indigo-200 text-sm">自動計算模式</h3>
              <p className="text-xs text-indigo-300/70 mt-1 leading-relaxed">
                  使用下方按鈕輸入公式 (如 <code>x1 × 2 + 5</code>)，確認後設定 x1 對應的欄位。
              </p>
          </div>
      </div>

      {/* Formula Input Section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-500 uppercase">計算公式</label>
            {parseError && !isLocked && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                    <AlertCircle size={10} /> {parseError}
                </span>
            )}
        </div>
        
        <div className="relative group">
            <div className={`absolute inset-0 bg-indigo-500/5 rounded-xl pointer-events-none transition-opacity ${isLocked ? 'opacity-100' : 'opacity-0'}`} />
            
            <input
                ref={inputRef}
                type="text"
                inputMode="decimal" 
                value={localFormula}
                onChange={e => { setLocalFormula(e.target.value); setParseError(null); }}
                placeholder="(x1 + x2) × 2"
                disabled={isLocked}
                className={`w-full border rounded-xl p-4 font-mono text-lg font-bold tracking-wide outline-none transition-all shadow-inner
                    ${isLocked 
                        ? 'bg-slate-900/50 border-slate-700 text-slate-400 cursor-not-allowed' 
                        : parseError 
                            ? 'bg-slate-900 border-red-500/50 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'bg-slate-900 border-indigo-500/50 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                    }
                `}
            />
            
            {/* Lock/Unlock Action Button */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {isLocked ? (
                    <button 
                        onClick={handleUnlock}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-600 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
                    >
                        <Unlock size={14} /> 解鎖編輯
                    </button>
                ) : (
                    <button 
                        onClick={handleLock}
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-900/50 transition-all flex items-center gap-2 text-xs font-bold active:scale-95"
                    >
                        <Check size={14} strokeWidth={3} /> 確認公式
                    </button>
                )}
            </div>
        </div>

        {/* Toolbar - Only visible when editing */}
        {!isLocked && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                {/* Row 1: Operators */}
                <div className="grid grid-cols-7 gap-2">
                    {['+', '-', '×', '/', '(', ')'].map(op => (
                        <button 
                            key={op} 
                            onMouseDown={preventFocusLoss}
                            onClick={() => insertToken(op)} 
                            className="bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 font-mono text-lg font-bold py-3 shadow-sm active:scale-95 transition-all touch-manipulation"
                        >
                            {op}
                        </button>
                    ))}
                    <button 
                        onMouseDown={preventFocusLoss}
                        onClick={handleDelete}
                        className="bg-slate-800 hover:bg-red-900/30 rounded-lg border border-slate-700 text-red-400 py-3 shadow-sm active:scale-95 transition-all flex items-center justify-center touch-manipulation"
                    >
                        <Delete size={20} />
                    </button>
                </div>

                {/* Row 2: Variables */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                    {/* Existing Variables */}
                    {existingXVars.map(v => (
                        <button 
                            key={v} 
                            onMouseDown={preventFocusLoss}
                            onClick={() => insertToken(v)} 
                            className="px-4 py-3 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 font-mono font-bold rounded-lg text-sm active:scale-95 transition-all min-w-[3rem] touch-manipulation"
                        >
                            {v}
                        </button>
                    ))}
                    
                    {/* Add Next Variable Button */}
                    <button 
                        onMouseDown={preventFocusLoss}
                        onClick={handleAddNextVar} 
                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-sm active:scale-95 transition-all shadow-lg shadow-indigo-900/50 flex items-center gap-1 min-w-[4rem] whitespace-nowrap touch-manipulation"
                    >
                        <Plus size={14} /> xi
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Variable Mapping Section - Only visible when LOCKED */}
      {isLocked && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calculator size={12} /> 變數對應
                </label>
                <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">{variableList.length} 個變數</span>
              </div>
              
              <div className="space-y-2 bg-slate-900/50 rounded-xl p-2 border border-slate-800">
                  {variableList.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-500 italic flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                              <Sparkles size={14} />
                          </div>
                          公式中沒有偵測到變數<br/>將直接輸出計算結果
                      </div>
                  )}
                  
                  {variableList.map(([key, mapObj]) => (
                      <div key={key} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 group transition-colors hover:border-slate-600">
                          <div className="w-10 h-10 flex items-center justify-center bg-indigo-900/30 text-indigo-300 font-mono font-bold rounded-md border border-indigo-500/30 shrink-0">
                              {key}
                          </div>
                          <ArrowRight size={14} className="text-slate-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                              <select 
                                value={mapObj.id} 
                                onChange={(e) => handleUpdateMapping(key, e.target.value)}
                                className="w-full bg-slate-900 text-slate-200 text-sm border border-slate-600 rounded p-2 outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                  {availableColumns.length === 0 ? (
                                      <option disabled>無其他欄位</option>
                                  ) : (
                                      availableColumns.map(c => (
                                          <option key={c.id} value={c.id}>{c.name}</option>
                                      ))
                                  )}
                              </select>
                          </div>
                      </div>
                  ))}
              </div>
              
              {availableColumns.length === 0 && variableList.length > 0 && (
                  <p className="text-[10px] text-red-400 mt-2 text-center bg-red-900/10 p-2 rounded border border-red-900/30">
                      警告：沒有其他欄位可供參照，請先建立其他計分項目。
                  </p>
              )}
          </div>
      )}

    </div>
  );
};

export default EditorTabAuto;
