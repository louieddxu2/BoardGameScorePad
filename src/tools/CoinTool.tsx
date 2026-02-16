
import React, { useState } from 'react';
import { CircleDollarSign } from 'lucide-react';

const CoinTool: React.FC = () => {
    const [result, setResult] = useState<'heads' | 'tails' | null>(null);
    const [isFlipping, setIsFlipping] = useState(false);

    const flip = () => {
        if (isFlipping) return;
        setIsFlipping(true);
        setResult(null);
        
        // Duration of animation
        setTimeout(() => {
            setResult(Math.random() > 0.5 ? 'heads' : 'tails');
            setIsFlipping(false);
            if (navigator.vibrate) navigator.vibrate(20);
        }, 800);
    };

    return (
        <button 
            onClick={flip}
            className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-800/50 hover:bg-slate-700/80 rounded-2xl border border-slate-700/50 transition-all active:scale-95 min-h-[96px] overflow-hidden relative"
        >
            {/* Background Hint Icon */}
            {!result && !isFlipping && (
                 <>
                    <div className="bg-yellow-500/10 p-2 rounded-full mb-1 text-yellow-500/80">
                         <CircleDollarSign size={24} />
                    </div>
                    <span className="text-xs text-slate-500 font-bold">擲硬幣</span>
                 </>
            )}

            {/* Coin Graphic */}
            {(result || isFlipping) && (
                <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center shadow-lg transition-transform duration-[800ms]
                    ${isFlipping ? 'animate-[spin_0.8s_ease-in-out_infinite] border-slate-300 bg-slate-800' : 'border-yellow-500 bg-yellow-500 text-yellow-900'}
                `}>
                    {isFlipping ? (
                        <div className="w-full h-full rounded-full border-t-2 border-b-2 border-white/50 animate-pulse"></div>
                    ) : (
                        <span className="font-black text-xl select-none">
                            {result === 'heads' ? 'H' : 'T'}
                        </span>
                    )}
                </div>
            )}
            
            {result && !isFlipping && (
                 <span className="text-[10px] text-yellow-500 font-bold mt-2 uppercase tracking-wider animate-in fade-in slide-in-from-bottom-1">
                     {result === 'heads' ? '正面 (Heads)' : '反面 (Tails)'}
                 </span>
            )}
        </button>
    );
};

export default CoinTool;
