
import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowDown, Delete, Ruler, Calculator, Hash, X, Dot } from 'lucide-react';
import { ScoreColumn } from '../types';

interface NumericKeypadProps {
  value: any;
  onChange: (val: any) => void;
  onNext: () => void;
  direction: 'horizontal' | 'vertical';
  column: ScoreColumn;
  overwrite: boolean;
  setOverwrite: (v: boolean) => void;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  onNext,
  direction,
  column,
  overwrite,
  setOverwrite
}) => {
  // State for Product Mode
  // 0 = Input A, 1 = Input B
  const [activeFactorIdx, setActiveFactorIdx] = useState<0 | 1>(0);

  // Initialize active factor when column changes (mounting)
  useEffect(() => {
    setActiveFactorIdx(0);
  }, [column.id]);

  // Helper to extract raw value as string or number
  const getCurrentValueRaw = (): string | number => {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return value.value ?? 0;
    }
    return value ?? 0;
  };

  // Helper to get factors for Product Mode, allowing strings for intermediate input
  const getFactors = (): [string | number, string | number] => {
    if (typeof value === 'object' && value !== null && 'factors' in value && Array.isArray(value.factors) && value.factors.length === 2) {
        return value.factors as [string | number, string | number];
    }
    return [0, 0];
  };

  const isProductMode = column.calculationType === 'product';

  const handleNumClick = (num: number) => {
    if (isProductMode) {
        // Product Mode Logic
        const factors = getFactors();
        const currentFactorVal = factors[activeFactorIdx];
        const currentFactorStr = String(currentFactorVal);

        let newFactorVal: string | number = num;
        if (!overwrite) {
            if (currentFactorStr === '0' && num === 0) return;
            const newValStr = (currentFactorStr === '0') ? String(num) : currentFactorStr + num;
            // Keep as string to support "0.0" etc, but if simple int, it's fine.
            newFactorVal = newValStr.includes('.') ? newValStr : parseFloat(newValStr);
        }

        const newFactors = [...factors] as [string | number, string | number];
        newFactors[activeFactorIdx] = newFactorVal;

        // Auto-calculate total
        const n1 = parseFloat(String(newFactors[0])) || 0;
        const n2 = parseFloat(String(newFactors[1])) || 0;
        const total = n1 * n2;
        
        onChange({
            value: total,
            factors: newFactors,
            history: [String(total)] 
        });
        
        if (overwrite) setOverwrite(false);

    } else {
        // Standard Mode Logic
        if (overwrite) {
            onChange({
                value: num,
                history: [String(num)]
            });
            setOverwrite(false);
        } else {
            const currentVal = getCurrentValueRaw();
            const currentStr = String(currentVal);
            if (currentStr === '0' && num === 0) return;
            
            const newValStr = (currentStr === '0') ? String(num) : currentStr + num;
            const newVal = newValStr.includes('.') ? newValStr : parseFloat(newValStr);

            onChange({
                value: newVal,
                history: [String(newVal)] 
            });
        }
    }
  };

  const handleDecimal = () => {
      if (isProductMode) {
          const factors = getFactors();
          const currentFactorVal = factors[activeFactorIdx];
          const currentFactorStr = String(currentFactorVal);

          if (overwrite) {
              const newFactors = [...factors] as [string | number, string | number];
              newFactors[activeFactorIdx] = "0.";
              const n1 = parseFloat(String(newFactors[0])) || 0;
              const n2 = parseFloat(String(newFactors[1])) || 0;
              onChange({ value: n1 * n2, factors: newFactors, history: [] });
              setOverwrite(false);
              return;
          }

          if (currentFactorStr.includes('.')) return; // Already has decimal

          const newFactorStr = currentFactorStr + '.';
          const newFactors = [...factors] as [string | number, string | number];
          newFactors[activeFactorIdx] = newFactorStr;
          
          const n1 = parseFloat(String(newFactors[0])) || 0;
          const n2 = parseFloat(String(newFactors[1])) || 0;
          
          onChange({ value: n1 * n2, factors: newFactors, history: [] });

      } else {
          const currentVal = getCurrentValueRaw();
          const currentStr = String(currentVal);

          if (overwrite) {
              onChange({ value: "0.", history: ["0."] });
              setOverwrite(false);
              return;
          }

          if (currentStr.includes('.')) return;

          const newValStr = currentStr + '.';
          onChange({ value: newValStr, history: [newValStr] });
      }
  };

  const handleBackspace = () => {
    if (isProductMode) {
        if (overwrite) {
             const factors = getFactors();
             const newFactors = [...factors] as [string | number, string | number];
             newFactors[activeFactorIdx] = 0;
             const n1 = parseFloat(String(newFactors[0])) || 0;
             const n2 = parseFloat(String(newFactors[1])) || 0;
             onChange({ value: n1*n2, factors: newFactors, history: [] });
             setOverwrite(false);
             return;
        }

        const factors = getFactors();
        const currentFactorStr = String(factors[activeFactorIdx]);
        let newFactorVal: string | number = 0;

        if (currentFactorStr.length > 1) {
            const sliced = currentFactorStr.slice(0, -1);
            // If empty or just "-", revert to 0
            if (sliced === '' || sliced === '-') newFactorVal = 0;
            else newFactorVal = sliced.endsWith('.') ? sliced : parseFloat(sliced);
             // If we sliced off the decimal but still have digits, check if we should keep as string?
             if (sliced.endsWith('.')) newFactorVal = sliced;
        }

        const newFactors = [...factors] as [string | number, string | number];
        newFactors[activeFactorIdx] = newFactorVal;
        
        const n1 = parseFloat(String(newFactors[0])) || 0;
        const n2 = parseFloat(String(newFactors[1])) || 0;

        onChange({
            value: n1*n2,
            factors: newFactors,
            history: []
        });

    } else {
        if (overwrite) {
            onChange({ value: 0, history: [] });
            setOverwrite(false);
            return;
        }
        const currentVal = getCurrentValueRaw();
        const currentStr = String(currentVal);
        
        if (currentStr.length <= 1) {
            onChange({ value: 0, history: [] });
        } else {
            const sliced = currentStr.slice(0, -1);
            let newVal: string | number = 0;
             if (sliced !== '' && sliced !== '-') {
                 newVal = sliced.endsWith('.') ? sliced : parseFloat(sliced);
                 if (sliced.endsWith('.')) newVal = sliced;
             }
            onChange({ value: newVal, history: [String(newVal)] });
        }
    }
  };

  const handleToggleSign = () => {
    if (isProductMode) {
        const factors = getFactors();
        const newFactors = [...factors] as [string | number, string | number];
        const val = parseFloat(String(newFactors[activeFactorIdx])) || 0;
        newFactors[activeFactorIdx] = val * -1;
        
        const n1 = parseFloat(String(newFactors[0])) || 0;
        const n2 = parseFloat(String(newFactors[1])) || 0;
        
        onChange({ value: n1*n2, factors: newFactors, history: [] });
        if (overwrite) setOverwrite(false);
    } else {
        const currentVal = parseFloat(String(getCurrentValueRaw())) || 0;
        const newVal = currentVal * -1;
        onChange({
            value: newVal,
            history: [String(newVal)]
        });
        if (overwrite) setOverwrite(false);
    }
  };

  const handleProductNext = () => {
      if (activeFactorIdx === 0) {
          setActiveFactorIdx(1);
          setOverwrite(true); 
      } else {
          onNext(); 
          setActiveFactorIdx(0); 
          setOverwrite(true);
      }
  };

  const renderProductUI = () => {
      const factors = getFactors();
      const unitA = column.subUnits?.[0] || '數量';
      const unitB = column.subUnits?.[1] || '單價';
      const unitTotal = column.unit || '分';
      
      const n1 = parseFloat(String(factors[0])) || 0;
      const n2 = parseFloat(String(factors[1])) || 0;
      
      // Calculate total with weight included for preview
      const weight = column.weight ?? 1;
      let total = n1 * n2 * weight;

      // Apply Rounding to Preview
      if (column.rounding) {
        switch (column.rounding) {
          case 'floor': total = Math.floor(total); break;
          case 'ceil': total = Math.ceil(total); break;
          case 'round': total = Math.round(total); break;
        }
      }

      return (
          <div className="flex flex-col h-full gap-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 flex items-center gap-1 shrink-0">
                  <Calculator size={12} /> 計算機
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2">
                  {/* Input A */}
                  <button 
                    onClick={() => { setActiveFactorIdx(0); setOverwrite(true); }}
                    className={`relative p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${activeFactorIdx === 0 ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/50 shadow-lg' : 'bg-slate-900 border-slate-700 opacity-60 hover:opacity-100'}`}
                  >
                      <span className={`text-2xl font-bold font-mono ${activeFactorIdx === 0 ? 'text-white' : 'text-slate-400'}`}>
                          {factors[0]}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{unitA}</span>
                  </button>
                  
                  {/* Operator */}
                  <div className="flex items-center justify-center text-slate-600">
                      <X size={16} />
                  </div>

                  {/* Input B */}
                  <button 
                    onClick={() => { setActiveFactorIdx(1); setOverwrite(true); }}
                    className={`relative p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${activeFactorIdx === 1 ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/50 shadow-lg' : 'bg-slate-900 border-slate-700 opacity-60 hover:opacity-100'}`}
                  >
                      <span className={`text-2xl font-bold font-mono ${activeFactorIdx === 1 ? 'text-white' : 'text-slate-400'}`}>
                          {factors[1]}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{unitB}</span>
                  </button>

                  {/* Result Preview */}
                  <div className="mt-auto pt-2 border-t border-slate-800 flex justify-between items-center px-1">
                      <span className="text-lg text-slate-600">=</span>
                      <span className="text-xl font-bold text-emerald-400">{total} <span className="text-xs font-normal text-slate-500">{unitTotal}</span></span>
                  </div>
              </div>
          </div>
      );
  };

  const renderRulesInfo = () => {
      const unit = column.unit || '';
      if (column.mappingRules && column.mappingRules.length > 0) {
          return (
              <div className="flex flex-col gap-1 h-full">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0">
                      <Ruler size={12} /> 查表規則
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 py-1">
                      {column.mappingRules.map((rule, idx) => {
                          let label = '';
                          if (rule.min !== undefined && rule.max !== undefined) {
                              if (rule.min === rule.max) label = `${rule.min}`;
                              else label = `${rule.min} ~ ${rule.max}`;
                          } else if (rule.min !== undefined) {
                              label = `${rule.min} +`;
                          } else if (rule.max !== undefined) {
                              label = `~ ${rule.max}`;
                          }
                          
                          const currentVal = parseFloat(String(getCurrentValueRaw())) || 0;
                          const isMatch = (rule.min === undefined || currentVal >= rule.min) && 
                                          (rule.max === undefined || currentVal <= rule.max);

                          return (
                              <div key={idx} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded border ${isMatch ? 'bg-indigo-900/50 border-indigo-500/50' : 'bg-slate-800 border-slate-700/50'}`}>
                                  <span className={isMatch ? 'text-indigo-200' : 'text-slate-400'}>
                                      {label} <span className="text-[10px] opacity-70">{unit}</span>
                                  </span>
                                  <span className={`font-bold font-mono ${isMatch ? 'text-white' : 'text-emerald-500'}`}>
                                      {rule.score} <span className="text-[9px] font-normal opacity-70">分</span>
                                  </span>
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
          <div className="flex flex-col gap-2 h-full">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0">
                  <Calculator size={12} /> 計算規則
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 py-2">
                  <div className="bg-slate-800 rounded p-2 border border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-1">基本倍率</div>
                      <div className="flex items-baseline gap-1">
                          <span className="text-slate-400 text-sm">x</span>
                          <span className="text-xl font-bold text-emerald-400">{column.weight ?? 1}</span>
                          <span className="text-xs text-slate-500">分 / {unit || '單位'}</span>
                      </div>
                  </div>
                  {roundingText && (
                      <div className="bg-slate-800 rounded p-2 border border-slate-700">
                          <div className="text-[10px] text-slate-500 mb-1">小數處理</div>
                          <div className="flex items-center gap-2 text-indigo-300 font-medium text-sm"><Hash size={14} /> {roundingText}</div>
                      </div>
                  )}

                  {!column.isScoring && (
                      <div className="bg-slate-800/50 rounded p-2 border border-slate-700/50 text-center">
                          <span className="text-xs text-slate-500 italic">此欄位不計入總分</span>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-4 gap-2 p-2 select-none bg-slate-900 border-t border-slate-800 h-full">
      <div className="col-span-3 grid grid-cols-3 grid-rows-4 gap-2 h-full">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
          <button key={num} onClick={() => handleNumClick(num)} className={`text-2xl font-bold rounded-xl shadow-sm transition-all touch-manipulation active:scale-95 h-full ${overwrite ? 'bg-indigo-600 text-white shadow-indigo-900/50 hover:bg-indigo-500' : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'}`}>{num}</button>
        ))}
        {/* Split container for +/- and . */}
        <div className="flex flex-col gap-1 h-full">
            <button 
                onClick={handleToggleSign} 
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-lg rounded-t-xl border border-slate-700 active:scale-95 transition-transform"
            >
                +/-
            </button>
            <button 
                onClick={handleDecimal} 
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xl rounded-b-xl border border-slate-700 active:scale-95 transition-transform"
            >
                <Dot size={24} className="mx-auto" />
            </button>
        </div>
        <button onClick={() => handleNumClick(0)} className={`text-2xl font-bold rounded-xl touch-manipulation active:scale-95 transition-all h-full ${overwrite ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white border border-slate-700'}`}>0</button>
        <button onClick={handleBackspace} className="bg-slate-800 hover:bg-red-900/30 text-red-400 rounded-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-transform h-full"><Delete size={24} /></button>
      </div>
      <div className="col-span-1 flex flex-col gap-2 h-full overflow-hidden">
         <div className="flex-1 overflow-hidden rounded-xl bg-slate-800/20 p-2 border border-slate-800">
             {isProductMode ? renderProductUI() : renderRulesInfo()}
         </div>
         <button onClick={isProductMode ? handleProductNext : onNext} className="flex-none h-16 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl flex flex-col items-center justify-center shadow-lg shadow-emerald-900/50 touch-manipulation transition-all active:scale-95 relative">
            {isProductMode && activeFactorIdx === 0 ? (
                <div className="flex flex-col items-center">
                    <ArrowDown size={20} className="mb-[-4px] opacity-50"/>
                    <ArrowDown size={20} />
                </div>
            ) : (
                direction === 'horizontal' ? <ArrowRight size={24} /> : <ArrowDown size={24} />
            )}
         </button>
      </div>
    </div>
  );
};
export default NumericKeypad;
