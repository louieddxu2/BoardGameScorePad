
import React from 'react';
import { Player } from '../../../types';
import { Palette, History, Info, ArrowRight, ArrowDown, Ban } from 'lucide-react';
import { COLORS } from '../../../colors';
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

// This is the pure content provider component
const PlayerEditor: React.FC<PlayerEditorProps> = ({
  player,
  playerHistory,
  tempName,
  setTempName,
  isInputFocused,
  setIsInputFocused,
  onUpdatePlayerColor,
  onNameSubmit,
}) => {
  return (
    // This root div is KEY. It respects the layout contract by handling its own scrolling.
    <div className="h-full overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
      <div className={`flex flex-col gap-2 h-full ${isInputFocused ? 'p-0' : 'p-2'}`}>
        <div className="flex-none h-14">
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onFocus={(e) => { setIsInputFocused(true); e.target.select(); }}
            // Critical: We removed setTimeout here to fix the flashing issue.
            // Buttons that need to trigger actions without closing the keyboard (like Next/Clear)
            // MUST use onMouseDown={(e) => e.preventDefault()} to prevent this blur from firing.
            // This ensures that 'blur' only happens when the user genuinely closes the keyboard (or taps away).
            onBlur={() => { 
                onNameSubmit(player.id, tempName, false); 
                setIsInputFocused(false); 
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            placeholder="輸入名稱"
            className="w-full h-full bg-slate-800 border border-slate-600 rounded-xl px-4 text-xl font-bold text-white outline-none focus:border-emerald-500 placeholder-slate-500 transition-all"
          />
        </div>
        {!isInputFocused && (
          <div className="flex-1 flex gap-2 min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Color Palette */}
            <div className="w-1/3 bg-slate-800/50 rounded-xl p-2 overflow-y-auto no-scrollbar border border-slate-700/50">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 flex items-center justify-center gap-1"><Palette size={10} /> 顏色</div>
              <div className="grid grid-cols-1 gap-2 justify-items-center">
                {COLORS.map(c => {
                  const isTransparent = c === 'transparent';
                  const isDark = !isTransparent && isColorDark(c);
                  
                  return (
                    <button 
                        key={c} 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onUpdatePlayerColor(c)} 
                        className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-90 flex items-center justify-center relative ${player.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isDark ? 'ring-1 ring-white/50' : ''}`} 
                        style={{ backgroundColor: isTransparent ? 'transparent' : c }}
                        title={isTransparent ? "無色" : c}
                    >
                        {isTransparent && (
                            <div className="w-full h-full rounded-full border border-slate-600 flex items-center justify-center bg-slate-800/50">
                                <Ban size={14} className="text-slate-400" />
                            </div>
                        )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* History */}
            <div className="w-2/3 bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col">
              <div className="p-2 text-[10px] text-slate-500 font-bold uppercase bg-slate-800/80 text-center flex items-center justify-center gap-1"><History size={10} /> 歷史</div>
              <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                {playerHistory.slice(0, 20).map((name, i) => (
                  <button 
                    key={i} 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setTempName(name); onNameSubmit(player.id, name, true); }} 
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-900/30 hover:text-emerald-400 transition-colors truncate active:scale-95 bg-slate-800"
                  >
                    {name}
                  </button>
                ))}
                {playerHistory.length === 0 && <div className="text-center text-xs text-slate-600 py-4">無紀錄</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// This is the named export for the sidebar info, now correctly located.
export const PlayerEditorInfo: React.FC = () => (
    <div className="flex flex-col h-full text-slate-400 text-xs">
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase pb-1 border-b border-slate-700/50 shrink-0">
            <Info size={12} /> 編輯玩家
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pr-1 space-y-3 text-left">
            <p><strong>名稱：</strong> 點擊輸入框以編輯玩家名稱。您可以從右側的「歷史」清單中選擇常用名稱快速套用。</p>
            <p><strong>顏色：</strong> 從左側的調色盤中選擇一個代表色。選擇「無色」可讓畫面更貼近原始計分紙。</p>
            <p><strong>歷史紀錄：</strong> 系統會自動儲存您輸入過的玩家名稱，方便下次快速選用。</p>
            <p><strong>快速跳轉：</strong> 完成編輯後，點擊右下角的「下一項」按鈕 (<ArrowRight size={12} className="inline-block align-middle" /> / <ArrowDown size={12} className="inline-block align-middle" />) 可直接跳到下一位玩家進行編輯，或進入計分格。</p>
        </div>
    </div>
);

export default PlayerEditor;
