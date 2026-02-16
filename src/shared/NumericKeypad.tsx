
import React from 'react';
import { Delete, Dot } from 'lucide-react';
import { ScoreColumn } from '../../types';

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

const NumericKeypad: React.FC<NumericKeypadContentProps> = (props) => {
  const {
    value,
    onChange,
    column,
    overwrite,
    setOverwrite,
    activeFactorIdx,
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

  const getLocalFactors = (): [string, string] => {
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

  // Support both normal product (a1×a2) and sum-product ((a1×a2)+next)
  const isProductMode = column.formula.includes('×a2');

  const isToggleMode = (() => {
    if (overwrite) return false;
    if (isProductMode) {
      const factors = getLocalFactors();
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
      const factors = getLocalFactors();
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
      const factors = getLocalFactors();
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
          const factors = getLocalFactors();
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
        const factors = getLocalFactors();
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

export default NumericKeypad;
