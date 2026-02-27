
import React, { useState } from 'react';
import { Dice5 } from 'lucide-react';
import { useToolsTranslation } from '../../i18n/tools';

const DiceTool: React.FC = () => {
    const { t } = useToolsTranslation();
    const [val, setVal] = useState<number | null>(null);
    const [isRolling, setIsRolling] = useState(false);

    const roll = () => {
        if (isRolling) return;
        setIsRolling(true);
        let count = 0;
        const max = 12;
        // Exponential decay interval for realistic rolling feel
        let delay = 50;

        const loop = () => {
            setVal(Math.floor(Math.random() * 6) + 1);
            count++;
            if (count < max) {
                delay += 10;
                setTimeout(loop, delay);
            } else {
                setIsRolling(false);
                if (navigator.vibrate) navigator.vibrate(20);
            }
        };
        loop();
    };

    return (
        <button
            onClick={roll}
            className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-800/50 hover:bg-slate-700/80 rounded-2xl border border-slate-700/50 transition-all active:scale-95 group min-h-[96px]"
        >
            {val === null ? (
                <>
                    <Dice5 size={28} className="text-slate-400 group-hover:text-indigo-400 transition-colors mb-1" />
                    <span className="text-xs text-slate-500 font-bold">{t('dice_roll_d6')}</span>
                </>
            ) : (
                <div className="flex flex-col items-center">
                    <span className={`text-4xl font-black font-mono ${isRolling ? 'text-slate-500 blur-[1px]' : 'text-indigo-400 animate-in zoom-in duration-200 scale-110'}`}>
                        {val}
                    </span>
                </div>
            )}
        </button>
    );
};

export default DiceTool;
