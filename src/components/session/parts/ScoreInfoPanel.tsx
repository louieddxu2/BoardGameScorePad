
import React, { useEffect, useRef } from 'react';
import { ScoreColumn, ScoreValue } from '../../../types';
import { getRawValue, getScoreHistory, calculateColumnScore } from '../../../utils/scoring';
import { Calculator, X, PlusSquare, Ruler, ArrowRight, Hash } from 'lucide-react';

// --- Helpers ---
const formatNum = (n: number) => {
    if (Object.is(n, -0)) return '-0';
    return String(n);
};

const getFactors = (value: any): [string | number, string | number] => {
  if (value && Array.isArray(value.parts)) return [value.parts[0] ?? 0, value.parts[1] ?? 1];
  if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors)) {
      return [value.factors[0] ?? 0, value.factors[1] ?? 1];
  }
  return [0, 1];
};

interface ScoreInfoPanelProps {
  column: ScoreColumn;
  value: any;
  activeFactorIdx?: 0 | 1;
  setActiveFactorIdx?: (idx: 0 | 1) => void;
  localKeypadValue?: any;
  onDeleteLastPart?: () => void;
  setOverwrite?: (v: boolean) => void;
}

// 1. InfoProduct: Handles "a1×a2"
const InfoProduct: React.FC<ScoreInfoPanelProps> = ({ column, value, activeFactorIdx, setActiveFactorIdx, setOverwrite, localKeypadValue }) => {
    // [Update] Use localKeypadValue for display if available
    const factors = getFactors(localKeypadValue || value);
    
    const unitA = column.subUnits?.[0] || '數量';
    const unitB = column.subUnits?.[1] || '單價';
    const unitTotal = column.unit || '分';
    const n1 = parseFloat(String(factors[0])) || 0;
    const n2 = parseFloat(String(factors[1])) || 1;
    let total = n1 * n2;
    if (column.rounding) {
      switch (column.rounding) {
        case 'floor': total = Math.floor(total); break;
        case 'ceil': total = Math.ceil(total); break;
        case 'round': total = Math.round(total); break;
      }
    }
    const isFactorAActive = activeFactorIdx === 0;
    const isFactorBActive = activeFactorIdx === 1;

    return (
      <div className="flex flex-col h-full p-2">
        <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center gap-1 shrink-0"><Calculator size={12} /> 乘積輸入</div>
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar py-2 space-y-1">
            <div 
              className="flex items-center gap-1.5 cursor-pointer group" 
              onClick={() => { 
                  setActiveFactorIdx?.(0); 
                  setOverwrite?.(true); 
              }}
            >
                <div className={`flex-1 px-2 py-0.5 rounded-md border transition-all overflow-x-auto no-scrollbar flex items-center ${isFactorAActive ? 'bg-emerald-900/30 border-emerald-500' : 'bg-slate-900 border-slate-700 group-hover:border-slate-600'}`}>
                    <span className={`text-xl font-bold font-mono text-right w-full whitespace-nowrap leading-tight ${isFactorAActive ? 'text-white' : 'text-slate-400'}`}>{String(factors[0])}</span>
                </div>
                <span className={`shrink-0 text-xs uppercase text-right ${isFactorAActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{unitA}</span>
            </div>
            <div className="flex items-center justify-center text-slate-600"><X size={12} /></div>
            <div 
              className="flex items-center gap-1.5 cursor-pointer group" 
              onClick={() => { 
                  setActiveFactorIdx?.(1); 
                  setOverwrite?.(true);
              }}
            >
                <div className={`flex-1 px-2 py-0.5 rounded-md border transition-all overflow-x-auto no-scrollbar flex items-center ${isFactorBActive ? 'bg-emerald-900/30 border-emerald-500' : 'bg-slate-900 border-slate-700 group-hover:border-slate-600'}`}>
                    <span className={`text-xl font-bold font-mono text-right w-full whitespace-nowrap leading-tight ${isFactorBActive ? 'text-white' : 'text-slate-400'}`}>{String(factors[1])}</span>
                </div>
                <span className={`shrink-0 text-xs uppercase text-right ${isFactorBActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{unitB}</span>
            </div>
            <div className="pt-1 border-t border-slate-800 flex justify-between items-center px-1">
                <span className="text-lg text-slate-600">=</span>
                <span className="text-xl font-bold text-emerald-400">{total} <span className="text-xs font-normal text-slate-500">{unitTotal}</span></span>
            </div>
        </div>
      </div>
    );
};

// 2. InfoSumParts: Handles "+next" including "product+next"
const InfoSumParts: React.FC<ScoreInfoPanelProps> = ({ column, value, localKeypadValue, activeFactorIdx, setActiveFactorIdx, onDeleteLastPart, setOverwrite }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const historyParts = getScoreHistory(value);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [historyParts.length]);

    const parts = historyParts;
    const isProductSumParts = column.formula.includes('×a2');
    const constant = column.constants?.c1 ?? 1;
    const hasMultiplier = constant !== 1;
    
    // Show input preview for keypad OR if it's product-sum-parts mode
    const showInputPreview = column.inputType !== 'clicker' || isProductSumParts;

    // Get local factors for preview
    let currentFactors = [0, 1];
    let currentInputStr = "0";
    
    if (isProductSumParts) {
        if (localKeypadValue && typeof localKeypadValue === 'object' && localKeypadValue.factors) {
            currentFactors = localKeypadValue.factors;
        }
    } else {
        // [Update] Check for raw string value first to preserve "5." or "-0"
        if (localKeypadValue && typeof localKeypadValue === 'object' && 'value' in localKeypadValue) {
            currentInputStr = String(localKeypadValue.value);
        } else {
            const currentInputRaw = getRawValue(localKeypadValue);
            currentInputStr = String(currentInputRaw || '0');
            if (Object.is(currentInputRaw, -0)) currentInputStr = "-0";
        }
    }

    const isFactorAActive = activeFactorIdx === 0;
    const isFactorBActive = activeFactorIdx === 1;

    return (
      <div className="flex flex-col h-full">
          <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center gap-1 shrink-0 px-2 pt-2"><PlusSquare size={12} /> 分項累加 {isProductSumParts ? '(乘積)' : ''}</div>
          
          {/* History List */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-1" ref={scrollContainerRef}>
              <div className="min-h-full flex flex-col justify-end">
                  {parts.length === 0 && <div className="flex-1 flex items-center justify-center text-xs text-slate-600 italic">尚無分項</div>}
                  {parts.map((part, idx) => {
                      const rawPartVal = parseFloat(part);
                      const displayVal = formatNum(rawPartVal);
                      
                      const isLast = idx === parts.length - 1;
                      if (isLast) {
                          return (
                              <div key={idx} className="flex items-center justify-between pt-2 pb-1 relative animate-in fade-in slide-in-from-bottom-1">
                                  {onDeleteLastPart && (
                                      <button onClick={onDeleteLastPart} className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-md border border-red-900 transition-transform active:scale-95" title="刪除"><X size={12} strokeWidth={3} /></button>
                                  )}
                                  <div className="flex-1 text-right">
                                      <div className="inline-block bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                          <span className="text-lg font-bold text-white font-mono leading-none tracking-tight">{displayVal}</span>
                                      </div>
                                  </div>
                              </div>
                          );
                      }
                      return <div key={idx} className="text-sm text-slate-500 font-mono leading-tight text-right pr-1 pb-1">{displayVal}</div>;
                  })}
              </div>
          </div>

          {/* Input Area (Split or Single) */}
          {showInputPreview && (
              <div className="shrink-0 px-2 pb-1 relative">
                  <div className="border-t border-white/20 mb-1"></div>
                  
                  {isProductSumParts ? (
                      // Split Input: [ A ] x [ B ]
                      <div className="flex items-center gap-2">
                          <div 
                              onClick={() => { setActiveFactorIdx?.(0); setOverwrite?.(true); }}
                              className={`flex-1 bg-emerald-900/30 border rounded-md px-1 py-0.5 text-center shadow-[0_0_10px_rgba(16,185,129,0.1)] transition-colors cursor-pointer ${isFactorAActive ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-700 opacity-70 hover:opacity-100'}`}
                          >
                              <span className={`text-xl font-bold font-mono leading-tight ${isFactorAActive ? 'text-white' : 'text-slate-400'}`}>
                                  {String(currentFactors[0])}
                              </span>
                          </div>
                          
                          <span className="text-slate-500 text-xs font-bold">×</span>
                          
                          <div 
                              onClick={() => { setActiveFactorIdx?.(1); setOverwrite?.(true); }}
                              className={`flex-1 bg-emerald-900/30 border rounded-md px-1 py-0.5 text-center shadow-[0_0_10px_rgba(16,185,129,0.1)] transition-colors cursor-pointer ${isFactorBActive ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-700 opacity-70 hover:opacity-100'}`}
                          >
                              <span className={`text-xl font-bold font-mono leading-tight ${isFactorBActive ? 'text-white' : 'text-slate-400'}`}>
                                  {String(currentFactors[1])}
                              </span>
                          </div>
                      </div>
                  ) : hasMultiplier ? (
                      // Constant Multiplier Input: [ Input ] x Constant
                      <div className="flex items-center gap-2">
                          <div className="flex-1 bg-emerald-900/30 border border-emerald-500 rounded-md px-2 py-0.5 text-right shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                              <span className="text-2xl font-bold text-white font-mono leading-tight">{currentInputStr}</span>
                          </div>
                          <span className="text-slate-500 text-xs font-bold flex items-center whitespace-nowrap gap-0.5">
                              <X size={10} /> {constant}
                          </span>
                      </div>
                  ) : (
                      // Single Input
                      <div className="bg-emerald-900/30 border border-emerald-500 rounded-md px-2 py-0.5 text-right shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                          <span className="text-2xl font-bold text-white font-mono leading-tight">{currentInputStr}</span>
                      </div>
                  )}
              </div>
          )}
      </div>
    );
};

// 3. InfoMapping: Handles "f1(a1)" (Lookup Table)
const InfoMapping: React.FC<ScoreInfoPanelProps> = ({ column, value, localKeypadValue }) => {
    const activeRuleRef = useRef<HTMLDivElement>(null);
    const rawValueForEffect = getRawValue(localKeypadValue || value); // [Update] Use local value for effect dependency

    useEffect(() => {
        if (activeRuleRef.current) {
            activeRuleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [rawValueForEffect]);

    const unitStr = column.unit || '';
    
    // [Update] Get display string from localKeypadValue if available
    let displayVal: string | number = 0;
    if (localKeypadValue && typeof localKeypadValue === 'object' && 'value' in localKeypadValue) {
        displayVal = localKeypadValue.value;
    } else {
        displayVal = getRawValue(localKeypadValue || value);
    }
    
    // Logic still needs number
    const currentVal = parseFloat(String(displayVal)) || 0;
    
    // Calculate final score for footer display
    let activeRule = null;
    let finalScore = 0;

    for (let idx = 0; idx < (column.f1?.length || 0); idx++) {
        const rule = column.f1![idx];
        let isMatch = false;

        // [Updated] Continuous Range Match Logic
        if (rule.min !== undefined && currentVal < rule.min) {
             isMatch = false;
        } else if (rule.max === 'next') {
             const nextRule = column.f1![idx + 1];
             if (nextRule && typeof nextRule.min === 'number') {
                 // Match if < nextMin
                 isMatch = currentVal < nextRule.min;
             } else {
                 isMatch = true;
             }
        } else if (rule.max !== undefined) {
             isMatch = currentVal <= rule.max;
        } else {
             isMatch = true;
        }

        if (isMatch) {
            activeRule = rule;
            break;
        }
    }
    
    if (activeRule) {
            if (activeRule.isLinear) {
                const min = activeRule.min ?? 0;
                const prevLimit = min - 1;
                const baseScore = calculateColumnScore(column, [prevLimit]);
                const ruleUnit = Math.max(1, activeRule.unit || 1);
                const excess = currentVal - prevLimit;
                const count = Math.floor(excess / ruleUnit);
                const stepScore = activeRule.unitScore !== undefined ? activeRule.unitScore : activeRule.score;
                finalScore = baseScore + (count * stepScore);
            } else {
                finalScore = activeRule.score;
            }
    }
    
    let footerCalculationNode: React.ReactNode = null;
    if (activeRule) {
            if (activeRule.isLinear) {
                const min = activeRule.min ?? 0;
                const prevLimit = min - 1;
                const baseScore = calculateColumnScore(column, [prevLimit]);
                const count = Math.floor((currentVal - prevLimit) / Math.max(1, activeRule.unit || 1));
                const stepScore = activeRule.unitScore !== undefined ? activeRule.unitScore : activeRule.score;
                
                footerCalculationNode = (
                    <div className="flex items-center justify-end w-full leading-none whitespace-nowrap text-slate-400 font-mono text-[10px]">
                        <span>{baseScore}</span>
                        <span className="opacity-50">+</span>
                        <span>{stepScore}</span>
                        <span className="opacity-50">×</span>
                        <span>{count}</span>
                    </div>
                );
            } else {
                footerCalculationNode = <div className="flex items-center justify-end w-full text-[10px] text-slate-500 italic">固定分數</div>;
            }
    } else {
            footerCalculationNode = <span className="text-slate-500 text-[10px] italic">無規則</span>;
    }

    return (
        <div className="flex flex-col h-full p-2 overflow-hidden">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><Ruler size={12} /> 範圍查表</div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 py-1">
                {column.f1?.map((rule, idx) => {
                    // Display Logic for Label (Keep roughly using integer bounds for display "1~4")
                    let displayMax = Infinity;
                    if (rule.max === 'next') {
                        const nextRule = column.f1?.[idx + 1];
                        if (nextRule && typeof nextRule.min === 'number') displayMax = nextRule.min - 1;
                    } else if (typeof rule.max === 'number') {
                        displayMax = rule.max;
                    }
                    
                    // Matching Logic (Sync with above)
                    let isMatch = false;
                    if (rule.min !== undefined && currentVal < rule.min) {
                         isMatch = false;
                    } else if (rule.max === 'next') {
                         const nextRule = column.f1?.[idx + 1];
                         if (nextRule && typeof nextRule.min === 'number') {
                             isMatch = currentVal < nextRule.min;
                         } else {
                             isMatch = true;
                         }
                    } else if (rule.max !== undefined) {
                         isMatch = currentVal <= rule.max;
                    } else {
                         isMatch = true;
                    }

                    const minVal = rule.min ?? 0;
                    let labelNode: React.ReactNode;
                    let scoreNode: React.ReactNode;

                    if (rule.isLinear) {
                        labelNode = <span>{minVal}+{unitStr}</span>;
                        const stepScore = rule.unitScore !== undefined ? rule.unitScore : rule.score;
                        scoreNode = (
                            <div className="flex flex-col items-end justify-center leading-tight">
                                <span className="text-[10px] text-slate-500">每{rule.unit}{unitStr}</span>
                                <span className="flex items-center">
                                    <span className="text-[10px] text-slate-500">加</span>
                                    <span className="font-bold text-emerald-400 text-sm">{stepScore}</span>
                                </span>
                            </div>
                        );
                    } else {
                            let text = (displayMax === Infinity) ? `${minVal}+${unitStr}` : (minVal === displayMax) ? `${minVal}${unitStr}` : `${minVal}~${displayMax}${unitStr}`;
                            labelNode = <span>{text}</span>;
                            scoreNode = <span className="text-emerald-400 font-bold">{rule.score}</span>;
                    }

                    return (
                        <div key={idx} ref={isMatch ? activeRuleRef : null} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded border transition-colors ${isMatch ? 'bg-indigo-900/50 border-indigo-500/50' : 'bg-slate-800 border-slate-700/50'}`}>
                            <div className={`flex-1 text-right ${isMatch ? 'text-indigo-200 font-bold' : 'text-slate-400 font-medium'}`}>{labelNode}</div>
                            <div className={`shrink-0 px-1 ${isMatch ? 'text-indigo-400' : 'text-slate-600'}`}><ArrowRight size={12} /></div>
                            <div className={`flex-1 text-left font-mono ${isMatch ? 'text-white' : 'text-slate-400'}`}>{scoreNode}</div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 shrink-0">
                <div className="bg-slate-900 rounded-lg border border-indigo-500/40 p-2 shadow-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center border-b border-indigo-500/20 pb-2 mb-0.5">
                        <div className="bg-emerald-900/30 border border-emerald-500 rounded px-2 py-0.5 shadow-[0_0_10px_rgba(16,185,129,0.1)] flex items-baseline gap-1">
                                <span className="font-mono font-bold text-white text-sm leading-none">{displayVal}</span>
                        </div>
                        <ArrowRight size={12} className="text-slate-500" />
                        <div className="flex items-center"><span className="text-emerald-400 font-bold text-sm">{finalScore}</span></div>
                    </div>
                    <div className="flex justify-end min-h-[12px]">{footerCalculationNode}</div>
                </div>
            </div>
        </div>
    );
};

// 4. InfoStandard: Handles standard and constant multiplication
const InfoStandard: React.FC<ScoreInfoPanelProps> = ({ column }) => {
    let roundingText = (column.rounding === 'floor') ? '無條件捨去' : (column.rounding === 'ceil') ? '無條件進位' : (column.rounding === 'round') ? '四捨五入' : '';
    const unit = column.unit || '';

    return (
        <div className="flex flex-col gap-2 h-full p-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><Calculator size={12} /> 數值運算</div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-2">
                <div className="bg-slate-800 rounded p-2 border border-slate-700 text-center">
                    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                        <span className="text-base font-bold text-slate-200 leading-none">{unit || '分'}</span>
                        {column.formula === 'a1×c1' ? (
                            <><span className="text-slate-500 text-xs leading-none">×</span><span className="text-xl font-bold text-emerald-400 font-mono leading-none">{column.constants?.c1 ?? 1}</span></>
                        ) : null}
                    </div>
                </div>
                {roundingText && (<div className="bg-slate-800 rounded p-2 border border-slate-700"><div className="text-[10px] text-slate-500 mb-1">小數處理</div><div className="flex items-center gap-2 text-indigo-300 font-medium text-sm"><Hash size={14} /> {roundingText}</div></div>)}
                {!column.isScoring && (<div className="bg-slate-800/50 rounded p-2 border border-slate-700/50 text-center"><span className="text-xs text-slate-500 italic">此欄位不計入總分</span></div>)}
            </div>
        </div>
    );
};

// --- Main Container (Dispatcher) ---

const ScoreInfoPanel: React.FC<ScoreInfoPanelProps> = (props) => {
    const { column } = props;

    // Regular Product Mode (a1×a2)
    if (column.formula === 'a1×a2') {
        return <InfoProduct {...props} />;
    }
    
    // Sum Parts (including Product Sum Parts & Constant Sum Parts)
    if ((column.formula || '').includes('+next')) {
        return <InfoSumParts {...props} />;
    }

    // Mapping Rule
    if (column.f1 && column.f1.length > 0) {
        return <InfoMapping {...props} />;
    }
    
    // Standard / Default
    return <InfoStandard {...props} />;
};

export default ScoreInfoPanel;
