import React from 'react';
import { GameOption, SearchFilters } from '../types';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { 
    Users, Plus, Pin, Star, Calendar, Mountain, Clock, Trophy 
} from 'lucide-react';

export interface GameOptionItemProps {
    option: GameOption;
    isDocked?: boolean;
    playerCount: number;
    searchFilters: SearchFilters;
    isAdvancedMode: boolean;
    onClick: (option: GameOption) => void;
    onPin: (option: GameOption) => void;
}

const BOTTOM_ROW_HEIGHT_CLASS = "h-[60px]";
const LIST_ITEM_HEIGHT = "h-[56px]";

export const GameOptionItem: React.FC<GameOptionItemProps> = ({
    option,
    isDocked = false,
    playerCount,
    searchFilters,
    isAdvancedMode,
    onClick,
    onPin
}) => {
    const { t } = useIntegrationTranslation();
    
    const isSelected = isDocked;
    const isVirtual = option.uid === '__CREATE_NEW__';
    const isSimple = !option.templateId && !isVirtual;

    const heightClass = isDocked ? BOTTOM_ROW_HEIGHT_CLASS : LIST_ITEM_HEIGHT;

    const bestPlayersStr = option.bestPlayers && option.bestPlayers.length > 0 ? `${option.bestPlayers.join(', ')}${t('selector_unit_player')}` : null;

    let supportedPlayersStr = null;
    if (option.minPlayers) {
        if (option.maxPlayers && option.maxPlayers !== option.minPlayers) {
            supportedPlayersStr = `${option.minPlayers}-${option.maxPlayers}${t('selector_unit_player')}`;
        } else {
            supportedPlayersStr = `${option.minPlayers}${t('selector_unit_player')}`;
        }
    } else if (option.defaultPlayerCount) {
        supportedPlayersStr = `${option.defaultPlayerCount}${t('selector_unit_player')}`;
    }

    const complexityVal = option.complexity && option.complexity > 0 ? Number(option.complexity).toFixed(1) : null;
    const yearVal = option.year ? `${option.year}${t('selector_unit_year')}` : null;
    const durationVal = option.playingTime && option.playingTime > 0 ? `${option.playingTime}${t('selector_unit_minute')}` : null;
    const ratingVal = option.rating && option.rating > 0 ? Number(option.rating).toFixed(1) : null;

    // Dynamic Highlighting Logic
    const isBestPlayersHighlighted = isAdvancedMode && searchFilters.playerFilter === 'best' && option.bestPlayers !== undefined && option.bestPlayers.includes(playerCount);
    const isSupportedPlayersHighlighted = isAdvancedMode && searchFilters.playerFilter === 'playable' && option.minPlayers !== undefined && option.maxPlayers !== undefined && playerCount >= option.minPlayers && playerCount <= option.maxPlayers;
    const isComplexityHighlighted = isAdvancedMode && searchFilters.complexity !== null && option.complexity !== undefined && (
        (searchFilters.complexity === 'light' && option.complexity <= 2.0) ||
        (searchFilters.complexity === 'mid' && option.complexity > 2.0 && option.complexity <= 3.5) ||
        (searchFilters.complexity === 'heavy' && option.complexity > 3.5)
    );
    const isCoopHighlighted = isAdvancedMode && searchFilters.gameType === 'cooperative' && option.cooperative === true;
    const isSmallTableHighlighted = isAdvancedMode && searchFilters.smallTable && option.complexity !== undefined && option.playingTime !== undefined && option.complexity <= 2.2 && option.playingTime <= 45;
    const isTimeHighlighted = isAdvancedMode && searchFilters.duration !== null;
    const isRatingHighlighted = isAdvancedMode && searchFilters.rating !== null;

    return (
        <div className={`${heightClass} w-full relative group shrink-0`}>
            <div
                role="button"
                tabIndex={0}
                onClick={() => onClick(option)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onClick(option);
                    }
                }}
                className={`absolute inset-0 w-full px-4 text-left cursor-pointer transition-all ${isSelected ? 'bg-surface-bg z-10' : 'bg-transparent text-txt-secondary hover:bg-surface-bg/50'}`}
            >
                <div className="flex items-stretch w-full h-full gap-3">
                    <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 py-1">
                        <div className={`text-sm font-bold truncate ${isSelected ? 'text-txt-primary' : ''} ${isVirtual ? 'text-brand-primary' : ''}`}>
                            {isVirtual ? t('selector_create_and_score', { name: option.displayName }) : option.displayName}
                        </div>

                        <div className="text-[10px] flex items-center h-5">
                            {isVirtual ? (
                                <div className="flex items-center gap-1 opacity-60">
                                    <Plus size={10} />
                                    <span>{t('selector_quick_start')}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5 w-full">
                                    {[
                                        isRatingHighlighted && ratingVal && (
                                            <span key="rating" className="inline-flex items-center bg-amber-500/10 text-amber-500 border border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.2)] px-1 py-0.5 rounded text-[9px] leading-none shrink-0 font-medium transition-colors"> {/* @ui-ignore */}
                                                <Trophy size={12} className="mr-0.5 shrink-0 fill-amber-500/50 text-amber-500" /> {/* @ui-ignore */}
                                                {ratingVal}
                                            </span>
                                        ),
                                        isTimeHighlighted && durationVal && (
                                            <span key="time" className="inline-flex items-center bg-brand-primary/15 text-brand-primary border border-brand-primary/40 shadow-[0_0_6px_rgba(var(--c-brand-primary),0.2)] px-1 py-0.5 rounded text-[9px] leading-none shrink-0 font-medium transition-colors">
                                                <Clock size={12} className="mr-0.5 shrink-0 text-brand-primary" />
                                                {durationVal}
                                            </span>
                                        ),
                                        isCoopHighlighted && (
                                            <span key="coop" className="inline-flex items-center bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.2)] px-1.5 py-0.5 rounded text-[9px] leading-none shrink-0 font-bold mr-0.5"> {/* @ui-ignore */}
                                                🤝 {t('selector_filter_type_cooperative')}
                                            </span>
                                        ),
                                        isSmallTableHighlighted && (
                                            <span key="smalltable" className="inline-flex items-center bg-brand-primary/15 text-brand-primary border border-brand-primary/40 shadow-[0_0_6px_rgba(var(--c-brand-primary),0.2)] px-1.5 py-0.5 rounded text-[9px] leading-none shrink-0 font-bold mr-0.5">
                                                ⛺ {t('selector_filter_small_table')}
                                            </span>
                                        ),

                                        ...(
                                            [
                                                bestPlayersStr ? {
                                                    key: 'best', highlighted: !!isBestPlayersHighlighted, node: (
                                                        <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] leading-none shrink-0 font-medium border transition-colors ${isBestPlayersHighlighted ? 'bg-amber-500/10 text-amber-500 border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.2)]' : 'bg-surface-bg-alt/80 text-txt-secondary border-surface-border/30'}`}> {/* @ui-ignore */}
                                                            <Star size={12} className={`mr-0.5 shrink-0 transition-colors ${isBestPlayersHighlighted ? 'fill-amber-500/50 text-amber-500' : 'fill-amber-400/20 text-amber-500/80'}`} /> {/* @ui-ignore */}
                                                            {bestPlayersStr}
                                                        </span>
                                                    )
                                                } : null,
                                                supportedPlayersStr ? {
                                                    key: 'sup', highlighted: !!isSupportedPlayersHighlighted, node: (
                                                        <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] leading-none shrink-0 font-medium border transition-colors ${isSupportedPlayersHighlighted ? 'bg-sky-500/10 text-sky-500 border-sky-500/40 shadow-[0_0_6px_rgba(14,165,233,0.2)]' : 'bg-surface-bg-alt/80 text-txt-secondary border-surface-border/30'}`}> {/* @ui-ignore */}
                                                            <Users size={12} className={`mr-0.5 shrink-0 transition-colors ${isSupportedPlayersHighlighted ? 'text-sky-500' : 'text-sky-500/80'}`} /> {/* @ui-ignore */}
                                                            {supportedPlayersStr}
                                                        </span>
                                                    )
                                                } : null,
                                                complexityVal ? {
                                                    key: 'comp', highlighted: !!isComplexityHighlighted, node: (
                                                        <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] leading-none shrink-0 font-medium border transition-colors ${isComplexityHighlighted ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/40 shadow-[0_0_6px_rgba(var(--c-brand-primary),0.2)]' : 'bg-surface-bg-alt/80 text-txt-secondary border-surface-border/30'}`}>
                                                            <Mountain size={12} className={`mr-0.5 shrink-0 transition-colors ${isComplexityHighlighted ? 'text-brand-primary' : 'text-txt-primary/80'}`} />
                                                            {complexityVal}
                                                        </span>
                                                    )
                                                } : null,
                                                yearVal ? {
                                                    key: 'year', highlighted: false, node: (
                                                        <span className="inline-flex items-center bg-surface-bg-alt/80 text-txt-secondary border border-surface-border/30 px-1 py-0.5 rounded text-[9px] leading-none shrink-0 font-medium"> {/* @ui-ignore */}
                                                            <Calendar size={12} className="text-emerald-500/80 mr-0.5 shrink-0" /> {/* @ui-ignore */}
                                                            {yearVal}
                                                        </span>
                                                    )
                                                } : null
                                            ].filter(Boolean) as { key: string, highlighted: boolean, node: React.ReactNode }[]
                                        )
                                            .sort((a, b) => (b.highlighted ? 1 : 0) - (a.highlighted ? 1 : 0))
                                            .map(item => <React.Fragment key={item.key}>{item.node}</React.Fragment>)
                                    ].filter(Boolean)}

                                    {!bestPlayersStr && !supportedPlayersStr && !complexityVal && !yearVal && !isCoopHighlighted && !isSmallTableHighlighted && !isTimeHighlighted && !isRatingHighlighted && (
                                        <span className="text-[10px] text-txt-muted opacity-60">{t('selector_meta_not_set')}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {isSimple && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPin(option);
                            }}
                            className={`
                                flex flex-col items-center justify-center gap-0.5 w-8 my-1 rounded-md border transition-all group/pin z-20 shrink-0
                                ${option.isPinned
                                    ? 'bg-status-warning/10 border-status-warning/30 text-status-warning'
                                    : 'bg-surface-bg border-surface-border text-txt-muted hover:border-txt-secondary hover:text-txt-primary hover:bg-surface-bg-alt'
                                }
                            `}
                            title={option.isPinned ? t('selector_unpin_hint') : t('selector_pin_hint')}
                        >
                            <Pin size={12} className={option.isPinned ? "fill-current" : ""} />
                            <span className="text-[9px] leading-none scale-90 origin-center font-bold">{t('selector_label_simple')}</span>
                        </button>
                    )}
                </div>
            </div>
            {!isDocked && <div className="absolute bottom-0 left-4 right-4 h-px bg-surface-border/50 pointer-events-none"></div>}
        </div>
    );
};
