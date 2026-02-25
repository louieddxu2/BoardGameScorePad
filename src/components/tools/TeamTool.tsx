
import React, { useState } from 'react';
import { Users, Shuffle, RefreshCw } from 'lucide-react';
import { Player } from '../../types';

interface TeamToolProps {
    players: Player[];
}

const TeamTool: React.FC<TeamToolProps> = ({ players }) => {
    const [teams, setTeams] = useState<{ a: string[], b: string[] } | null>(null);

    const generateTeams = () => {
        if (players.length < 2) return;

        // Fisher-Yates Shuffle
        const shuffled = [...players];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const mid = Math.ceil(shuffled.length / 2);
        setTeams({
            a: shuffled.slice(0, mid).map(p => p.name),
            b: shuffled.slice(mid).map(p => p.name)
        });

        if (navigator.vibrate) navigator.vibrate(50);
    };

    return (
        <div className="w-full h-full bg-slate-800/50 rounded-2xl border border-slate-700/50 p-3 flex flex-col min-h-[180px]">
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Users size={12} /> 隊伍分配
                </span>
                <button
                    onClick={generateTeams}
                    disabled={players.length < 2}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {teams ? <RefreshCw size={14} /> : <Shuffle size={14} />}
                </button>
            </div>

            {teams ? (
                <div className="flex gap-2 flex-1 min-h-0">
                    {/* Team A */}
                    <div className="flex-1 bg-red-900/10 border border-red-500/20 rounded-xl p-2 flex flex-col overflow-hidden">
                        <div className="text-center text-[10px] font-bold text-red-400 mb-1 border-b border-red-500/10 pb-1">RED</div>
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                            {teams.a.map((name, i) => (
                                <div key={i} className="text-xs text-red-200 truncate font-medium">{name}</div>
                            ))}
                        </div>
                    </div>
                    {/* Team B */}
                    <div className="flex-1 bg-blue-900/10 border border-blue-500/20 rounded-xl p-2 flex flex-col overflow-hidden">
                        <div className="text-center text-[10px] font-bold text-blue-400 mb-1 border-b border-blue-500/10 pb-1">BLUE</div>
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                            {teams.b.map((name, i) => (
                                <div key={i} className="text-xs text-blue-200 truncate font-medium">{name}</div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 opacity-60">
                    <Shuffle size={32} />
                    <span className="text-xs">點擊按鈕隨機分隊</span>
                    {players.length < 2 && <span className="text-[10px] text-red-400">人數不足 (需 2+)</span>}
                </div>
            )}
        </div>
    );
};

export default TeamTool;
