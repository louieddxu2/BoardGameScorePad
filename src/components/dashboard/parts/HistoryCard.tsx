
import React from 'react';
import { HistoryRecord } from '../../../types';
import { Crown, Calendar, Trash2, MapPin } from 'lucide-react';

interface HistoryCardProps {
  record: HistoryRecord;
  onDelete: (id: string) => void; // [Change] string ID
  onClick: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ record, onDelete, onClick }) => {
  const date = new Date(record.endTime);
  const dateStr = date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div 
        onClick={onClick}
        className="bg-slate-800 rounded-xl border border-slate-700 shadow-md p-4 relative group hover:bg-slate-750 transition-colors w-full cursor-pointer hover:border-slate-600"
    >
      {/* Header: Date & Title */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col gap-1.5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-xs text-slate-500 font-mono">
                <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>{dateStr}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span>{timeStr}</span>
                </div>
                {record.location && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                        <MapPin size={10} />
                        <span className="truncate max-w-[100px] sm:max-w-[150px]">{record.location}</span>
                    </div>
                )}
            </div>
            <h3 className="text-lg font-bold text-white leading-tight truncate pr-2">{record.gameName}</h3>
        </div>
        
        <button 
            onClick={(e) => { e.stopPropagation(); if(record.id) onDelete(record.id); }}
            className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors -mr-2 -mt-2 shrink-0"
        >
            <Trash2 size={16} />
        </button>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
        {record.players.map(p => {
            const isWinner = record.winnerIds.includes(p.id);
            const isTransparent = p.color === 'transparent';
            const colorStyle = isTransparent ? {} : { color: p.color };
            
            return (
                <div key={p.id} className={`flex items-center justify-between text-sm ${isWinner ? 'bg-amber-900/20 -mx-2 px-2 py-1 rounded-lg border border-amber-500/20' : ''}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        {isWinner && <Crown size={14} className="text-yellow-400 shrink-0" fill="currentColor" />}
                        <span className={`truncate font-medium ${isWinner ? 'text-yellow-100' : 'text-slate-300'}`} style={isWinner ? {} : colorStyle}>
                            {p.name}
                        </span>
                    </div>
                    <span className={`font-mono font-bold ${isWinner ? 'text-yellow-400 text-base' : 'text-slate-400'}`}>
                        {p.totalScore}
                    </span>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default HistoryCard;
