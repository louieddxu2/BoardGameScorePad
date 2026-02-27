
import React, { useState } from 'react';
import { Dices, CircleDollarSign, Triangle, Square, Hexagon, Octagon, Circle } from 'lucide-react';
import { useToolsTranslation } from '../../i18n/tools';

type RandomType = 'COIN' | 'D4' | 'D6' | 'D8' | 'D12' | 'D20';

const RandomizerTool: React.FC = () => {
    const { t } = useToolsTranslation();
    const [displayVal, setDisplayVal] = useState<string | number | null>(null);
    const [subLabel, setSubLabel] = useState<string>(t('random_title'));
    const [isRolling, setIsRolling] = useState(false);
    const [activeType, setActiveType] = useState<RandomType | null>(null);

    const roll = (type: RandomType) => {
        if (isRolling) return;
        setIsRolling(true);
        setActiveType(type);

        let max = 6;
        let isCoin = false;

        switch (type) {
            case 'COIN': max = 2; isCoin = true; break;
            case 'D4': max = 4; break;
            case 'D6': max = 6; break;
            case 'D8': max = 8; break;
            case 'D12': max = 12; break;
            case 'D20': max = 20; break;
        }

        let count = 0;
        const totalSpins = 12;
        let delay = 40;

        const loop = () => {
            const raw = Math.floor(Math.random() * max) + 1;

            if (isCoin) {
                setDisplayVal(raw === 1 ? 'H' : 'T');
            } else {
                setDisplayVal(raw);
            }

            count++;

            if (count < totalSpins) {
                delay += 10;
                setTimeout(loop, delay);
            } else {
                setIsRolling(false);
                // Final Result Logic
                if (isCoin) {
                    const finalRaw = Math.floor(Math.random() * 2) + 1;
                    setDisplayVal(finalRaw === 1 ? t('random_coin_heads') : t('random_coin_tails'));
                    setSubLabel(finalRaw === 1 ? 'Heads' : 'Tails');
                } else {
                    const finalVal = Math.floor(Math.random() * max) + 1;
                    setDisplayVal(finalVal);
                    setSubLabel(`${type} = ${finalVal}`);
                }

                if (navigator.vibrate) navigator.vibrate(50);
            }
        };

        setSubLabel(t('random_rolling'));
        loop();
    };

    const btnClass = (type: RandomType) => `
        flex flex-col items-center justify-center p-1 rounded-lg border transition-all active:scale-90 h-12 relative
        ${activeType === type && isRolling
            ? 'bg-indigo-600 text-white border-indigo-500 shadow-inner'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
        }
    `;

    return (
        <div className="w-full bg-slate-900/30 rounded-2xl border border-slate-800 p-2 flex flex-col gap-2 min-h-[140px]">
            {/* Display Area */}
            <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700/30 flex flex-col items-center justify-center min-h-[60px] relative overflow-hidden">
                {!displayVal ? (
                    <div className="flex flex-col items-center opacity-40">
                        <Dices size={24} className="mb-1" />
                        <span className="text-[10px] font-bold">{t('random_hint')}</span>
                    </div>
                ) : (
                    <>
                        <span className={`font-black text-slate-200 transition-all ${typeof displayVal === 'string' ? 'text-3xl' : 'text-5xl'} ${isRolling ? 'blur-[1px] opacity-70' : 'scale-110'}`}>
                            {displayVal}
                        </span>
                        <span className="absolute bottom-1 right-2 text-[10px] text-slate-500 font-mono">
                            {subLabel}
                        </span>
                    </>
                )}
            </div>

            {/* Button Row */}
            <div className="grid grid-cols-6 gap-1.5">
                <button onClick={() => roll('COIN')} className={btnClass('COIN')}>
                    <CircleDollarSign size={18} />
                    <span className="text-[9px] font-bold mt-0.5">{t('random_coin')}</span>
                </button>
                <button onClick={() => roll('D4')} className={btnClass('D4')}>
                    <Triangle size={16} className="fill-current opacity-20 absolute" />
                    <span className="text-[10px] font-bold z-10">D4</span>
                </button>
                <button onClick={() => roll('D6')} className={btnClass('D6')}>
                    <Square size={16} className="fill-current opacity-20 absolute" />
                    <span className="text-[10px] font-bold z-10">D6</span>
                </button>
                <button onClick={() => roll('D8')} className={btnClass('D8')}>
                    <Triangle size={16} className="fill-current opacity-20 absolute rotate-180" />
                    <span className="text-[10px] font-bold z-10">D8</span>
                </button>
                <button onClick={() => roll('D12')} className={btnClass('D12')}>
                    <Hexagon size={18} className="fill-current opacity-20 absolute" />
                    <span className="text-[10px] font-bold z-10">D12</span>
                </button>
                <button onClick={() => roll('D20')} className={btnClass('D20')}>
                    <Octagon size={18} className="fill-current opacity-20 absolute" />
                    <span className="text-[10px] font-bold z-10">D20</span>
                </button>
            </div>
        </div>
    );
};

export default RandomizerTool;
