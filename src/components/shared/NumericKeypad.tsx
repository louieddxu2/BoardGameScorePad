
import React, { useState, useEffect, useRef } from 'react';
import { Delete, Ruler, Calculator, Hash, X, Dot, ArrowDown, PlusSquare, Trash2 } from 'lucide-react';
import { ScoreColumn } from '../../types';
import { getRawValue, getScoreHistory } from '../../utils/scoring';

interface NumericKeypadContentProps {
  value: any;
  onChange: (val: any) => void;
  onNext: () => void;
  column: ScoreColumn;
  overwrite: boolean;
  setOverwrite: (v: boolean) => void;
  activeFactorIdx: 0 | 1; // Controlled from parent
  setActiveFactorIdx: (v: 0 | 1) => void; // Controlled from parent
  playerId: string; // Used to detect cell changes
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
  
  const getCurrentValueRaw = (): string => {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return String(value.value ?? 0);
    }
    return String(value ?? 0);
  };

  const getFactors = (): [string, string] => {
    if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors) && value.factors.length === 2) {
        return [String(value.factors[0]), String(value.factors[1])];
    }
    return ['0', '0'];
  };

  const isProductMode = column.calculationType === 'product';

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
    const processValue = (currentValStr: string) => {
      if (overwrite) {
        return String(num);
      }
      if (currentValStr === '0') {
        return String(num);
      }
      if (currentValStr === '-0') {
        return `-${num}`;
      }
      return currentValStr + num;
    };

    if (isProductMode) {
      const factors = getFactors();
      const currentFactorStr = factors[activeFactorIdx];
      const newFactorStr = processValue(currentFactorStr);

      const newFactors: [string|number, string|number] = [...factors];
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
    const processValue = (currentValStr: string) => {
      // Case A: Start of input (prefixing)
      if (overwrite || currentValStr === '0') {
        return '-0';
      }
      // Case B: Toggle existing number
      const numVal = parseFloat(currentValStr);
      if (isNaN(numVal)) { // It might be a partial string like "5."
        return currentValStr.startsWith('-') ? currentValStr.substring(1) : '-' + currentValStr;
      }
      return String(numVal * -1);
    };

    if (isProductMode) {
      const factors = getFactors();
      const currentFactorStr = factors[activeFactorIdx];
      const newFactorStr = processValue(currentFactorStr);

      const newFactors: [string, string] = [...factors];
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
      const processValue = (currentValStr: string) => {
        if (overwrite) return "0.";
        if (currentValStr.includes('.')) return currentValStr;
        return (currentValStr === '-0' ? '-0' : currentValStr) + '.';
      };

      if (isProductMode) {
          const factors = getFactors();
          const currentFactorStr = factors[activeFactorIdx];
          const newFactorStr = processValue(currentFactorStr);
          const newFactors: [string, string] = [...factors];
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
    const processValue = (currentStr: string) => {
        if (overwrite) return '0';
        if (currentStr.length <= 1 || (currentStr.startsWith('-') && currentStr.length <= 2)) {
            return '0';
        }
        return currentStr.slice(0, -1);
    };

    if (isProductMode) {
        const factors = getFactors();
        const currentFactorStr = factors[activeFactorIdx];
        const newFactorStr = processValue(currentFactorStr);

        const newFactors: [string|number, string|number] = [...factors];
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
  localKeypadValue?: any;
  onDeleteLastPart?: () => void;
}

export const NumericKeypadInfo: React.FC<NumericKeypadInfoProps> = ({ column, value, activeFactorIdx, localKeypadValue, onDeleteLastPart }) => {
    
    const activeRuleRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const rawValueForEffect = getRawValue(value);

    // Effect 1: Auto-scroll to active rule mapping
    useEffect(() => {
        if (activeRuleRef.current) {
            activeRuleRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [rawValueForEffect]);

    // Prepare history parts safely
    const historyParts = column.calculationType === 'sum-parts' ? getScoreHistory(value) : [];

    // Effect 2: Auto-scroll history in Sum-Parts mode
    useEffect(() => {
        if (column.calculationType === 'sum-parts' && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [historyParts.length, column.calculationType]);

    if (column.calculationType === 'product') {
      const factors = getFactors(value);
      const unitA = column.subUnits?.[0] || '數量';
      const unitB = column.subUnits?.[1] || '單價';
      const unitTotal = column.unit || '分';
      const n1 = parseFloat(String(factors[0])) || 0;
      const n2 = parseFloat(String(factors[1])) || 0;
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
          <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center gap-1 shrink-0"><Calculator size={12} /> 乘積運算</div>
          
          <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar py-2 space-y-1">
              
              {/* Factor A Input */}
              <div className="flex items-center gap-1.5">
                  <div className={`flex-1 px-2 py-0.5 rounded-md border transition-all overflow-x-auto no-scrollbar flex items-center ${isFactorAActive ? 'bg-emerald-900/30 border-emerald-500' : 'bg-slate-900 border-slate-700'}`}>
                      <span className={`text-xl font-bold font-mono text-right w-full whitespace-nowrap leading-tight ${isFactorAActive ? 'text-white' : 'text-slate-400'}`}>{String(factors[0])}</span>
                  </div>
                  <span className={`shrink-0 text-xs uppercase text-right ${isFactorAActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{unitA}</span>
              </div>
              
              {/* Multiply Symbol */}
              <div className="flex items-center justify-center text-slate-600"><X size={12} /></div>

              {/* Factor B Input */}
              <div className="flex items-center gap-1.5">
                  <div className={`flex-1 px-2 py-0.5 rounded-md border transition-all overflow-x-auto no-scrollbar flex items-center ${isFactorBActive ? 'bg-emerald-900/30 border-emerald-500' : 'bg-slate-900 border-slate-700'}`}>
                      <span className={`text-xl font-bold font-mono text-right w-full whitespace-nowrap leading-tight ${isFactorBActive ? 'text-white' : 'text-slate-400'}`}>{String(factors[1])}</span>
                  </div>
                  <span className={`shrink-0 text-xs uppercase text-right ${isFactorBActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{unitB}</span>
              </div>

              {/* Result */}
              <div className="pt-1 border-t border-slate-800 flex justify-between items-center px-1">
                  <span className="text-lg text-slate-600">=</span>
                  <span className="text-xl font-bold text-emerald-400">{total} <span className="text-xs font-normal text-slate-500">{unitTotal}</span></span>
              </div>
          </div>
        </div>
      );
    }
    
    if (column.calculationType === 'sum-parts') {
      const parts = historyParts;
      const currentInputRaw = (typeof localKeypadValue === 'object') ? localKeypadValue.value : localKeypadValue;
      const currentInputStr = String(currentInputRaw || '0');
      
      return (
        <div className="flex flex-col h-full">
            <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center gap-1 shrink-0 px-2 pt-2">
              <PlusSquare size={12} /> 分項加總
            </div>
            
            {/* 
                History List Container
                - Use a fragment or specific structure to handle the active last item.
            */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-1" ref={scrollContainerRef}>
                <div className="min-h-full flex flex-col justify-end">
                    {parts.length === 0 && (
                         <div className="flex-1 flex items-center justify-center text-xs text-slate-600 italic">尚無分項</div>
                    )}
                    {parts.map((part, idx) => {
                        const isLast = idx === parts.length - 1;
                        if (isLast) {
                            return (
                                <div key={idx} className="flex items-center justify-between pt-2 pb-1 relative animate-in fade-in slide-in-from-bottom-1">
                                    {onDeleteLastPart && (
                                        <button 
                                            onClick={onDeleteLastPart}
                                            className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-md border border-red-900 transition-transform active:scale-95"
                                            title="刪除"
                                        >
                                            <X size={12} strokeWidth={3} />
                                        </button>
                                    )}
                                    <div className="flex-1 text-right">
                                        <div className="inline-block bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                            <span className="text-lg font-bold text-white font-mono leading-none tracking-tight">{part}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={idx} className="text-sm text-slate-500 font-mono leading-tight text-right pr-1 pb-1">
                                {part}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Container */}
            <div className="shrink-0 px-2 pb-1 relative">
                {/* Simple Divider */}
                <div className="border-t border-white/20 mb-1"></div>
                
                {/* Current Input Box */}
                <div className="bg-emerald-900/30 border border-emerald-500 rounded-md px-2 py-0.5 text-right shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <span className="text-2xl font-bold text-white font-mono leading-tight">{currentInputStr}</span>
                </div>
            </div>
        </div>
      );
    }

    const unit = column.unit || '';
    if (column.mappingRules && column.mappingRules.length > 0) {
        return (
            <div className="flex flex-col gap-1 h-full p-2">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><Ruler size={12} /> 查表規則</div>
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 py-1">
                    {column.mappingRules.map((rule, idx) => {
                        const currentVal = parseFloat(String(getRawValue(value))) || 0;
                        
                        // Resolve effective max for comparison
                        let effectiveMax = Infinity;
                        if (rule.max === 'next') {
                            const nextRule = column.mappingRules?.[idx + 1];
                            if (nextRule && typeof nextRule.min === 'number') {
                                effectiveMax = nextRule.min - 1;
                            }
                        } else if (typeof rule.max === 'number') {
                            effectiveMax = rule.max;
                        }

                        // Generate Label
                        let label = '';
                        const displayMax = rule.max === 'next' && effectiveMax !== Infinity ? effectiveMax : rule.max;

                        if (rule.min !== undefined && displayMax !== undefined && displayMax !== 'next') {
                            if (rule.min === displayMax) label = `${rule.min}`;
                            else label = `${rule.min} ~ ${displayMax}`;
                        } else if (rule.min !== undefined) {
                             label = `${rule.min} +`;
                        } else if (displayMax !== undefined && displayMax !== 'next') {
                             label = `~ ${displayMax}`;
                        } else if (rule.max === 'next') {
                             label = `~`;
                        }

                        const isMatch = (rule.min === undefined || currentVal >= rule.min) && (currentVal <= effectiveMax);
                        
                        return (
                            <div 
                                key={idx} 
                                ref={isMatch ? activeRuleRef : null}
                                className={`flex items-center justify-between text-xs px-2 py-1.5 rounded border ${isMatch ? 'bg-indigo-900/50 border-indigo-500/50' : 'bg-slate-800 border-slate-700/50'}`}
                            >
                                <span className={isMatch ? 'text-indigo-200' : 'text-slate-400'}>{label} <span className="text-[10px] opacity-70">{unit}</span></span>
                                <span className={`font-bold font-mono ${isMatch ? 'text-white' : 'text-emerald-500'}`}>{rule.score} <span className="text-[9px] font-normal opacity-70">分</span></span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    
    let roundingText = '';
    switch (column.rounding) {
        case 'floor': roundingText = '無條件捨去'; break;
        case 'ceil': roundingText = '無條件進位'; break;
        case 'round': roundingText = '四捨五入'; break;
    }

    return (
        <div className="flex flex-col gap-2 h-full p-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0"><Calculator size={12} /> 計算規則</div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-2">
                <div className="bg-slate-800 rounded p-2 border border-slate-700 text-center">
                    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                        {(column.weight ?? 1) !== 1 ? (
                            <>
                                <span className="text-xl font-bold text-emerald-400 font-mono leading-none">{column.weight ?? 1}</span>
                                <span className="text-slate-500 text-xs leading-none">×</span>
                            </>
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
  if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors) && value.factors.length === 2) {
      return value.factors as [string | number, string | number];
  }
  return [0, 0];
};


const NumericKeypad = (props: any) => <NumericKeypadContent {...props} />;
export default NumericKeypad;
