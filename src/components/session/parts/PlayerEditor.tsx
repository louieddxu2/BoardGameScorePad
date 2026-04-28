import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, SavedListItem } from '../../../types';
import { Ban, Flag, Palette } from 'lucide-react';
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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerAreaRef = useRef<HTMLDivElement>(null);

  // Click-outside handler: close color picker when tapping outside the strip area
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (colorPickerAreaRef.current && !colorPickerAreaRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showColorPicker]);

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

  const isMainTransparent = player.color === 'transparent';
  const isMainDark = !isMainTransparent && isColorDark(player.color);

  // Color bar style for the input's left border
  const colorBarStyle = isMainTransparent ? undefined : { borderLeftColor: player.color };

  return (
    <div className="h-full overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
      <div className="flex flex-col gap-2 h-full p-2">
        {/* Integrated Color-Name Strip: shared outer border, no overflow-hidden */}
        <div ref={colorPickerAreaRef} className={`flex-none h-14 relative z-50 flex items-stretch rounded-xl border-2 transition-all ${showColorPicker ? 'border-brand-primary' : 'border-surface-border'}`}>
          {/* Input with color bar on the left */}
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onFocus={(e) => {
              setIsInputFocused(true);
              e.target.select();
              setShowColorPicker(false);
            }}
            onBlur={() => {
              onNameSubmit(player.id, tempName, false);
              setIsInputFocused(false);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            placeholder={t('player_editor_placeholder')}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            data-form-type="other"
            className={`flex-1 w-full h-full min-w-0 bg-surface-alt rounded-l-xl px-4 text-xl font-bold text-txt-title outline-none placeholder-txt-muted transition-all ${isMainTransparent ? '' : 'border-l-[6px]'}`}
            style={colorBarStyle}
          />

          {/* Palette button on the right */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`w-14 flex-none rounded-r-xl flex items-center justify-center transition-all active:scale-95 border-l border-surface-border/50 ${isMainDark ? 'ring-inset ring-1 ring-white/10' : ''}`}
            style={{ backgroundColor: isMainTransparent ? 'rgb(var(--c-surface-bg-alt))' : player.color }}
            title={t('player_color_none')}
          >
            {isMainTransparent ? (
              <Ban size={20} className="text-txt-muted" />
            ) : (
              <Palette
                size={20}
                className={isMainDark ? 'text-white/80' : 'text-black/50'}
                strokeWidth={2.5}
              />
            )}
          </button>

          {/* Color Picker Popover - positioned outside the strip, never clipped */}
          {showColorPicker && (
            <div className="absolute right-0 top-full mt-2 w-[260px] max-h-64 overflow-y-auto no-scrollbar modal-bg-elevated border border-surface-border rounded-xl shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="grid grid-cols-6 gap-2 justify-items-center">
                {sortedColors.map(c => {
                  const isTransparent = c === 'transparent';
                  const isDark = !isTransparent && isColorDark(c);

                  return (
                    <button
                      key={c}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onUpdatePlayerColor(c);
                        setShowColorPicker(false);
                      }}
                      className={`w-8 h-8 rounded-full shadow-sm border-2 transition-transform active:scale-95 flex items-center justify-center relative ${player.color === c ? 'border-brand-primary scale-110' : 'border-transparent opacity-80 hover:opacity-100'} ${isDark ? 'ring-1 ring-white/30' : 'ring-1 ring-black/10'}`}
                      style={{ backgroundColor: isTransparent ? 'transparent' : c }}
                      title={isTransparent ? t('player_color_none') : c}
                    >
                      {isTransparent && (
                        <div className="w-full h-full rounded-full border border-surface-border flex items-center justify-center bg-surface-alt/50">
                          <Ban size={14} className="text-txt-muted" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={`flex-1 min-h-0 ${isInputFocused ? '' : 'animate-in fade-in slide-in-from-bottom-2 duration-300'}`}>
            {/* History - Flow Layout */}
            <div className="flex-1 min-h-[60px] bg-surface-alt/50 rounded-xl border border-surface-border flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                <div className="flex flex-wrap gap-2">
                  {displayedPlayers.slice(0, 20).map((item, i) => (
                    <button
                      key={item.id || i}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTempName(item.name);
                        const linkedId = item.meta?.uuid;
                        onNameSubmit(player.id, item.name, false, linkedId);
                      }}
                      className="px-3 py-1.5 rounded-full text-sm font-medium text-txt-primary hover:bg-brand-primary/20 hover:text-brand-primary transition-colors active:scale-95 bg-surface-bg border border-surface-border whitespace-nowrap"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                {displayedPlayers.length === 0 && (
                  <div className="text-center text-xs text-txt-muted py-8">
                    {tempName ? t('player_editor_no_results') : t('player_editor_no_history')}
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

const PlayerSettingsPanel: React.FC<{ player: Player, onToggleStarter: (id: string) => void }> = ({ player, onToggleStarter }) => {
  const { t } = useSessionTranslation();
  return (
    <div className="flex flex-col h-full text-txt-secondary text-xs">
      <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-2 text-center flex flex-col justify-center">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleStarter(player.id)}
          className={`w-full h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95
                    ${player.isStarter
              ? 'bg-status-warning/20 border-status-warning text-status-warning shadow-lg shadow-status-warning/20'
              : 'bg-surface-alt border-surface-border text-txt-muted hover:border-surface-border-hover hover:text-txt-secondary'
            }
                `}
          title={t('player_editor_set_starter')}
        >
          <Flag size={20} className={player.isStarter ? "fill-current" : ""} />
          <span className="font-bold text-[10px] leading-none">{player.isStarter ? t('player_editor_is_starter') : t('player_editor_set_starter')}</span>
        </button>
        <div className="flex-1"></div>
      </div>
    </div>
  );
};

export { PlayerSettingsPanel };
export default PlayerEditor;
