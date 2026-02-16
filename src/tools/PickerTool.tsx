
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { Player } from '../../../types';

interface PickerToolProps {
    players: Player[];
}

const PickerTool: React.FC<PickerToolProps> = ({ players }) => {
    const [pickedName, setPickedName] = useState<string | null>(null);
    const [isPicking, setIsPicking] = useState(false);

    const pick = () => {
        if (isPicking || players.length === 0) return;
        setIsPicking(true);
        let count = 0;
        const totalSpins = 15;
        const speed = 80;

        const interval = setInterval(() => {
            const randomIdx = Math.floor(Math.random() * players.length);
            setPickedName(players[randomIdx].name);
            count++;
            
            if (count >= totalSpins) {
                clearInterval(interval);
                setIsPicking(false);
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }, speed);
    };

    return (
        <button 
            onClick={pick}
            className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-800/50 hover:bg-slate-700/80 rounded-2xl border border-slate-700/50 transition-all active:scale-95 group min-h-[96px]"
        >
            {pickedName === null ? (
                <div className="flex flex-col items-center gap-1">
                    <Users size={24} className="text-slate-400 group-hover:text-amber-400 transition-colors" />
                    <span className="text-xs text-slate-500 font-bold">誰是起始玩家？</span>
                </div>
            ) : (
                <div className="flex flex-col items-center animate-in zoom-in duration-200 w-full px-2">
                    <span className={`text-lg font-bold truncate max-w-full ${isPicking ? 'text-slate-400' : 'text-amber-400 scale-110 transition-transform'}`}>
                        {pickedName}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">{isPicking ? '抽選中...' : '就決定是你了！'}</span>
                </div>
            )}
        </button>
    );
};

export default PickerTool;
