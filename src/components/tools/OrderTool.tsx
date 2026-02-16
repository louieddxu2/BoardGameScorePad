
import React from 'react';
import { Shuffle } from 'lucide-react';
import { GameSession } from '../../../types';

interface OrderToolProps {
    session: GameSession;
    onUpdateSession: (session: GameSession) => void;
}

const OrderTool: React.FC<OrderToolProps> = ({ session, onUpdateSession }) => {
    const handleShuffle = () => {
        const newPlayers = [...session.players];
        
        // 1. Fisher-Yates Shuffle
        for (let i = newPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newPlayers[i], newPlayers[j]] = [newPlayers[j], newPlayers[i]];
        }

        // 2. Set First Player as Starter (Reset others)
        newPlayers.forEach((p, i) => {
            p.isStarter = (i === 0);
        });

        // 3. Update Session
        onUpdateSession({
            ...session,
            players: newPlayers
        });
        
        if (navigator.vibrate) navigator.vibrate(50);
    };

    return (
        <button 
            onClick={handleShuffle}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2 group shadow-sm"
        >
            <Shuffle size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">順位與分組</span>
        </button>
    );
};

export default OrderTool;
