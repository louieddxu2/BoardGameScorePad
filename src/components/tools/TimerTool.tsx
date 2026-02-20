
import React, { useState, useRef } from 'react';
import { Timer, RefreshCcw, Pause, Play } from 'lucide-react';

const TimerTool: React.FC = () => {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const toggle = () => {
        if (isRunning) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsRunning(false);
        } else {
            intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
            setIsRunning(true);
        }
    };

    const reset = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsRunning(false);
        setSeconds(0);
    };

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
        <button 
            onClick={toggle}
            className={`relative w-full h-full flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 min-h-[96px]
                ${isRunning ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/80'}
            `}
        >
            {seconds > 0 && !isRunning && (
                <div 
                    onClick={reset}
                    className="absolute top-1 right-1 p-2 text-slate-500 hover:text-red-400 z-10 hover:bg-slate-700 rounded-full transition-colors"
                >
                    <RefreshCcw size={14} />
                </div>
            )}
            
            {seconds === 0 && !isRunning ? (
                <>
                    <Timer size={28} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-bold">計時器</span>
                </>
            ) : (
                <>
                    <span className={`text-2xl font-black font-mono tracking-wider ${isRunning ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {timeStr}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                        {isRunning ? <Pause size={10} className="text-emerald-500 fill-current" /> : <Play size={10} className="text-slate-500 fill-current" />}
                        <span className={`text-[10px] ${isRunning ? 'text-emerald-500' : 'text-slate-500'}`}>
                            {isRunning ? '計時中' : '已暫停'}
                        </span>
                    </div>
                </>
            )}
        </button>
    );
};

export default TimerTool;
