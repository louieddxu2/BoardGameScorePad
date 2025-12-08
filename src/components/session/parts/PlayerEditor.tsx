import React from 'react';
import { Player } from '../../../types';
import { Palette, History } from 'lucide-react';
import { COLORS } from '../../../constants';
import { isColorDark } from '../../../utils/ui';

interface PlayerEditorProps {
  player: Player;
  playerHistory: string[];
  tempName: string;
  setTempName: (name: string) => void;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  onUpdatePlayerColor: (color: string) => void;
  onNameSubmit: (playerId: string, newName: string, moveNext?: boolean) => void;
}

const PlayerEditor: React.FC<PlayerEditorProps> = ({
  player,
  playerHistory,
  tempName,
  setTempName,
  isInputFocused,
  setIsInputFocused,
  onUpdatePlayerColor,
  onNameSubmit
}) => {
  return (
    <div className="h-full flex flex-col p-2 gap-2" onClick={e => e.stopPropagation()}>
      <div className="flex-none h-16">
        <input
          type="text"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onFocus={(e) => { setIsInputFocused(true); e.target.select(); }}
          onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); onNameSubmit(player.id, tempName, true); } }}
          placeholder="輸入名稱"
          className="w-full h-full bg-slate-800 border border-slate-600 rounded-xl px-4 text-xl font-bold text-white outline-none focus:border-emerald-500 placeholder-slate-500"
        />
      </div>
      {!isInputFocused && (
        <div className="flex-1 flex gap-2 min-h-0 overflow-hidden animate-in fade-in duration-200">
          <div className="w-1/3 bg-slate-800/50 rounded-xl p-2 overflow-y-auto custom-scrollbar border border-slate-700/50">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 flex items-center justify-center gap-1"><Palette size={10} /> 顏色</div>
            <div className="grid grid-cols-1 gap-2 justify-items-center">
              {COLORS.map(c => {
                const isDark = isColorDark(c);
                return <button key={c} onClick={() => onUpdatePlayerColor(c)} className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 ${player.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isDark ? 'ring-1 ring-white/50' : ''}`} style={{ backgroundColor: c }} />;
              })}
            </div>
          </div>
          <div className="w-2/3 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50 flex flex-col">
            <div className="p-2 text-[10px] text-slate-500 font-bold uppercase bg-slate-800/80 text-center flex items-center justify-center gap-1"><History size={10} /> 歷史</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {playerHistory.slice(0, 20).map((name, i) => (
                <button key={i} onClick={() => onNameSubmit(player.id, name, true)} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-900/30 hover:text-emerald-400 transition-colors truncate active:scale-95 bg-slate-800">{name}</button>
              ))}
              {playerHistory.length === 0 && <div className="text-center text-xs text-slate-600 py-4">無紀錄</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerEditor;
