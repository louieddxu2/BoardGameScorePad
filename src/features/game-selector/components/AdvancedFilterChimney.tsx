import React from 'react';
import { SearchFilters } from '../types';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { Trophy, Mountain, Clock } from 'lucide-react';

export interface AdvancedFilterChimneyProps {
    searchFilters: SearchFilters;
    setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
    playerCount: number;
}

export const AdvancedFilterChimney: React.FC<AdvancedFilterChimneyProps> = ({
    searchFilters,
    setSearchFilters,
    playerCount
}) => {
    const { t } = useIntegrationTranslation();

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1 py-1 border-b border-surface-border/30 mb-1 animate-in slide-in-from-bottom-4 duration-300">
            {/* 0. Quick Scenario Filters (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-1.5 shrink-0 border-b border-surface-border/20 pb-1.5 mb-0.5">
                {[
                    { id: 'smallTable', label: t('selector_filter_small_table'), key: 'smallTable' },
                    { id: 'isParty', label: t('selector_filter_party'), key: 'isParty' },
                    { id: 'isFamily', label: t('selector_filter_family'), key: 'isFamily' },
                    { id: 'isCoop', label: t('selector_filter_coop'), key: 'isCoop' }
                ].map((scenario) => {
                    const isActive = searchFilters[scenario.key as keyof SearchFilters];
                    return (
                        <button
                            key={scenario.id}
                            onClick={() => setSearchFilters(p => ({ ...p, [scenario.key]: !isActive }))}
                            className={`h-8 text-xs font-black rounded-lg border transition-all ${isActive 
                                ? 'bg-brand-primary text-white border-brand-primary shadow-sm' 
                                : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'}`}
                        >
                            {scenario.label}
                        </button>
                    );
                })}
            </div>

            {/* 2. Players Filter (Horizontal Three-Column Layout) */}
            <div className="grid grid-cols-3 gap-1.5 pb-1.5 border-b border-surface-border/20 mb-0.5">
                <div className="h-8 flex items-center justify-center bg-surface-bg/20 border border-surface-border/40 rounded-lg text-xs font-black text-brand-primary">
                    {playerCount} {t('selector_unit_player')}
                </div>
                <button
                    onClick={() => setSearchFilters(p => ({
                        ...p,
                        playerFilter: p.playerFilter === 'playable' ? 'none' : 'playable'
                    }))}
                    className={`h-8 text-xs font-black rounded-lg border transition-all ${searchFilters.playerFilter === 'playable'
                            ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                            : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'
                        }`}
                >
                    {t('selector_filter_players_playable')}
                </button>
                <button
                    onClick={() => setSearchFilters(p => ({
                        ...p,
                        playerFilter: p.playerFilter === 'best' ? 'none' : 'best'
                    }))}
                    className={`h-8 text-xs font-black rounded-lg border transition-all ${searchFilters.playerFilter === 'best'
                            ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                            : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'
                        }`}
                >
                    {t('selector_filter_players_best_btn')}
                </button>
            </div>

            {/* 2. Rating Filter */}
            <div className="pb-1.5 border-b border-surface-border/20 mb-0.5">
                <div className="flex items-center justify-center relative mb-0.5 h-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${searchFilters.rating !== null ? 'text-brand-primary' : 'text-txt-muted'}`}>
                        <Trophy size={12} />
                        {t('selector_filter_rating')}
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {[6, 7, 8].map(r => (
                        <button
                            key={r}
                            onClick={() => setSearchFilters(p => ({ ...p, rating: p.rating === r ? null : r }))}
                            className={`h-8 text-xs font-black rounded-md border transition-all ${searchFilters.rating === r ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-app-bg-deep border-surface-border text-txt-primary hover:border-txt-primary'}`}
                        >
                            {r}+
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Complexity Filter */}
            <div className="pb-1.5 border-b border-surface-border/20 mb-0.5">
                <div className="flex items-center justify-center relative mb-0.5 h-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${searchFilters.complexity !== null ? 'text-brand-primary' : 'text-txt-muted'}`}>
                        <Mountain size={12} />
                        {t('selector_filter_complexity')}
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {(['light', 'mid', 'heavy'] as const).map(c => (
                        <button
                            key={c}
                            onClick={() => setSearchFilters(p => ({ ...p, complexity: p.complexity === c ? null : c }))}
                            className={`h-8 text-xs font-black rounded-md border transition-all ${searchFilters.complexity === c ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-app-bg-deep border-surface-border text-txt-primary hover:border-txt-primary'}`}
                        >
                            {c === 'light' ? t('selector_filter_complexity_light') : c === 'mid' ? t('selector_filter_complexity_mid') : t('selector_filter_complexity_heavy')}
                        </button>
                    ))}
                </div>
            </div>

            {/* 5. Duration Filter */}
            <div className="pb-1.5 border-b border-surface-border/20 mb-0.5">
                <div className="flex items-center justify-center relative mb-0.5 h-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${searchFilters.duration !== null ? 'text-brand-primary' : 'text-txt-muted'}`}>
                        <Clock size={12} />
                        {t('selector_filter_duration')}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {[30, 60, 90, 120].map(d => (
                        <button
                            key={d}
                            onClick={() => setSearchFilters(p => ({ ...p, duration: p.duration === d ? null : d }))}
                            className={`h-8 text-xs font-black rounded-md border transition-all ${searchFilters.duration === d ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-app-bg-deep border-surface-border text-txt-primary hover:border-txt-primary'}`}
                        >
                            {t('selector_filter_duration_unit').replace('{m}', `<${d}`)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
