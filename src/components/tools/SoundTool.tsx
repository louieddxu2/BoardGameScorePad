
import React, { useRef } from 'react';
import { Volume2, CheckCircle, XCircle, Trophy, Clock } from 'lucide-react';
import { useToolsTranslation } from '../../i18n/tools';

const SoundTool: React.FC = () => {
    const { t } = useToolsTranslation();
    const audioCtxRef = useRef<AudioContext | null>(null);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new CtxClass();
        }
        if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    };

    const playTone = (freq: number, type: OscillatorType, duration: number, delay: number = 0) => {
        const ctx = getCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
    };

    const sfxCorrect = () => {
        playTone(660, 'sine', 0.1);
        playTone(880, 'sine', 0.3, 0.1);
    };

    const sfxWrong = () => {
        playTone(150, 'sawtooth', 0.3);
        playTone(100, 'sawtooth', 0.4, 0.2);
    };

    const sfxWin = () => {
        const now = 0;
        playTone(523.25, 'square', 0.2, now);
        playTone(659.25, 'square', 0.2, now + 0.15);
        playTone(783.99, 'square', 0.4, now + 0.3);
        playTone(1046.50, 'square', 0.6, now + 0.45);
    };

    const sfxTick = () => {
        playTone(800, 'triangle', 0.05);
    };

    const btnClass = "flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700 transition-all active:scale-95 group";

    return (
        <div className="w-full h-full flex flex-col min-h-[96px] bg-slate-900/30 rounded-2xl border border-slate-800 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase px-1 mb-2">
                <Volume2 size={12} /> {t('sound_board')}
            </div>
            <div className="grid grid-cols-4 gap-2 flex-1">
                <button onClick={sfxCorrect} className={btnClass}>
                    <CheckCircle size={20} className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
                </button>
                <button onClick={sfxWrong} className={btnClass}>
                    <XCircle size={20} className="text-red-500 mb-1 group-hover:scale-110 transition-transform" />
                </button>
                <button onClick={sfxWin} className={btnClass}>
                    <Trophy size={20} className="text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                </button>
                <button onClick={sfxTick} className={btnClass}>
                    <Clock size={20} className="text-sky-400 mb-1 group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default SoundTool;
