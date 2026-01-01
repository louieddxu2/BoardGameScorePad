
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScoreColumn, MappingRule } from '../../../types';
import { Sparkles, ArrowRight, Lock, Unlock, Check, Calculator, AlertCircle, Ruler, ChevronDown, ChevronUp, Delete, Trophy, Hash, Users } from 'lucide-react';
import EditorTabMapping from './EditorTabMapping';

interface EditorTabAutoProps {
  column: ScoreColumn;
  allColumns?: ScoreColumn[];
  onChange: (updates: Partial<ScoreColumn>) => void;
}

const MATH_KEYWORDS = new Set([
  'min', 'max', 'floor', 'ceil', 'round', 'abs', 'sin', 'cos', 'tan', 'log', 'sqrt', 'pow', 'pi', 'e'
]);

const PLAYER_COUNT_ID = '__PLAYER_COUNT__';

// 提取解析邏輯為獨立函數
const extractIdentifiers = (formula: string) => {
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

const EditorTabAuto: React.FC<EditorTabAutoProps> = ({ column, allColumns = [], onChange }) => {
  const [localFormula, setLocalFormula] = useState(column.formula || '');
  const [isLocked, setIsLocked] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [expandedFunc, setExpandedFunc] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const availableColumns = allColumns.filter(c => c.id !== column.id);
  
  // Explicitly type variableMap to fix TS errors on mapObj access
  const variableMap = (column.variableMap || {}) as Record<string, { 
    id: string; 
    name: string; 
    mode?: 'value' | 'rank_score' | 'rank_player' | 'tie_count';
  }>;
  const variableList = Object.entries(variableMap);
  
  const functions: Record<string, MappingRule[]> = useMemo(() => {
      return column.functions || (column.f1 ? { f1: column.f1 } : {});
  }, [column.functions, column.f1]);

  // 初始化檢查：自動解析公式並同步資料
  useEffect(() => {
    if (localFormula && localFormula.trim()) {
        try {
            const { vars, funcs } = extractIdentifiers(localFormula);
            
            // 只有當公式包含有效的變數或函數時才進行處理
            if (vars.length > 0 || funcs.length > 0) {
                // 1. 重建 Variable Map (保留既有設定)
                const newVariableMap: typeof variableMap = {};
                let mapChanged = false;
                
                vars.forEach(v => {
                    if (variableMap[v]) {
                        newVariableMap[v] = variableMap[v];
                    } else {
                        // 新增預設：如果沒有可用欄位，至少預設為空 (或可以是玩家人數)
                        newVariableMap[v] = availableColumns[0] 
                            ? { id: availableColumns[0].id, name: availableColumns[0].name, mode: 'value' } 
                            : { id: PLAYER_COUNT_ID, name: '玩家人數', mode: 'value' };
                        mapChanged = true;
                    }
                });
                
                // 檢查是否移除了舊變數
                if (Object.keys(variableMap).length !== vars.length) mapChanged = true;

                // 2. 重建 Functions (保留既有規則)
                const newFunctions: Record<string, MappingRule[]> = {};
                let funcChanged = false;

                funcs.forEach(fKey => {
                    if (functions[fKey]) {
                        newFunctions[fKey] = functions[fKey];
                    } else {
                        // 新增預設
                        newFunctions[fKey] = [{ min: 0, score: 0 }];
                        funcChanged = true;
                    }
                });

                if (Object.keys(functions).length !== funcs.length) funcChanged = true;

                // 3. 如果有變更，觸發 onChange 同步回父組件
                if (mapChanged || funcChanged) {
                    const updates: Partial<ScoreColumn> = {};
                    if (mapChanged) updates.variableMap = newVariableMap;
                    if (funcChanged) {
                        updates.functions = newFunctions;
                        // 同步 legacy f1
                        if (newFunctions['f1']) updates.f1 = newFunctions['f1'];
                    }
                    onChange(updates);
                }

                // 4. 自動鎖定以展示設定面板
                setIsLocked(true);
            }
        } catch (e) {
            // 初始化時的解析錯誤可忽略，等待使用者手動修正
        }
    }
  }, []); // 僅在 mount 時執行一次

  const existingXVars = useMemo(() => {
      const regex = /x(\d+)/g;
      const matches = localFormula.match(regex) || [];
      return Array.from(new Set(matches)).sort((a: string, b: string) => parseInt(a.substring(1)) - parseInt(b.substring(1)));
  }, [localFormula]);

  const existingFuncs = useMemo(() => {
      const regex = /f(\d+)/g;
      const matches = localFormula.match(regex) || [];
      return Array.from(new Set(matches)).sort((a: string, b: string) => parseInt(a.substring(1)) - parseInt(b.substring(1)));
  }, [localFormula]);

  const handleLock = () => {
    if (!localFormula.trim()) { setParseError("請輸入公式"); return; }
    
    const { vars: extractedVars, funcs: extractedFuncs } = extractIdentifiers(localFormula);

    try {
        let testFormula = localFormula.toLowerCase().replace(/×/g, '*');
        if (!/^[a-z0-9+\-*/().\s×,]+$/.test(testFormula)) throw new Error("非法符號");
        
        // 1. Dry Run - 替換變數為 1
        let dryRunFormula = testFormula;
        extractedVars.forEach(v => dryRunFormula = dryRunFormula.replace(new RegExp(`\\b${v}\\b`, 'g'), '1'));
        
        // 2. Dry Run - 準備函數 Mock
        const fnNames: string[] = [];
        const fnValues: any[] = [];
        extractedFuncs.forEach(f => {
            fnNames.push(f);
            fnValues.push((v: any) => v); // Mock identity function
        });

        // 3. 執行測試
        // eslint-disable-next-line no-new-func
        const evalFn = new Function(...fnNames, `"use strict"; return (${dryRunFormula})`);
        const result = evalFn(...fnValues);
        
        if (typeof result !== 'number' && typeof result !== 'function') throw new Error("無效結果");
    } catch (e) {
        setParseError("公式語法錯誤，請檢查符號與括號");
        return;
    }

    // --- 同步變數設定 ---
    const newVariableMap: typeof variableMap = {};
    extractedVars.forEach(v => {
        // 保留舊設定，或是預設第一個可用欄位
        newVariableMap[v] = variableMap[v] || (availableColumns[0] 
            ? { id: availableColumns[0].id, name: availableColumns[0].name, mode: 'value' } 
            : { id: PLAYER_COUNT_ID, name: '玩家人數', mode: 'value' });
    });

    // --- 同步函數設定 ---
    const newFunctions: Record<string, MappingRule[]> = {};
    extractedFuncs.forEach(fKey => {
        // 保留舊規則，或是建立新規則
        newFunctions[fKey] = functions[fKey] || [{ min: 0, score: 0 }];
    });

    // 更新所有狀態
    onChange({ 
        formula: localFormula,
        variableMap: newVariableMap,
        isAuto: true,
        inputType: 'auto',
        functions: newFunctions,
        // 如果有 f1，同步更新 legacy f1 欄位以保持向後相容
        f1: newFunctions['f1'] || undefined
    });

    setParseError(null);
    setIsLocked(true);
    
    // 如果只有一個新函數，自動展開它
    const newFuncKeys = Object.keys(newFunctions);
    if (newFuncKeys.length > 0 && !expandedFunc) {
        setExpandedFunc(newFuncKeys[0]);
    }
  };

  const updateFunctionRules = (fKey: string, newRules: MappingRule[]) => {
      const newFuncs = { ...functions, [fKey]: newRules };
      const updates: Partial<ScoreColumn> = { functions: newFuncs };
      if (fKey === 'f1') updates.f1 = newRules;
      onChange(updates);
  };

  const insertToken = (token: string) => {
      if (isLocked) return;
      const input = inputRef.current;
      if (!input) return;
      const start = input.selectionStart ?? localFormula.length;
      const end = input.selectionEnd ?? localFormula.length;
      const newVal = localFormula.substring(0, start) + token + localFormula.substring(end);
      setLocalFormula(newVal);
      setTimeout(() => {
          input.focus();
          const newPos = start + token.length;
          input.setSelectionRange(newPos, newPos);
      }, 0);
  };

  const isRoundingEnabled = column.rounding && column.rounding !== 'none';
  
  const toggleRounding = () => {
      onChange({ rounding: isRoundingEnabled ? 'none' : 'round' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
      <div className="flex items-start gap-3 bg-indigo-900/20 p-3 rounded-xl border border-indigo-500/30">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0"><Sparkles size={24} /></div>
          <div>
              <h3 className="font-bold text-indigo-200 text-sm">高級自動計算</h3>
              <p className="text-xs text-indigo-300/70 mt-1 leading-relaxed">
                  使用 <b>x1, x2...</b> 代表來源欄位，<b>f1(...), f2(...)</b> 代表查表規則。<br/>
                  例如：<code>f1(x1) + f2(x2) * 5</code>
              </p>
          </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-500 uppercase">計算公式</label>
            {parseError && !isLocked && <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse"><AlertCircle size={10} /> {parseError}</span>}
        </div>
        <div className="relative">
            <input ref={inputRef} type="text" inputMode="decimal" value={localFormula} onChange={e => { setLocalFormula(e.target.value); setParseError(null); }} placeholder="f1(x1) + f2(x2)" disabled={isLocked} className={`w-full border rounded-xl p-4 font-mono text-lg font-bold tracking-wide outline-none transition-all shadow-inner ${isLocked ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-900 border-indigo-500/50 text-white focus:ring-1 focus:ring-indigo-500'}`}/>
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {isLocked ? <button onClick={() => setIsLocked(false)} className="p-2 bg-slate-800 text-slate-400 rounded-lg border border-slate-600 text-xs font-bold"><Unlock size={14} /> 解鎖</button> : <button onClick={handleLock} className="p-2 bg-emerald-600 text-white rounded-lg shadow-lg text-xs font-bold"><Check size={14} /> 確認公式</button>}
            </div>
        </div>

        {!isLocked && (
            <div className="space-y-2">
                {/* 運算符號 */}
                <div className="grid grid-cols-8 gap-1">
                    {['+', '-', '×', '/', '(', ')', ','].map(op => <button key={op} onMouseDown={e => e.preventDefault()} onClick={() => insertToken(op)} className="bg-slate-800 rounded-lg border border-slate-700 text-slate-300 font-mono py-2 text-sm hover:bg-slate-700 active:bg-slate-600">{op}</button>)}
                    <button onMouseDown={e => e.preventDefault()} onClick={() => setLocalFormula(localFormula.slice(0, -1))} className="bg-slate-800 text-red-400 rounded-lg border border-slate-700 py-2 flex items-center justify-center hover:bg-red-900/20"><Delete size={16} /></button>
                </div>
                
                {/* 變數與函數快捷鍵 */}
                <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                    {/* 已存在的變數 */}
                    {existingXVars.map(v => <button key={v} onMouseDown={e => e.preventDefault()} onClick={() => insertToken(v)} className="px-3 py-2 bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 font-mono rounded-lg text-xs">{v}</button>)}
                    
                    {/* 新增變數 */}
                    <button onMouseDown={e => e.preventDefault()} onClick={() => {
                        const nextId = existingXVars.length > 0 ? Math.max(...existingXVars.map(v => parseInt(v.substring(1)))) + 1 : 1;
                        insertToken(`x${nextId}`);
                    }} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-md border border-indigo-400/50">xi</button>
                    
                    <div className="w-px h-6 bg-slate-700 mx-2" />
                    
                    {/* 已存在的函數 */}
                    {existingFuncs.map(f => (
                        <button key={f} onMouseDown={e => e.preventDefault()} onClick={() => insertToken(`${f}(`)} className="px-3 py-2 bg-purple-900/30 border border-purple-500/30 text-purple-300 font-mono rounded-lg text-xs">
                            {f}(
                        </button>
                    ))}

                    {/* 新增函數 */}
                    <button onMouseDown={e => e.preventDefault()} onClick={() => {
                        const nextId = existingFuncs.length > 0 ? Math.max(...existingFuncs.map(f => parseInt(f.substring(1)))) + 1 : 1;
                        insertToken(`f${nextId}(`);
                    }} className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-md border border-purple-500/50">fi(</button>
                </div>
            </div>
        )}
      </div>

      {isLocked && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              {/* 1. 變數設定區塊 */}
              <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Calculator size={12} /> 變數對應</label>
                  </div>
                  <div className="space-y-2">
                      {variableList.length === 0 && <div className="text-center py-4 text-xs text-slate-500 italic bg-slate-900/30 rounded-lg">公式中沒有變數</div>}
                      {variableList.map(([key, mapObj]) => {
                          const currentMode = mapObj.mode || 'value';
                          return (
                            <div key={key} className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 flex items-center justify-center bg-indigo-900/30 text-indigo-300 font-mono font-bold rounded-md border border-indigo-500/30 shrink-0">{key}</div>
                                    <ArrowRight size={14} className="text-slate-600 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <select 
                                            value={mapObj.id} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === PLAYER_COUNT_ID) {
                                                    onChange({ variableMap: { ...variableMap, [key]: { ...mapObj, id: PLAYER_COUNT_ID, name: '玩家人數' } } });
                                                } else {
                                                    const targetCol = availableColumns.find(c => c.id === val);
                                                    if (targetCol) onChange({ variableMap: { ...variableMap, [key]: { ...mapObj, id: targetCol.id, name: targetCol.name } } });
                                                }
                                            }} 
                                            className="w-full bg-slate-900 text-slate-200 text-sm border border-slate-600 rounded p-2 outline-none"
                                        >
                                            <option value={PLAYER_COUNT_ID} className="text-indigo-400 font-bold">
                                                👥 玩家人數 (本局設定)
                                            </option>
                                            <optgroup label="計分項目">
                                                {availableColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                                
                                {/* Mode Selection */}
                                <div className="flex items-center gap-2 pl-12">
                                    <span className="text-[10px] text-slate-500 shrink-0 uppercase">取值模式:</span>
                                    <select 
                                        value={currentMode} 
                                        onChange={(e) => {
                                            const newMode = e.target.value as any;
                                            onChange({ variableMap: { ...variableMap, [key]: { ...mapObj, mode: newMode } } });
                                        }}
                                        className={`flex-1 text-xs border rounded p-1.5 outline-none font-bold ${
                                            // 修正顏色：降低亮度，避免刺眼，同時確保在選單中可讀
                                            currentMode === 'value' 
                                                ? 'bg-slate-900 text-slate-400 border-slate-700' 
                                                : 'bg-slate-900 text-amber-500 border-amber-900'
                                        }`}
                                    >
                                        <option value="value">數值 (預設)</option>
                                        <option value="rank_score">分數排名 (1, 1, 2...)</option>
                                        <option value="rank_player">玩家排名 (1, 1, 3...)</option>
                                        <option value="tie_count">平手人數</option>
                                    </select>
                                </div>
                                {currentMode !== 'value' && (
                                    <div className="pl-12 text-[10px] text-amber-600/80 flex items-center gap-1">
                                        {currentMode === 'tie_count' ? <Hash size={10}/> : <Trophy size={10} />}
                                        {currentMode === 'rank_score' && "分數相同者並列，名次連續 (Dense Rank)"}
                                        {currentMode === 'rank_player' && "分數相同者並列，下一名次跳號 (Standard Rank)"}
                                        {currentMode === 'tie_count' && "計算與自己同分的人數"}
                                    </div>
                                )}
                            </div>
                          );
                      })}
                  </div>
              </div>

              {/* 2. 函數設定區塊 */}
              <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Ruler size={12} /> 函數規則定義</label>
                  </div>
                  
                  <div className="space-y-2">
                      {Object.keys(functions).length === 0 && <div className="text-center py-4 text-xs text-slate-500 italic bg-slate-900/30 rounded-lg">公式中沒有使用函數 (如 f1, f2)</div>}
                      
                      {Object.keys(functions).sort().map(fKey => (
                          <div key={fKey} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden transition-all">
                              <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800" onClick={() => setExpandedFunc(expandedFunc === fKey ? null : fKey)}>
                                  <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-purple-900/30 text-purple-400 font-mono font-bold rounded flex items-center justify-center border border-purple-500/30">{fKey}</div>
                                      <span className="text-sm font-bold text-slate-300">
                                          {functions[fKey].length} 條規則
                                      </span>
                                  </div>
                                  {expandedFunc === fKey ? <ChevronUp size={20} className="text-slate-500"/> : <ChevronDown size={20} className="text-slate-500"/>}
                              </div>
                              {expandedFunc === fKey && (
                                  <div className="p-3 bg-slate-900/30 border-t border-slate-700 animate-in slide-in-from-top-2">
                                      <EditorTabMapping 
                                        column={{ ...column, f1: functions[fKey] } as any} 
                                        onChange={(updates) => {
                                            if (updates.f1) {
                                                updateFunctionRules(fKey, updates.f1);
                                            }
                                        }} 
                                      />
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>

              {/* 3. Rounding Section */}
              <div className="space-y-2 pt-6 border-t border-slate-800">
                <div 
                    onClick={toggleRounding} 
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-300 ${isRoundingEnabled ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}
                >
                    <span className={`text-sm font-bold transition-colors ${isRoundingEnabled ? 'text-indigo-100' : 'text-slate-300'}`}>啟用小數點進位/捨去</span>
                    <div className={`w-12 h-6 rounded-full relative transition-colors ${isRoundingEnabled ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-300 ${isRoundingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </div>
                {isRoundingEnabled && (
                    <div className="animate-in fade-in slide-in-from-top-2 pt-4 pl-4 border-l-2 border-indigo-500 ml-4">
                        <div className="grid grid-cols-3 gap-2">
                            {(['floor', 'ceil', 'round'] as const).map(mode => (
                                <button key={mode} onClick={() => onChange({ rounding: mode })} className={`py-2 px-1 rounded-lg border text-xs font-bold ${column.rounding === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                    {mode === 'floor' ? '無條件捨去' : mode === 'ceil' ? '無條件進位' : '四捨五入'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
              </div>
          </div>
      )}
    </div>
  );
};

export default EditorTabAuto;
