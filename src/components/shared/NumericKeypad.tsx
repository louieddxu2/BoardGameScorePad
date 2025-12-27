
import React, { useState, useEffect, useRef } from 'react';
import { Delete, Ruler, Calculator, Hash, X, Dot, ArrowDown, PlusSquare, Trash2, ArrowRight } from 'lucide-react';
import { ScoreColumn } from '../../types';
import { getRawValue, getScoreHistory, calculateColumnScore } from '../../utils/scoring';

interface NumericKeypadContentProps {
  value: any;
  onChange: (val: any) => void;
  onNext: () => void;
  column: ScoreColumn;
  overwrite: boolean;
  setOverwrite: (v: boolean) => void;
  activeFactorIdx: 0 | 1;
  setActiveFactorIdx: (v: 0 | 1) => void;
  playerId: string;
}

export const NumericKeypadContent: React.FC<NumericKeypadContentProps> = (props) => {
  const {
    value,
    onChange,
    onNext,
    column,
    overwrite,
    setOverwrite,
    activeFactorIdx,
    setActiveFactorIdx,
  } = props;
  
  const triggerHaptic = () => {
      if (navigator.vibrate) navigator.vibrate(10);
  };

  const getCurrentValueRaw = (): string => {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const val = value.value;
      if (Object.is(val, -0)) return '-0';
      return String(val ?? 0);
    }
    return String(value ?? 0);
  };

  const getFactors = (): [string, string] => {
    let f1: any = 0;
    let f2: any = 1;
    
    if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors)) {
        f1 = value.factors[0] ?? 0;
        f2 = value.factors[1] ?? 1;
    }
    
    const s1 = Object.is(f1, -0) ? '-0' : String(f1);
    const s2 = Object.is(f2, -0) ? '-0' : String(f2);
    return [s1, s2];
  };

  const isProductMode = column.formula === 'a1×a2';

  const isToggleMode = (() => {
    if (overwrite) return false;
    if (isProductMode) {
      const factors = getFactors();
      const currentFactorStr = String(factors[activeFactorIdx]);
      return currentFactorStr !== '0' && currentFactorStr !== '-0';
    } else {
      const currentValStr = getCurrentValueRaw();
      return currentValStr !== '0' && currentValStr !== '-0';
    }
  })();


  const handleNumClick = (num: number) => {
    triggerHaptic();
    const processValue = (currentValStr: string) => {
      if (overwrite) return String(num);
      if (currentValStr === '0') return String(num);
      if (currentValStr === '-0') return `-${num}`;
      return currentValStr + num;
    };

    if (isProductMode) {
      const factors = getFactors();
      const currentFactorStr = factors[activeFactorIdx];
      const newFactorStr = processValue(currentFactorStr);
      const newFactors: (string|number)[] = [...factors];
      newFactors[activeFactorIdx] = newFactorStr.includes('.') ? newFactorStr : parseFloat(newFactorStr);
      const n1 = parseFloat(String(newFactors[0])) || 0;
      const n2 = parseFloat(String(newFactors[1])) || 0;
      onChange({ value: n1 * n2, factors: newFactors, history: [] });
    } else {
      const currentStr = getCurrentValueRaw();
      const newStr = processValue(currentStr);
      const newVal = newStr.includes('.') ? newStr : parseFloat(newStr);
      onChange({ value: newVal, history: [String(newVal)] });
    }
    setOverwrite(false);
  };

  const handleToggleSign = () => {
    triggerHaptic();
    const processValue = (currentValStr: string) => {
      if (overwrite || currentValStr === '0') return '-0';
      const numVal = parseFloat(currentValStr);
      if (isNaN(numVal)) return currentValStr.startsWith('-') ? currentValStr.substring(1) : '-' + currentValStr;
      return String(numVal * -1);
    };

    if (isProductMode) {
      const factors = getFactors();
      const currentFactorStr = factors[activeFactorIdx];
      const newFactorStr = processValue(currentFactorStr);
      const newFactors: string[] = [...factors];
      newFactors[activeFactorIdx] = newFactorStr;
      const n1 = parseFloat(newFactors[0]) || 0;
      const n2 = parseFloat(newFactors[1]) || 0;
      onChange({ value: n1 * n2, factors: newFactors, history: [] });
    } else {
      const currentStr = getCurrentValueRaw();
      const newStr = processValue(currentStr);
      onChange({ value: newStr, history: [newStr] });
    }
    setOverwrite(false);
  };

  const handleDecimal = () => {
      triggerHaptic();
      const processValue = (currentValStr: string) => {
        if (overwrite) return "0.";
        if (currentValStr.includes('.')) return currentValStr;
        return (currentValStr === '-0' ? '-0' : currentValStr) + '.';
      };
      if (isProductMode) {
          const factors = getFactors();
          const currentFactorStr = factors[activeFactorIdx];
          const newFactorStr = processValue(currentFactorStr);
          const newFactors: string[] = [...factors];
          newFactors[activeFactorIdx] = newFactorStr;
          const n1 = parseFloat(newFactors[0]) || 0;
          const n2 = parseFloat(newFactors[1]) || 0;
          onChange({ value: n1 * n2, factors: newFactors, history: [] });
      } else {
          const currentStr = getCurrentValueRaw();
          const newValStr = processValue(currentStr);
          onChange({ value: newValStr, history: [newValStr] });
      }
      setOverwrite(false);
  };

  const handleBackspace = () => {
    triggerHaptic();
    const processValue = (currentStr: string) => {
        if (overwrite) return '0';
        if (currentStr.length <= 1 || (currentStr.startsWith('-') && currentStr.length <= 2)) return '0';
        return currentStr.slice(0, -1);
    };
    if (isProductMode) {
        const factors = getFactors();
        const currentFactorStr = factors[activeFactorIdx];
        const newFactorStr = processValue(currentFactorStr);
        const newFactors: (string|number)[] = [...factors];
        newFactors[activeFactorIdx] = newFactorStr.includes('.') || newFactorStr === '-0' ? newFactorStr : parseFloat(newFactorStr);
        const n1 = parseFloat(String(newFactors[0])) || 0;
        const n2 = parseFloat(String(newFactors[1])) || 0;
        onChange({ value: n1*n2, factors: newFactors, history: [] });
    } else {
        const currentStr = getCurrentValueRaw();
        const newStr = processValue(currentStr);
        const newVal = newStr.includes('.') || newStr === '-0' ? newStr : parseFloat(newStr);
        onChange({ value: newVal, history: [String(newVal)] });
    }
    if (overwrite) setOverwrite(false);
  };
  
  return (
      <div className="grid grid-cols-3 grid-rows-4 gap-2 h-full">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
          <button key={num} onClick={() => handleNumClick(num)} className={`text-[32px] leading-none font-bold rounded-xl shadow-sm transition-all touch-manipulation active:scale-95 h-full ${overwrite ? 'bg-indigo-600 text-white shadow-indigo-900/50 hover:bg-indigo-500' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'}`}>{num}</button>
        ))}
        <div className="bg-slate-800 rounded-xl border border-slate-700 grid grid-rows-2 h-full overflow-hidden shadow-sm">
            <button onClick={handleToggleSign} className={`hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors active:scale-95 touch-manipulation font-bold ${!isToggleMode ? 'font-mono text-[28px] leading-none' : 'text-xl'}`}>
              {isToggleMode ? '+/-' : '-'}
            </button>
            <button onClick={handleDecimal} className="border-t border-slate-700 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors active:scale-95 touch-manipulation"><Dot size={32} /></button>
        </div>
        <button onClick={() => handleNumClick(0)} className={`text-[32px] leading-none font-bold rounded-xl touch-manipulation active:scale-95 transition-all h-full ${overwrite ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white border border-slate-700'}`}>0</button>
        <button onClick={handleBackspace} className="bg-slate-800 hover:bg-red-900/30 text-red-400 rounded-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-transform h-full"><Delete size={32} /></button>
      </div>
  );
};

