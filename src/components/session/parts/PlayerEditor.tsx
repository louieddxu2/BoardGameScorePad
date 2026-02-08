
import React, { useMemo } from 'react';
import { Player, SavedListItem } from '../../../types';
import { Settings2, Ban, Flag } from 'lucide-react';
import { COLORS } from '../../../colors';
import { isColorDark } from '../../../utils/ui';

interface PlayerEditorProps {
  player: Player;
  savedPlayers: SavedListItem[]; // Renamed from playerHistory
  tempName: string;
  setTempName: (name: string) => void;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  onUpdatePlayerColor: (color: string) => void;
  // [Update] Added linkedId optional param
  onNameSubmit: (playerId: string, newName: string, moveNext?: boolean, linkedId?: string) => void;
  onToggleStarter: (playerId: string) => void; 
  supportedColors?: string[]; // [New] Prop
}

// This is the pure content provider component
const PlayerEditor: React.FC<PlayerEditorProps> = ({
  player,
  savedPlayers, // Renamed
  tempName,
  setTempName,
  isInputFocused,
  setIsInputFocused,
  onUpdatePlayerColor,
  onNameSubmit,
  onToggleStarter,
  supportedColors
}) => {

  const sortedColors = useMemo(() => {
      if (!supportedColors || supportedColors.length === 0) return COLORS;
      
      const preferred = supportedColors;
      const remaining = COLORS.filter(c => !preferred.includes(c));
      return [...preferred, ...remaining];
  }, [supportedColors]);

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
            {/* Color Palette - Restored to 1/3 width */}
            <div className="w-1/3 bg-slate-800/50 rounded-xl p-2 overflow-y-auto no-scrollbar border border-slate-700/50">
              <div className="grid grid-cols-1 gap-2 justify-items-center">
                {sortedColors.map(c => {
                  const isTransparent = c === 'transparent';
                  const isDark = !isTransparent && isColorDark(c);
                  
                  return (
                    <button 
                        key={c} 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onUpdatePlayerColor(c)} 
                        className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-95 flex items-center justify-center relative ${player.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isDark ? 'ring-1 ring-white/50' : ''}`} 
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

            {/* History - Restored to remaining 2/3 width */}
            <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                {savedPlayers.slice(0, 20).map((item, i) => (
                  <button 
                    key={item.id || i} 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { 
                        setTempName(item.name); 
                        // [New Logic] Pass linked UUID from meta if available
                        const linkedId = item.meta?.uuid;
                        onNameSubmit(player.id, item.name, false, linkedId); 
                    }} 
                    className="w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-900/30 hover:text-emerald-400 transition-colors truncate active:scale-95 bg-slate-800 border border-slate-700/50"
                  >
                    {item.name}
                  </button>
                ))}
                {savedPlayers.length === 0 && <div className="text-center text-xs text-slate-600 py-4">無紀錄</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Replaced PlayerEditorInfo with PlayerSettingsPanel
const PlayerSettingsPanel: React.FC<{ player: Player, onToggleStarter: (id: string) => void }> = ({ player, onToggleStarter }) => (
    <div className="flex flex-col h-full text-slate-400 text-xs">
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-2 text-center flex flex-col justify-center">
            
            {/* Starter Button - Compact size */}
            <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onToggleStarter(player.id)}
                className={`w-full h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95
                    ${player.isStarter 
                        ? 'bg-amber-900/30 border-amber-500 text-amber-200 shadow-lg shadow-amber-900/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                    }
                `}
                title="設為起始玩家"
            >
                <Flag size={20} className={player.isStarter ? "fill-current" : ""} />
                <span className="font-bold text-[10px] leading-none">{player.isStarter ? "起始玩家" : "設為起始"}</span>
            </button>

            {/* Spacer for future buttons */}
            <div className="flex-1"></div>
        </div>
    </div>
);

// Removed PlayerEditorInfo export as it's no longer used
export { PlayerSettingsPanel };
export default PlayerEditor;
