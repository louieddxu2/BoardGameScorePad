
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScoreColumn, MappingRule } from '../../../types';
import { Sparkles, ArrowRight, Lock, Unlock, Check, Calculator, AlertCircle, Ruler, ChevronDown, ChevronUp, Delete, Trophy, Hash, Users, Sigma } from 'lucide-react';
import EditorTabMapping from './EditorTabMapping';
import { extractIdentifiers } from '../../../utils/formulaEvaluator';
import { useColumnEditorTranslation } from '../../../i18n/column_editor'; // Changed Import

interface EditorTabAutoProps {
    column: ScoreColumn;
    allColumns?: ScoreColumn[];
    onChange: (updates: Partial<ScoreColumn>) => void;
}

const PLAYER_COUNT_ID = '__PLAYER_COUNT__';

const EditorTabAuto: React.FC<EditorTabAutoProps> = ({ column, allColumns = [], onChange }) => {
    const { t } = useColumnEditorTranslation(); // Use New Hook
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
        mode?: 'value' | 'rank_score' | 'rank_player' | 'tie_count' | 'sum_all';
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
                                : { id: PLAYER_COUNT_ID, name: t('col_auto_player_count'), mode: 'value' }; // i18n
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
        if (!localFormula.trim()) { setParseError(t('col_auto_err_empty')); return; }

        const { vars: extractedVars, funcs: extractedFuncs } = extractIdentifiers(localFormula);

        try {
            let testFormula = localFormula.toLowerCase().replace(/×/g, '*');
            if (!/^[a-z0-9+\-*/().\s×,]+$/.test(testFormula)) throw new Error(t('col_auto_err_invalid_char'));

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

            if (typeof result !== 'number' && typeof result !== 'function') throw new Error(t('col_auto_err_invalid_result'));
        } catch (e) {
            setParseError(t('col_auto_err_syntax'));
            return;
        }

        // --- 同步變數設定 ---
        const newVariableMap: typeof variableMap = {};
        extractedVars.forEach(v => {
            // 保留舊設定，或是預設第一個可用欄位
            newVariableMap[v] = variableMap[v] || (availableColumns[0]
                ? { id: availableColumns[0].id, name: availableColumns[0].name, mode: 'value' }
                : { id: PLAYER_COUNT_ID, name: t('col_auto_player_count'), mode: 'value' });
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

    const insertToken = (token: string, cursorOffset: number = 0) => {
        if (isLocked) return;
        const input = inputRef.current;
        if (!input) return;
        const start = input.selectionStart ?? localFormula.length;
        const end = input.selectionEnd ?? localFormula.length;
        const newVal = localFormula.substring(0, start) + token + localFormula.substring(end);
        setLocalFormula(newVal);
        // Sync to parent immediately
        onChange({ formula: newVal });
        setTimeout(() => {
            input.focus();
            const newPos = start + token.length + cursorOffset;
            input.setSelectionRange(newPos, newPos);

            // [UX] Auto-scroll to keep cursor visible (centering strategy)
            // Estimate width for text-lg font-mono (approx 11px per char)
            const APPROX_CHAR_WIDTH = 11;
            const scrollPos = (newPos * APPROX_CHAR_WIDTH);
            input.scrollLeft = scrollPos - (input.clientWidth / 2);
        }, 0);
    };

    const isRoundingEnabled = column.rounding && column.rounding !== 'none';

    const toggleRounding = () => {
        onChange({ rounding: isRoundingEnabled ? 'none' : 'round' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
            <div className="flex items-start gap-3 bg-brand-secondary/10 p-3 rounded-xl border border-brand-secondary/20">
                <div className="p-2 bg-brand-secondary/20 rounded-lg text-brand-secondary shrink-0"><Sparkles size={24} /></div>
                <div>
                    <h3 className="font-black text-brand-secondary text-sm uppercase">{t('col_auto_title')}</h3>
                    <p className="text-xs text-txt-secondary mt-1 leading-relaxed font-bold">
                        {t('col_auto_desc')}
                        <br />
                        {t('col_auto_example')}<code className="bg-modal-bg-recessed px-1 rounded mx-1">f1(x1) + f2(x2) * 5</code>
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-txt-muted uppercase">{t('col_auto_formula')}</label>
                    {parseError && !isLocked && <span className="text-[10px] text-status-warning flex items-center gap-1 animate-pulse font-black"><AlertCircle size={10} /> {parseError}</span>}
                </div>
                <div className="flex items-stretch gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="decimal"
                        value={localFormula}
                        onChange={e => {
                            const val = e.target.value;
                            setLocalFormula(val);
                            setParseError(null);
                            // Sync to parent immediately so we don't lose typed formula if saving without locking
                            onChange({ formula: val });
                        }}
                        placeholder="f1(x1) + f2(x2)"
                        disabled={isLocked}
                        className={`flex-1 min-w-0 border-2 rounded-xl p-4 font-mono text-lg font-black tracking-wide outline-none transition-all shadow-inner ${isLocked ? 'bg-modal-bg-recessed border-surface-border text-txt-muted' : 'bg-modal-bg border-brand-secondary/30 text-brand-secondary focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/10'}`}
                    />
                    {isLocked ?
                        <button onClick={() => setIsLocked(false)} className="px-4 bg-modal-bg-elevated text-txt-muted rounded-xl border border-surface-border flex items-center justify-center shadow-sm active:scale-95 transition-all">
                            <Unlock size={24} />
                        </button>
                        :
                        <button onClick={handleLock} className="px-4 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 flex items-center justify-center active:scale-95 transition-all">
                            <Check size={24} />
                        </button>
                    }
                </div>

                {!isLocked && (
                    <div className="space-y-2">
                        {/* 運算符號 */}
                        <div className="grid grid-cols-8 gap-1">
                            {['+', '-', '×', '/', '(', ')', ','].map(op => <button key={op} onMouseDown={e => e.preventDefault()} onClick={() => insertToken(op)} className="bg-modal-bg-elevated rounded-lg border border-surface-border text-txt-primary font-black py-2 text-sm hover:bg-surface-hover active:scale-90 transition-all">{op}</button>)}
                            <button onMouseDown={e => e.preventDefault()} onClick={() => {
                                const newVal = localFormula.slice(0, -1);
                                setLocalFormula(newVal);
                                onChange({ formula: newVal });
                            }} className="bg-modal-bg-elevated text-status-danger rounded-lg border border-surface-border py-2 flex items-center justify-center hover:bg-status-danger/10 active:scale-90 transition-all"><Delete size={16} /></button>
                        </div>

                        {/* 變數與函數快捷鍵 */}
                        <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                            {/* 已存在的變數 */}
                            {existingXVars.map(v => <button key={v} onMouseDown={e => e.preventDefault()} onClick={() => insertToken(v)} className="px-3 py-2 bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary font-mono rounded-lg text-xs font-black shadow-sm">{v}</button>)}

                            {/* 新增變數 */}
                            <button onMouseDown={e => e.preventDefault()} onClick={() => {
                                const nextId = existingXVars.length > 0 ? Math.max(...existingXVars.map(v => parseInt(v.substring(1)))) + 1 : 1;
                                insertToken(`x${nextId}`);
                            }} className="px-3 py-2 bg-brand-secondary text-white font-black rounded-lg text-xs flex items-center gap-1 shadow-lg shadow-brand-secondary/20 border border-brand-secondary/30 active:scale-95 transition-all">xi</button>

                            <div className="w-px h-6 bg-surface-border mx-2" />

                            {/* 已存在的函數 */}
                            {existingFuncs.map(f => (
                                <button key={f} onMouseDown={e => e.preventDefault()} onClick={() => insertToken(`${f}()`, -1)} className="px-3 py-2 bg-status-info/10 border border-status-info/20 text-status-info font-mono rounded-lg text-xs font-black shadow-sm">
                                    {f}()
                                </button>
                            ))}

                            {/* 新增函數 */}
                            <button onMouseDown={e => e.preventDefault()} onClick={() => {
                                const nextId = existingFuncs.length > 0 ? Math.max(...existingFuncs.map(f => parseInt(f.substring(1)))) + 1 : 1;
                                insertToken(`f${nextId}()`, -1);
                            }} className="px-3 py-2 bg-status-info text-white font-black rounded-lg text-xs flex items-center gap-1 shadow-lg shadow-status-info/20 border border-status-info/30 active:scale-95 transition-all">fi()</button>
                        </div>
                    </div>
                )}
            </div>

            {isLocked && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {/* 1. 變數設定區塊 */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-surface-border pb-2">
                            <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1"><Calculator size={12} /> {t('col_auto_vars')}</label>
                        </div>
                        <div className="space-y-2">
                            {variableList.length === 0 && <div className="text-center py-4 text-xs text-txt-muted italic bg-modal-bg-recessed rounded-xl">{t('col_auto_no_vars')}</div>}
                            {variableList.map(([key, mapObj]) => {
                                const currentMode = mapObj.mode || 'value';
                                const isPlayerCount = mapObj.id === PLAYER_COUNT_ID;

                                return (
                                    <div key={key} className="flex flex-col gap-2 bg-modal-bg-elevated p-2 rounded-xl border border-surface-border shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 flex items-center justify-center bg-brand-secondary/10 text-brand-secondary font-mono font-black rounded-lg border border-brand-secondary/20 shrink-0">{key}</div>
                                            <ArrowRight size={14} className="text-txt-muted shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <select
                                                    value={mapObj.id}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === PLAYER_COUNT_ID) {
                                                            onChange({ variableMap: { ...variableMap, [key]: { ...mapObj, id: PLAYER_COUNT_ID, name: t('col_auto_player_count') } } });
                                                        } else {
                                                            const targetCol = availableColumns.find(c => c.id === val);
                                                            if (targetCol) onChange({ variableMap: { ...variableMap, [key]: { ...mapObj, id: targetCol.id, name: targetCol.name } } });
                                                        }
                                                    }}
                                                    className="w-full bg-modal-bg text-txt-primary text-sm font-bold border border-surface-border rounded-lg p-2 outline-none focus:border-brand-secondary transition-all"
                                                >
                                                    <option value={PLAYER_COUNT_ID} className="text-brand-secondary font-bold">
                                                        {t('col_auto_player_count')}
                                                    </option>
                                                    <optgroup label={t('col_auto_score_items')}>
                                                        {availableColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Mode Selection - 隱藏當變數為玩家人數時 */}
                                        {!isPlayerCount && (
                                            <div className="flex items-center gap-2 pl-12">
                                                <span className="text-[10px] text-txt-muted shrink-0 uppercase font-bold">{t('col_auto_mode')}:</span>
                                                <select
                                                    value={currentMode}
                                                    onChange={(e) => {
                                                        const newMode = e.target.value as any;
                                                        onChange({ variableMap: { ...variableMap, [key]: { ...mapObj, mode: newMode } } });
                                                    }}
                                                    className={`flex-1 text-xs border rounded-lg p-1.5 outline-none font-black transition-all ${currentMode === 'value'
                                                            ? 'bg-modal-bg text-txt-secondary border-surface-border'
                                                            : 'bg-modal-bg text-status-warning border-status-warning/30'
                                                        }`}
                                                >
                                                    <option value="value">{t('col_auto_mode_val')}</option>
                                                    <option value="rank_score">{t('col_auto_mode_rank_score')} (1, 1, 2...)</option>
                                                    <option value="rank_player">{t('col_auto_mode_rank_player')} (1, 1, 3...)</option>
                                                    <option value="tie_count">{t('col_auto_mode_tie')}</option>
                                                    <option value="sum_all">{t('col_auto_mode_sum_all')}</option>
                                                </select>
                                            </div>
                                        )}
                                        {!isPlayerCount && currentMode !== 'value' && (
                                            <div className="pl-12 text-[10px] text-status-warning font-bold flex items-center gap-1">
                                                {currentMode === 'tie_count' ? <Hash size={10} /> : currentMode === 'sum_all' ? <Sigma size={10} /> : <Trophy size={10} />}
                                                {currentMode === 'rank_score' && t('col_auto_rank_score_desc')}
                                                {currentMode === 'rank_player' && t('col_auto_rank_player_desc')}
                                                {currentMode === 'tie_count' && t('col_auto_tie_desc')}
                                                {currentMode === 'sum_all' && t('col_auto_sum_all_desc')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. 函數設定區塊 */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-surface-border pb-2">
                            <label className="text-xs font-bold text-txt-muted uppercase flex items-center gap-1"><Ruler size={12} /> {t('col_auto_funcs')}</label>
                        </div>

                        <div className="space-y-2">
                            {Object.keys(functions).length === 0 && <div className="text-center py-4 text-xs text-txt-muted italic bg-modal-bg-recessed rounded-xl">{t('col_auto_no_funcs')}</div>}

                            {Object.keys(functions).sort().map(fKey => (
                                <div key={fKey} className="bg-modal-bg-elevated rounded-xl border border-surface-border overflow-hidden transition-all shadow-sm">
                                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-hover" onClick={() => setExpandedFunc(expandedFunc === fKey ? null : fKey)}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-status-info/10 text-status-info font-mono font-black rounded-lg flex items-center justify-center border border-status-info/20">{fKey}</div>
                                            <span className="text-sm font-black text-txt-primary">
                                                {functions[fKey].length} {t('col_auto_rules_count')}
                                            </span>
                                        </div>
                                        {expandedFunc === fKey ? <ChevronUp size={20} className="text-txt-muted" /> : <ChevronDown size={20} className="text-txt-muted" />}
                                    </div>
                                    {expandedFunc === fKey && (
                                        <div className="p-3 bg-modal-bg-recessed border-t border-surface-border animate-in slide-in-from-top-2">
                                            <EditorTabMapping
                                                column={{ ...column, f1: functions[fKey] } as any}
                                                onChange={(updates) => {
                                                    if (updates.f1) {
                                                        updateFunctionRules(fKey, updates.f1);
                                                    }
                                                }}
                                                hideUnitInput={true}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Rounding Section */}
                    <div className="space-y-2 pt-6 border-t border-surface-border">
                        <div
                            onClick={toggleRounding}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-300 active:scale-[0.98] ${isRoundingEnabled ? 'bg-brand-secondary/10 border-brand-secondary/50 shadow-sm' : 'bg-modal-bg-elevated border-surface-border hover:bg-surface-hover'}`}
                        >
                            <span className={`text-sm font-black transition-colors ${isRoundingEnabled ? 'text-brand-secondary' : 'text-txt-secondary'}`}>{t('col_rounding_enable')}</span>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${isRoundingEnabled ? 'bg-brand-secondary' : 'bg-surface-border'}`}>
                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform duration-300 ${isRoundingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                        </div>
                        {isRoundingEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-2 pt-4 pl-4 border-l-2 border-brand-secondary/30 ml-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {(['floor', 'ceil', 'round'] as const).map(mode => (
                                        <button key={mode} onClick={() => onChange({ rounding: mode })} className={`py-2 px-1 rounded-lg border text-xs font-black transition-all active:scale-95 ${column.rounding === mode ? 'bg-brand-secondary border-brand-secondary/50 text-white shadow-lg shadow-brand-secondary/20' : 'bg-modal-bg border-surface-border text-txt-muted'}`}>
                                            {mode === 'floor' ? t('col_round_floor') : mode === 'ceil' ? t('col_round_ceil') : t('col_round_round')}
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
