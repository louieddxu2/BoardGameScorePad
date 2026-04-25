import React, { useMemo } from 'react';
import { Player, SavedListItem } from '../../../types';
import { Settings2, Ban, Flag } from 'lucide-react';
import { COLORS } from '../../../colors';
import { isColorDark } from '../../../utils/ui';
import { searchService } from '../../../services/searchService';
import { useSessionTranslation } from '../../../i18n/session';

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
  const { t } = useSessionTranslation();

  const sortedColors = useMemo(() => {
    if (!supportedColors || supportedColors.length === 0) return COLORS;

    const preferred = supportedColors;
    const remaining = COLORS.filter(c => !preferred.includes(c));
    return [...preferred, ...remaining];
  }, [supportedColors]);

  const displayedPlayers = useMemo(() => {
    const trimmedInput = tempName.trim();

    // [New] 特殊判定：若目前為預設名稱且尚未連結身分，直接顯示完整歷史名單
    // 這解決了「玩家 1」狀態下搜尋會導致空列表的問題。
    const isDefaultUnlinked = !player.linkedPlayerId && tempName === player.name;
    if (isDefaultUnlinked) return savedPlayers;

    // 1. 如果輸入為空，顯示完整歷史紀錄 (依最近使用排序)
    if (!trimmedInput) return savedPlayers;

    // 2. 如果完全匹配現有玩家名稱，顯示完整歷史紀錄 (依照使用者需求)
    const hasExactMatch = savedPlayers.some(p => p.name.toLowerCase() === trimmedInput.toLowerCase());
    if (hasExactMatch) {
      return savedPlayers;
    }

    // 3. 否則，顯示模糊搜尋結果
    return searchService.search(savedPlayers, trimmedInput, ['name']);
  }, [savedPlayers, tempName, player.linkedPlayerId, player.name]);

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
            placeholder={t('player_editor_placeholder')}
            className="w-full h-full bg-surface-recessed border border-surface-border rounded-xl px-4 text-xl font-bold text-txt-title outline-none focus:border-brand-primary placeholder-txt-muted transition-all"
          />
        </div>
        {!isInputFocused && (
          <div className="flex-1 flex gap-2 min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Color Palette - Restored to 1/3 width */}
            <div className="w-1/3 bg-surface-recessed/50 rounded-xl p-2 overflow-y-auto no-scrollbar border border-surface-border">
              <div className="grid grid-cols-1 gap-2 justify-items-center">
                {sortedColors.map(c => {
                  const isTransparent = c === 'transparent';
                  const isDark = !isTransparent && isColorDark(c);

                  return (
                    <button
                      key={c}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onUpdatePlayerColor(c)}
                      className={`w-8 h-8 rounded-full shadow-lg border-2 transition-transform active:scale-95 flex items-center justify-center relative ${player.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'} ${isColorDark(c) ? 'ring-1 ring-white/50' : 'ring-1 ring-black/10'}`}
                      style={{ backgroundColor: isTransparent ? 'transparent' : c }}
                      title={isTransparent ? t('player_color_none') : c}
                    >
                      {isTransparent && (
                        <div className="w-full h-full rounded-full border border-surface-border flex items-center justify-center bg-surface-recessed/50">
                          <Ban size={14} className="text-txt-muted" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* History - Restored to remaining 2/3 width */}
            <div className="flex-1 bg-surface-recessed/50 rounded-xl border border-surface-border flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                {displayedPlayers.slice(0, 20).map((item, i) => (
                  <button
                    key={item.id || i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setTempName(item.name);
                      // [New Logic] Pass linked UUID from meta if available
                      const linkedId = item.meta?.uuid;
                      onNameSubmit(player.id, item.name, false, linkedId);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium text-txt-primary hover:bg-brand-primary/20 hover:text-brand-primary transition-colors truncate active:scale-95 bg-surface-recessed border border-surface-border"
                  >
                    {item.name}
                  </button>
                ))}
                {displayedPlayers.length === 0 && (
                  <div className="text-center text-xs text-txt-muted py-4">
                    {tempName ? t('player_editor_no_results') : t('player_editor_no_history')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Replaced PlayerEditorInfo with PlayerSettingsPanel
const PlayerSettingsPanel: React.FC<{ player: Player, onToggleStarter: (id: string) => void }> = ({ player, onToggleStarter }) => {
  const { t } = useSessionTranslation();
  return (
    <div className="flex flex-col h-full text-txt-secondary text-xs">
      <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-2 text-center flex flex-col justify-center">

        {/* Starter Button - Compact size */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleStarter(player.id)}
          className={`w-full h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95
                    ${player.isStarter
              ? 'bg-status-warning/20 border-status-warning text-status-warning shadow-lg shadow-status-warning/20'
              : 'bg-surface-recessed border-surface-border text-txt-muted hover:border-surface-border-hover hover:text-txt-secondary'
            }
                `}
          title={t('player_editor_set_starter')}
        >
          <Flag size={20} className={player.isStarter ? "fill-current" : ""} />
          <span className="font-bold text-[10px] leading-none">{player.isStarter ? t('player_editor_is_starter') : t('player_editor_set_starter')}</span>
        </button>

        {/* Spacer for future buttons */}
        <div className="flex-1"></div>
      </div>
    </div>
  );
};

// Removed PlayerEditorInfo export as it's no longer used
export { PlayerSettingsPanel };
export default PlayerEditor;