interface NumericKeypadInfoProps {
  column: ScoreColumn;
  value: any;
  activeFactorIdx?: 0 | 1;
  setActiveFactorIdx?: (idx: 0 | 1) => void;
  localKeypadValue?: any;
  onDeleteLastPart?: () => void;
  setOverwrite?: (v: boolean) => void; // Added Prop
}

export const NumericKeypadInfo: React.FC<NumericKeypadInfoProps> = ({ column, value, activeFactorIdx, setActiveFactorIdx, localKeypadValue, onDeleteLastPart, setOverwrite }) => {
    const activeRuleRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rawValueForEffect = getRawValue(value);

    useEffect(() => {
        if (activeRuleRef.current) {
            activeRuleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [rawValueForEffect]);

    const historyParts = (column.formula || '').includes('+next') ? getScoreHistory(value) : [];

    useEffect(() => {
        if ((column.formula || '').includes('+next') && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [historyParts.length, column.formula]);

    if (column.formula === 'a1×a2') {
      const factors = getFactors(value);
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
                    setOverwrite?.(true); // Trigger overwrite mode
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
                    setOverwrite?.(true); // Trigger overwrite mode
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
    }
    
    if ((column.formula || '').includes('+next')) {
      const parts = historyParts;
      const currentInputRaw = (typeof localKeypadValue === 'object') ? localKeypadValue.value : localKeypadValue;
      const currentInputStr = String(currentInputRaw || '0');
      const hasMappingRules = column.f1 && column.f1.length > 0;
      const showInputPreview = !(column.inputType === 'clicker' && !hasMappingRules);

      return (
        <div className="flex flex-col h-full">
            <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center gap-1 shrink-0 px-2 pt-2"><PlusSquare size={12} /> 分項累加</div>
            <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-1" ref={scrollContainerRef}>
                <div className="min-h-full flex flex-col justify-end">
                    {parts.length === 0 && <div className="flex-1 flex items-center justify-center text-xs text-slate-600 italic">尚無分項</div>}
                    {parts.map((part, idx) => {
                        const isLast = idx === parts.length - 1;
                        if (isLast) {
                            return (
                                <div key={idx} className="flex items-center justify-between pt-2 pb-1 relative animate-in fade-in slide-in-from-bottom-1">
                                    {onDeleteLastPart && (
                                        <button onClick={onDeleteLastPart} className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-md border border-red-900 transition-transform active:scale-95" title="刪除"><X size={12} strokeWidth={3} /></button>
                                    )}
                                    <div className="flex-1 text-right">
                                        <div className="inline-block bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                            <span className="text-lg font-bold text-white font-mono leading-none tracking-tight">{part}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return <div key={idx} className="text-sm text-slate-500 font-mono leading-tight text-right pr-1 pb-1">{part}</div>;
                    })}
                </div>
            </div>
            {showInputPreview && (
                <div className="shrink-0 px-2 pb-1 relative">
                    <div className="border-t border-white/20 mb-1"></div>
                    <div className="bg-emerald-900/30 border border-emerald-500 rounded-md px-2 py-0.5 text-right shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                        <span className="text-2xl font-bold text-white font-mono leading-tight">{currentInputStr}</span>
                    </div>
                </div>
            )}
        </div>
      );
    }

    const unit = column.unit || '';
    if (column.f1 && column.f1.length > 0) {
        const currentVal = parseFloat(String(getRawValue(value))) || 0;
        let activeRule = null;
        let effectiveMaxForActive: number | undefined = undefined;
        let finalScore = 0;

        for (let idx = 0; idx < column.f1.length; idx++) {
            const rule = column.f1[idx];
            let effectiveMax = Infinity;
            if (rule.max === 'next') {
                const nextRule = column.f1[idx + 1];
                if (nextRule && typeof nextRule.min === 'number') effectiveMax = nextRule.min - 1;
            } else if (typeof rule.max === 'number') {
                effectiveMax = rule.max;
            }
            const isMatch = (rule.min === undefined || currentVal >= rule.min) && (currentVal <= effectiveMax);
            if (isMatch) {
                activeRule = rule;
                effectiveMaxForActive = effectiveMax;
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
                 // 關鍵修改：顯示邏輯對應新欄位
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
                 const ruleUnit = Math.max(1, activeRule.unit || 1);
                 const excess = currentVal - prevLimit;
                 const count = Math.floor(excess / ruleUnit);
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
                    {column.f1.map((rule, idx) => {
                        let effectiveMax = Infinity;
                        if (rule.max === 'next') {
                            const nextRule = column.f1?.[idx + 1];
                            if (nextRule && typeof nextRule.min === 'number') effectiveMax = nextRule.min - 1;
                        } else if (typeof rule.max === 'number') {
                            effectiveMax = rule.max;
                        }
                        const isMatch = (rule.min === undefined || currentVal >= rule.min) && (currentVal <= effectiveMax);
                        const minVal = rule.min ?? 0;
                        let labelNode: React.ReactNode;
                        let scoreNode: React.ReactNode;
                        const unitStr = column.unit || '';

                        if (rule.isLinear) {
                            labelNode = <span>{minVal}+{unitStr}</span>;
                            // 關鍵修改：顯示邏輯對應新欄位
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
                             let text = (effectiveMax === Infinity) ? `${minVal}+${unitStr}` : (minVal === effectiveMax) ? `${minVal}${unitStr}` : `${minVal}~${effectiveMax}${unitStr}`;
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
                                 <span className="font-mono font-bold text-white text-sm leading-none">{currentVal}</span>
                            </div>
                            <ArrowRight size={12} className="text-slate-500" />
                            <div className="flex items-center"><span className="text-emerald-400 font-bold text-sm">{finalScore}</span></div>
                        </div>
                        <div className="flex justify-end min-h-[12px]">{footerCalculationNode}</div>
                    </div>
                </div>
            </div>
        );
    }
    
    let roundingText = (column.rounding === 'floor') ? '無條件捨去' : (column.rounding === 'ceil') ? '無條件進位' : (column.rounding === 'round') ? '四捨五入' : '';

    return (
        <div className="flex flex-col gap-2 h-full p-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><Calculator size={12} /> 數值運算</div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-2">
                <div className="bg-slate-800 rounded p-2 border border-slate-700 text-center">
                    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                        {column.formula === 'a1×c1' ? (
                            <><span className="text-xl font-bold text-emerald-400 font-mono leading-none">{column.constants?.c1 ?? 1}</span><span className="text-slate-500 text-xs leading-none">×</span></>
                        ) : null}
                        <span className="text-base font-bold text-slate-200 leading-none">{unit || '分'}</span>
                    </div>
                </div>
                {roundingText && (<div className="bg-slate-800 rounded p-2 border border-slate-700"><div className="text-[10px] text-slate-500 mb-1">小數處理</div><div className="flex items-center gap-2 text-indigo-300 font-medium text-sm"><Hash size={14} /> {roundingText}</div></div>)}
                {!column.isScoring && (<div className="bg-slate-800/50 rounded p-2 border border-slate-700/50 text-center"><span className="text-xs text-slate-500 italic">此欄位不計入總分</span></div>)}
            </div>
        </div>
    );
};

const getFactors = (value: any): [string | number, string | number] => {
  if (value && Array.isArray(value.parts)) return [value.parts[0] ?? 0, value.parts[1] ?? 1];
  if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors)) {
      return [value.factors[0] ?? 0, value.factors[1] ?? 1];
  }
  return [0, 1];
};

const NumericKeypad = (props: any) => <NumericKeypadContent {...props} />;
export default NumericKeypad;
