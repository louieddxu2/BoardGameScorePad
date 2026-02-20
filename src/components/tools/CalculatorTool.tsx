
import React, { useState } from 'react';
import { Delete, Divide, X, Minus, Plus, Equal, RotateCcw } from 'lucide-react';

const CalculatorTool: React.FC = () => {
    const [display, setDisplay] = useState('0');
    const [prevVal, setPrevVal] = useState<number | null>(null);
    const [op, setOp] = useState<string | null>(null);
    const [newNumber, setNewNumber] = useState(true);

    const handleNum = (num: number) => {
        if (newNumber) {
            setDisplay(String(num));
            setNewNumber(false);
        } else {
            setDisplay(d => d === '0' ? String(num) : d + num);
        }
        if (navigator.vibrate) navigator.vibrate(5);
    };

    const handleOp = (operator: string) => {
        const current = parseFloat(display);
        
        if (prevVal === null) {
            setPrevVal(current);
        } else if (op) {
            const result = calculate(prevVal, current, op);
            setPrevVal(result);
            setDisplay(String(result));
        }
        
        setOp(operator);
        setNewNumber(true);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const calculate = (a: number, b: number, operator: string) => {
        switch (operator) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b !== 0 ? Math.round((a / b) * 100) / 100 : 0;
            default: return b;
        }
    };

    const handleEqual = () => {
        if (op && prevVal !== null) {
            const current = parseFloat(display);
            const result = calculate(prevVal, current, op);
            setDisplay(String(result));
            setPrevVal(null);
            setOp(null);
            setNewNumber(true);
            if (navigator.vibrate) navigator.vibrate(10);
        }
    };

    const handleClear = () => {
        setDisplay('0');
        setPrevVal(null);
        setOp(null);
        setNewNumber(true);
    };

    const btnClass = "flex items-center justify-center rounded-lg font-bold text-sm bg-slate-700/50 hover:bg-slate-600 text-slate-300 transition-colors active:scale-90 h-8";
    const opClass = "flex items-center justify-center rounded-lg font-bold text-sm bg-indigo-900/30 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-900/50 transition-colors active:scale-90 h-8";

    return (
        <div className="w-full h-full bg-slate-800/50 rounded-2xl border border-slate-700/50 p-2 flex flex-col gap-2 min-h-[180px]">
            {/* Display */}
            <div className="bg-slate-950/50 rounded-xl px-3 py-2 text-right font-mono text-xl font-bold text-emerald-400 truncate border border-slate-800/50 flex justify-between items-center">
                <span className="text-[10px] text-slate-600 font-sans">{op}</span>
                {display}
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-4 gap-1.5">
                <button onClick={handleClear} className="col-span-1 flex items-center justify-center rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 h-8"><RotateCcw size={14}/></button>
                <button onClick={() => handleOp('/')} className={opClass}><Divide size={14}/></button>
                <button onClick={() => handleOp('*')} className={opClass}><X size={14}/></button>
                <button onClick={() => handleOp('-')} className={opClass}><Minus size={14}/></button>
                
                <button onClick={() => handleNum(7)} className={btnClass}>7</button>
                <button onClick={() => handleNum(8)} className={btnClass}>8</button>
                <button onClick={() => handleNum(9)} className={btnClass}>9</button>
                <button onClick={() => handleOp('+')} className="row-span-2 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-95"><Plus size={16}/></button>

                <button onClick={() => handleNum(4)} className={btnClass}>4</button>
                <button onClick={() => handleNum(5)} className={btnClass}>5</button>
                <button onClick={() => handleNum(6)} className={btnClass}>6</button>
                
                <button onClick={() => handleNum(1)} className={btnClass}>1</button>
                <button onClick={() => handleNum(2)} className={btnClass}>2</button>
                <button onClick={() => handleNum(3)} className={btnClass}>3</button>
                <button onClick={handleEqual} className="row-span-2 flex items-center justify-center rounded-lg bg-slate-200 text-slate-900 font-bold active:scale-95"><Equal size={16}/></button>

                <button onClick={() => handleNum(0)} className="col-span-2 flex items-center justify-center rounded-lg font-bold text-sm bg-slate-700/50 hover:bg-slate-600 text-slate-300 h-8">0</button>
                <button onClick={() => handleNum(0)} className={btnClass} disabled>.</button>
            </div>
        </div>
    );
};

export default CalculatorTool;
