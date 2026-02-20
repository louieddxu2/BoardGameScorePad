
import React, { useState } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';

const CounterTool: React.FC = () => {
    const [count, setCount] = useState(0);

    const adjust = (delta: number) => {
        setCount(c => c + delta);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    return (
        <div className="w-full h-full bg-slate-800/50 rounded-2xl border border-slate-700/50 flex flex-col min-h-[96px] overflow-hidden">
            {/* Header / Reset */}
            <div className="flex justify-between items-center p-2 border-b border-slate-700/50 bg-slate-800/30">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">計數器</span>
                <button 
                    onClick={() => setCount(0)}
                    className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-700 transition-colors"
                    title="歸零"
                >
                    <RotateCcw size={12} />
                </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 flex items-center justify-between px-2 pb-1 gap-2">
                <button 
                    onClick={() => adjust(-1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-500/50 transition-all active:scale-90"
                >
                    <Minus size={18} />
                </button>
                
                <span className="text-3xl font-black font-mono text-slate-200 select-none">
                    {count}
                </span>

                <button 
                    onClick={() => adjust(1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-700/50 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-slate-600 hover:border-emerald-500/50 transition-all active:scale-90"
                >
                    <Plus size={18} />
                </button>
            </div>
        </div>
    );
};

export default CounterTool;
