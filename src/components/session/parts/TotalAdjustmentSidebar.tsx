import React from 'react';
import type { Player } from '../../../types';
import { Scale, X } from 'lucide-react';
import { useSessionTranslation } from '../../../i18n/session';

const TotalAdjustmentSidebar: React.FC<{
    player: Player;
    onUpdatePlayer: (updates: Partial<Player>) => void;
}> = ({ player, onUpdatePlayer }) => {
    const { t } = useSessionTranslation();
    return (
        <div className="flex flex-col flex-1 min-h-0 p-2 gap-2">
            <div className="text-[10px] text-txt-primary font-bold uppercase pb-1 border-b border-surface-border flex items-center justify-center gap-1 shrink-0">
                {t('input_total_adjust')}
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar pt-1">
                {/* Tie Breaker Toggle */}
                <button
                    onClick={() => onUpdatePlayer({ tieBreaker: !player.tieBreaker })}
                    className={`flex-1 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1
                        ${player.tieBreaker
                            ? 'bg-brand-secondary/20 border-brand-secondary text-brand-secondary shadow-lg'
                            : 'bg-surface-recessed border-surface-border text-txt-muted hover:border-surface-border-hover hover:text-txt-secondary'
                        }
                    `}
                >
                    <Scale size={24} className={player.tieBreaker ? "fill-current" : ""} />
                    <span className="font-bold text-[10px] leading-none">{t('input_tie_breaker')}</span>
                </button>

                {/* Force Loss Toggle */}
                <button
                    onClick={() => onUpdatePlayer({ isForceLost: !player.isForceLost })}
                    className={`flex-1 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1
                        ${player.isForceLost
                            ? 'bg-status-danger/20 border-status-danger text-status-danger shadow-lg'
                            : 'bg-surface-recessed border-surface-border text-txt-muted hover:border-surface-border-hover hover:text-txt-secondary'
                        }
                    `}
                >
                    <X size={24} className={player.isForceLost ? "stroke-[3px]" : ""} />
                    <span className="font-bold text-[10px] leading-none">{t('input_force_loss')}</span>
                </button>
            </div>
        </div>
    );
};

export default TotalAdjustmentSidebar;
