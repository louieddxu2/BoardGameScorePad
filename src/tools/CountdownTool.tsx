
import React, { useState, useRef, useEffect } from 'react';
import { Hourglass, Play, Pause, RotateCcw, Bell, BellRing, BellOff } from 'lucide-react';

const CountdownTool: React.FC = () => {
    // Time in seconds
    const [timeLeft, setTimeLeft] = useState(0);
    const [initialTime, setInitialTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    
    // 0 = Off, otherwise seconds (10, 30, 60)
    const [warningThreshold, setWarningThreshold] = useState(10); 
    
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Initialize Audio Context (Lazy load)
    const getAudioCtx = () => {
        if (!audioCtxRef.current) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new Ctx();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    };

    const playTone = (freq: number, type: OscillatorType, duration: number, startTimeOffset: number = 0) => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);
        
        // Envelope to avoid clicking sound
        gain.gain.setValueAtTime(0.1, ctx.currentTime + startTimeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTimeOffset + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + startTimeOffset);
        osc.stop(ctx.currentTime + startTimeOffset + duration);
    };

    const playTick = () => {
        // High pitch short tick for warning
        playTone(880, 'sine', 0.1);
    };

    const playTimeUp = () => {
        // "Alarm" style pattern
        playTone(523.25, 'square', 0.1, 0);       // C5
        playTone(523.25, 'square', 0.1, 0.15);    // C5
        playTone(523.25, 'square', 0.4, 0.3);     // C5 Long
    };

    // Auto-stop when reaching 0
    useEffect(() => {
        if (isRunning) {
            if (timeLeft <= 0) {
                pause();
                setTimeLeft(0);
                // Vibrate pattern: 3 long vibrations
                if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
                playTimeUp();
            } else if (warningThreshold > 0 && timeLeft <= warningThreshold) {
                // Play warning sound every second
                playTick();
            }
        }
    }, [timeLeft]); // Dependency on timeLeft ensures this runs every tick

    // Cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    const start = () => {
        if (timeLeft <= 0) return;
        
        // Unlock audio context on user interaction
        getAudioCtx();

        if (!isRunning) {
            if (initialTime === 0) setInitialTime(timeLeft);
            
            setIsRunning(true);
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => Math.max(0, prev - 1));
            }, 1000);
        }
    };

    const pause = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsRunning(false);
    };

    const reset = () => {
        pause();
        if (timeLeft === 0 && initialTime > 0) {
            setTimeLeft(initialTime);
        } else {
            setTimeLeft(0);
            setInitialTime(0);
        }
    };

    const adjust = (delta: number) => {
        const newTime = Math.max(0, timeLeft + delta);
        setTimeLeft(newTime);
        if (!isRunning) {
            setInitialTime(newTime);
        }
    };

    const toggleWarning = () => {
        // Cycle: 10s -> 30s -> 60s -> Off (0)
        setWarningThreshold(prev => {
            if (prev === 10) return 30;
            if (prev === 30) return 60;
            if (prev === 60) return 0;
            return 10;
        });
    };

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const isTimeUp = timeLeft === 0 && initialTime > 0;
    const isWarning = isRunning && warningThreshold > 0 && timeLeft <= warningThreshold;

    const btnBase = "flex flex-col items-center justify-center p-2 rounded-xl active:scale-95 transition-all text-xs font-bold border";
    const btnAdd = `${btnBase} bg-emerald-900/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40`;
    const btnSub = `${btnBase} bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300`;

    return (
        <div className="w-full bg-slate-900/30 rounded-2xl border border-slate-800 p-3 flex flex-col gap-3 min-h-[160px]">
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Hourglass size={12} /> 倒計時器
                </span>
                
                <div className="flex items-center gap-2">
                    {/* Warning Toggle Button */}
                    <button 
                        onClick={toggleWarning}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors border
                            ${warningThreshold > 0 
                                ? 'bg-amber-900/20 text-amber-500 border-amber-500/30' 
                                : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'
                            }`}
                        title="倒數提醒設定"
                    >
                        {warningThreshold > 0 ? (
                            <>
                                <BellRing size={12} />
                                <span>{warningThreshold}秒</span>
                            </>
                        ) : (
                            <>
                                <BellOff size={12} />
                                <span>關閉</span>
                            </>
                        )}
                    </button>

                    <button 
                        onClick={reset}
                        className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-700 transition-colors"
                        title="重置"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            <div className="flex gap-4 flex-1">
                {/* Left: Display & Play Control */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div className={`text-4xl font-black font-mono tracking-wider transition-colors 
                        ${isTimeUp ? 'text-red-500 animate-pulse' : 
                          isWarning ? 'text-amber-400 animate-pulse' :
                          (isRunning ? 'text-emerald-400' : 'text-slate-200')
                        }`}
                    >
                        {timeStr}
                    </div>
                    
                    <button
                        onClick={isRunning ? pause : start}
                        disabled={timeLeft === 0}
                        className={`w-full py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95 shadow-sm
                            ${isRunning 
                                ? 'bg-amber-900/30 text-amber-500 border border-amber-500/30' 
                                : (timeLeft === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500')
                            }
                        `}
                    >
                        {isRunning ? <><Pause size={16} fill="currentColor" /> 暫停</> : <><Play size={16} fill="currentColor" /> 開始</>}
                    </button>
                </div>

                {/* Right: Quick Adjust Grid */}
                <div className="w-[120px] grid grid-cols-2 gap-2">
                    <button onClick={() => adjust(60)} className={btnAdd}>
                        +1<span className="text-[9px] opacity-70">分</span>
                    </button>
                    <button onClick={() => adjust(30)} className={btnAdd}>
                        +30<span className="text-[9px] opacity-70">秒</span>
                    </button>
                    <button onClick={() => adjust(-60)} className={btnSub}>
                        -1<span className="text-[9px] opacity-70">分</span>
                    </button>
                    <button onClick={() => adjust(-30)} className={btnSub}>
                        -30<span className="text-[9px] opacity-70">秒</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CountdownTool;
