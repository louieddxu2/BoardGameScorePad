import React from 'react';
import type { Player, ScoreColumn } from '../../../types';
import { Eraser, Edit } from 'lucide-react';
import { ContrastText } from '../../shared/ContrastText';
import { useSessionTranslation } from '../../../i18n/session';
import { injectSoftHyphens } from '../../../utils/text';
import { voiceService } from '../../../services/voiceService';
import { withColorOpacity } from '../../../utils/color';

const InputPanelHeader: React.FC<{
    player: Player;
    col?: ScoreColumn;
    isEditingPlayer: boolean;
    onClear: () => void;
    onDirectionToggle: () => void;
    direction: 'horizontal' | 'vertical';
    isTotalMode?: boolean; // New prop
    isVoiceEnabled?: boolean;
    onToggleVoice?: () => void;
    showSwipeHint?: boolean;
}> = ({ player, col, isEditingPlayer, onClear, onDirectionToggle, direction, isTotalMode, isVoiceEnabled, onToggleVoice, showSwipeHint }) => {

    // Handle transparent color fallback
    const isTransparent = player.color === 'transparent';
    const displayColor = isTransparent ? 'rgb(var(--c-txt-muted))' : player.color; // Theme-aware fallback
    const bgColor = isTransparent ? 'rgb(var(--c-player-header-neutral-bg))' : withColorOpacity(player.color, 'var(--player-surface-tint-opacity)');
    const borderColor = isTransparent ? 'rgb(var(--c-input-border))' : withColorOpacity(player.color, 'var(--player-surface-border-opacity)');
    // Player identity stays colored; supporting labels use neutral ink on light surfaces.
    // The fallback preserves the original player ink in the dark palette.
    const contextStyle: React.CSSProperties = {
        color: `var(--input-context-ink, ${displayColor})`,
        opacity: 'var(--input-context-opacity)',
    };

    // Auto columns cannot be cleared manually
    const isAuto = col?.inputType === 'auto';
    const { t } = useSessionTranslation();

    return (
        <div
            className="border-b border-surface-border h-10 flex items-center px-4 gap-2 shrink-0 transition-colors overflow-hidden relative"
            style={{ backgroundColor: bgColor, borderColor: borderColor }}
        >
            {/* Swipe Hint Overlay */}
            {showSwipeHint && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-modal-backdrop/90 animate-swipe-hint-enter">
                    <span className="text-xs font-bold text-[rgb(var(--c-input-hint-ink))] flex items-center gap-2">
                        <span className="animate-swipe-hint-left">←</span>
                        <span>{t('input_swipe_hint')}</span>
                        <span className="animate-swipe-hint-right">→</span>
                    </span>
                    {/* Downward chevron pointing to swipeable area */}
                    <span className="text-[rgb(var(--c-input-hint-ink)_/_0.6)] text-[10px] leading-none mt-0.5">▼</span>
                </div>
            )}
            {/* Left Section: Info (Flexible) */}
            <div className="flex items-center min-w-0 flex-1 gap-1.5">
                {isEditingPlayer ? (
                    <>
                        <Edit size={12} className="shrink-0" style={{ color: contextStyle.color }} />
                        <span className="text-[10px] shrink-0 font-bold uppercase tracking-tighter" style={contextStyle}>
                            {t('input_edit_player')}
                        </span>
                        <div className="w-px h-3 bg-surface-border shrink-0" />
                        <ContrastText
                            key={player.id}
                            className="text-sm font-bold truncate animate-slide-in-right-shallow"
                            color={displayColor}
                            background={bgColor}
                            backdrop="rgb(var(--c-modal-bg))"
                        >
                            {player.name}
                        </ContrastText>
                    </>
                ) : (
                    <>
                        <ContrastText
                            key={player.id}
                            className="text-sm font-bold truncate animate-slide-in-right-shallow max-w-[40%]"
                            color={displayColor}
                            background={bgColor}
                            backdrop="rgb(var(--c-modal-bg))"
                        >
                            {player.name}
                        </ContrastText>
                        <div className="w-px h-3 bg-surface-border shrink-0" />
                        <span className="text-xs font-bold truncate" style={contextStyle}>
                            {isTotalMode ? t('input_total_adjust') : injectSoftHyphens(col?.name || '')}
                        </span>
                    </>
                )}
            </div>

            {/* Right Section: Actions (Fixed) */}
            <div className="flex items-center gap-4 shrink-0">
                {/* Voice Toggle */}
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        if (!isVoiceEnabled) {
                            voiceService.playActivationTone();
                        }
                        onToggleVoice?.();
                    }}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all border shrink-0 ${isVoiceEnabled
                        ? 'bg-status-success/20 border-status-success/50 text-status-success'
                        : 'bg-surface-alt border-surface-border text-txt-muted hover:text-txt-primary'}`}
                    title={isVoiceEnabled ? t('input_voice_on') : t('input_voice_off')}
                >
                    {isVoiceEnabled ? (
                        <div className="relative">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        </div>
                    ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    )}
                </button>

                {!isAuto && (
                    <button
                        onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                        onClick={onClear}
                        className="bg-status-danger/10 text-status-danger h-8 px-2.5 rounded-lg border border-status-danger/30 hover:bg-status-danger/20 flex items-center gap-1 shrink-0 transition-colors"
                    >
                        <Eraser size={14} />
                        <span className="text-xs font-bold hidden xs:inline">{isTotalMode ? t('input_reset') : t('input_clear')}</span>
                    </button>
                )}
                {/* [Modified] Show direction toggle even in Total Mode */}
                <button
                    onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                    onClick={onDirectionToggle}
                    className="bg-surface-alt hover:bg-surface-hover text-txt-secondary h-8 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-colors shrink-0 border border-surface-border shadow-sm"
                >
                    <span className="text-status-success hidden xs:inline">{t('input_next')}</span>
                    <div className="flex font-mono text-[10px] items-center">
                        <span className={`transition-colors ${direction === 'vertical' ? 'text-status-success scale-125' : 'text-txt-muted'}`}>↓</span>
                        <span className={`mx-0.5 opacity-20`}>/</span>
                        <span className={`transition-colors ${direction === 'horizontal' ? 'text-status-success scale-125' : 'text-txt-muted'}`}>→</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default InputPanelHeader;
