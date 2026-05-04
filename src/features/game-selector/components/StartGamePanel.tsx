
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedListItem, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { Users, Minus, Plus, Play, ChevronUp, Search, PenLine, List, ThumbsUp, Pin, Check, ChevronDown, FileJson, Database, Maximize2, Minimize2, Star, X } from 'lucide-react';
import { getRecommendations, getSearchResults } from '../utils/sortStrategies';
import { useRecommendedGameSetup } from '../hooks/useRecommendedGameSetup';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';

interface StartGamePanelProps {
    options: GameOption[];
    locations?: SavedListItem[];
    onStart: (option: GameOption, playerCount: number, location: string, locationId?: string, extra?: { startTimeStr?: string, scoringRule?: ScoringRule }) => void;
    onSearchClick: () => void;
    onPin: (option: GameOption) => void;
    isSearching?: boolean;
    searchQuery?: string;
    onOpenBgStats?: () => void;
    onOpenBggImport?: () => void;
}



const StartGamePanel = React.forwardRef<HTMLDivElement, StartGamePanelProps>(({
    options,
    locations = [],
    onStart,
    onSearchClick,
    onPin,
    isSearching = false,
    searchQuery = '',
    onOpenBgStats,
    onOpenBggImport
}, ref) => {
    const { t } = useIntegrationTranslation();
    const { t: tCommon } = useCommonTranslation();

    // --- Derived Data ---
    const uniqueLocations = useMemo(() => {
        return [...locations].sort((a, b) => a.lastUsed - b.lastUsed);
    }, [locations]);

    const hasLocationHistory = uniqueLocations.length > 0;

    // --- State & Refs ---
    const [userSelectedUid, setUserSelectedUid] = useState<string | null>(null);
    const [activeMenu, setActiveMenu] = useState<{ type: 'mode' | 'location', bottom: number, left: number, width: number } | null>(null);
    const [isManualInput, setIsManualInput] = useState(!hasLocationHistory);
    const [showRuleMenu, setShowRuleMenu] = useState(false); 

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);

    useEffect(() => {
        localStorage.setItem('pref_search_advanced', isAdvancedMode.toString());
    }, [isAdvancedMode]);

    const [searchFilters, setSearchFilters] = useState<{
        bestOnly: boolean;
        rating: number | null;
        complexity: 'light' | 'mid' | 'heavy' | null;
        duration: number | null;
        gameType: 'competitive' | 'cooperative' | null;
        smallTable: boolean;
        recentOnly: boolean;
    }>(() => {
        const saved = localStorage.getItem('pref_search_filters');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { }
        }
        return {
            bestOnly: false,
            rating: null,
            complexity: null,
            duration: null,
            gameType: null,
            smallTable: false,
            recentOnly: false
        };
    });

    useEffect(() => {
        localStorage.setItem('pref_search_filters', JSON.stringify(searchFilters));
    }, [searchFilters]);

    const resetFilter = (key: keyof typeof searchFilters) => {
        setSearchFilters(prev => ({
            ...prev,
            [key]: (key === 'bestOnly' || key === 'smallTable' || key === 'recentOnly') ? false : null
        }));
    };

    const SCORING_MODES: { value: ScoringRule, label: string }[] = [
        { value: 'HIGHEST_WINS', label: tCommon('rule_highest_wins') },
        { value: 'LOWEST_WINS', label: tCommon('rule_lowest_wins') },
        { value: 'COOP', label: tCommon('rule_coop') },
        { value: 'COMPETITIVE_NO_SCORE', label: tCommon('rule_competitive_no_score') },
        { value: 'COOP_NO_SCORE', label: tCommon('rule_coop_no_score') },
    ];

    // --- Logic: Process Options ---

    // 1. 搜尋匹配 (意圖)：系統根據搜尋字串找出最匹配的項目
    const baseOptions = useMemo(() => {
        if (isSearching) return getSearchResults(options, searchQuery);
        return getRecommendations(options);
    }, [options, isSearching, searchQuery]);

    // 2. 確定預測對象：Hook 根據此對象來建議環境
    const predictionTarget = useMemo(() => {
        if (userSelectedUid) return options.find(t => t.uid === userSelectedUid) || null;
        return baseOptions[0] || null;
    }, [baseOptions, userSelectedUid, options]);

    // 搜尋字串改變時，清空手動選取
    useEffect(() => {
        setUserSelectedUid(null);
    }, [searchQuery]);

    // 3. 環境預測 (Hook)
    const {
        playerCount, setPlayerCount,
        isPlayerCountManual,
        location, setLocation,
        isLocationManual,
        locationId, setLocationId,
        scoringRule, setScoringRule,
        startTimeStr, setStartTimeStr
    } = useRecommendedGameSetup(predictionTarget);

    // [Lock] 當進入進階模式或開啟最佳人數時，自動上鎖 (變綠色)
    useEffect(() => {
        if ((isAdvancedMode || searchFilters.bestOnly) && !isPlayerCountManual) {
            setPlayerCount(playerCount);
        }
    }, [isAdvancedMode, searchFilters.bestOnly, playerCount, isPlayerCountManual, setPlayerCount]);

    // 4. 最終過濾結果：真正的搜尋結果，包含了人數篩選
    const processedOptions = useMemo(() => {
        if (searchFilters.bestOnly) {
            return baseOptions.filter(opt => opt.bestPlayers?.includes(playerCount));
        }
        return baseOptions;
    }, [baseOptions, searchFilters.bestOnly, playerCount]);

    // 5. 決定底部項目 (Docked Item)
    const dockedItem = useMemo(() => {
        if (userSelectedUid) return processedOptions.find(t => t.uid === userSelectedUid) || null;
        return processedOptions[0] || null;
    }, [processedOptions, userSelectedUid]);

    // --- UI Effects ---

    // Smart Focus Logic
    useEffect(() => {
        if (isManualInput && hasLocationHistory && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isManualInput, hasLocationHistory]);

    // Reset manual mode if history becomes available
    useEffect(() => {
        if (uniqueLocations.length === 0) {
            setIsManualInput(true);
        } else {
            if (!location) {
                setIsManualInput(false);
            }
        }
    }, [uniqueLocations.length]);

    // Auto-scroll menu
    useEffect(() => {
        if (activeMenu?.type === 'location' && listRef.current) {
            const scroll = () => {
                if (listRef.current) {
                    listRef.current.scrollTop = listRef.current.scrollHeight;
                }
            };
            scroll();
            const timer = setTimeout(scroll, 50);
            return () => clearTimeout(timer);
        }
    }, [activeMenu]);

    // Global click to close menu
    useEffect(() => {
        if (!activeMenu) return;
        const handleClick = (e: MouseEvent) => {
            // Handled by overlay
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [activeMenu]);

    const scrollableItems = useMemo(() => {
        let items = processedOptions;
        if (dockedItem) {
            items = items.filter(t => t.uid !== dockedItem.uid);
        }
        if (!isSearching) {
            items = items.filter(opt => opt.uid !== '__CREATE_NEW__');
        }
        return items;
    }, [isSearching, processedOptions, dockedItem]);

    const showImportHint = useMemo(() => {
        if (!isSearching || !searchQuery) return false;

        const len = [...searchQuery.trim()].reduce(
            (sum, ch) => sum + (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch) ? 2 : 1), 0
        );
        if (len < 4) return false;

        if (!dockedItem || dockedItem.uid === '__CREATE_NEW__') return true;

        return !(dockedItem.cleanName || dockedItem.displayName)
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase());
    }, [isSearching, searchQuery, dockedItem]);

    const currentModeLabel = SCORING_MODES.find(m => m.value === scoringRule)?.label || t('selector_rule_label');

    // --- Handlers ---

    const handleOptionClick = (t: GameOption) => {
        setUserSelectedUid(t.uid);
    };

    const handleStart = () => {
        if (dockedItem) {
            onStart(dockedItem, playerCount, location, locationId, { startTimeStr, scoringRule });
        }
    };

    const handleLocationSelect = (locItem: SavedListItem) => {
        // [Update] Pass both name and ID to the unified setter
        setLocation(locItem.name, locItem.id);
        setActiveMenu(null);
    };

    const handleLocationChange = (val: string) => {
        setLocation(val); // Clears ID implicitly in hook
    }

    const switchToList = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsManualInput(false);
    };

    const openMenu = (type: 'mode' | 'location', e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const bottomSpace = window.innerHeight - rect.top;
        setActiveMenu({
            type,
            bottom: bottomSpace,
            left: rect.left,
            width: rect.width
        });
    };

    const handleTimeClick = (e: React.MouseEvent<HTMLInputElement>) => {
        try {
            if ('showPicker' in HTMLInputElement.prototype) {
                e.currentTarget.showPicker();
            }
        } catch (error) { }
    };

    // Constants
    // [Fix] Use static class string for Tailwind compiler detection
    const BOTTOM_ROW_HEIGHT_CLASS = "h-[60px]";
    const LIST_ITEM_HEIGHT = "h-[56px]";
    const RIGHT_PANEL_WIDTH = "w-[140px]";

    const renderItem = (option: GameOption, isDocked: boolean = false) => {
        const isSelected = isDocked;
        const isVirtual = option.uid === '__CREATE_NEW__';
        const isSimple = !option.templateId && !isVirtual;

        const heightClass = isDocked ? BOTTOM_ROW_HEIGHT_CLASS : LIST_ITEM_HEIGHT;

        const metaParts: string[] = [];

        if (option.bestPlayers && option.bestPlayers.length > 0) {
            metaParts.push(`${option.bestPlayers.join(', ')}${t('selector_unit_player')}`);
        } else if (option.minPlayers) {
            if (option.maxPlayers && option.maxPlayers !== option.minPlayers) {
                metaParts.push(`${option.minPlayers}-${option.maxPlayers}${t('selector_unit_player')}`);
            } else {
                metaParts.push(`${option.minPlayers}${t('selector_unit_player')}`);
            }
        } else if (option.defaultPlayerCount) {
            metaParts.push(`${option.defaultPlayerCount}${t('selector_unit_player')}`);
        }

        if (option.playingTime) {
            metaParts.push(`${option.playingTime}${t('selector_unit_minute')}`);
        }

        if (option.complexity && option.complexity > 0) {
            metaParts.push(`${t('selector_meta_complexity')} ${Number(option.complexity).toFixed(1)}`);
        }

        const metaString = metaParts.join(' • ');
        const isRecommended = !!(option.bestPlayers && option.bestPlayers.length > 0);

        return (
            <div key={option.uid} className={`${heightClass} w-full relative group shrink-0`}>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOptionClick(option)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOptionClick(option);
                        }
                    }}
                    className={`absolute inset-0 w-full px-4 text-left cursor-pointer transition-all ${isSelected ? 'bg-surface-bg z-10' : 'bg-transparent text-txt-secondary hover:bg-surface-bg/50'}`}
                >
                    <div className="flex items-stretch w-full h-full gap-3">
                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 py-1">
                            <div className={`text-sm font-bold truncate ${isSelected ? 'text-txt-primary' : ''} ${isVirtual ? 'text-brand-primary' : ''}`}>
                                {isVirtual ? t('selector_create_and_score', { name: option.displayName }) : option.displayName}
                            </div>

                            <div className="text-[10px] opacity-60 flex items-center gap-1 h-4">
                                {isVirtual ? (
                                    <>
                                        <Plus size={10} />
                                        <span>{t('selector_quick_start')}</span>
                                    </>
                                ) : (
                                    <>
                                        {isRecommended && <ThumbsUp size={10} className="text-status-success mb-0.5" strokeWidth={2.5} />}
                                        <span className="truncate">{metaString || t('selector_meta_not_set')}</span>
                                    </>
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

    const containerLayoutClass = isAdvancedMode
        ? "inset-0 top-[56px]"
        : "bottom-0 left-0 right-0 h-[220px]";

    return (
        <div
            ref={ref}
            className={`fixed z-40 flex flex-row items-end pointer-events-none transition-all duration-300 ease-in-out ${containerLayoutClass}`}
        >

            {/* --- LEFT: Game List --- */}
            <div className={`flex-1 flex flex-col bg-app-bg border-t border-surface-border shadow-ui-floating pointer-events-auto relative transition-all duration-300 h-full`}>
                <div className="absolute top-0 left-0 right-0 p-1 text-center pointer-events-none z-10 opacity-30">
                    <ChevronUp size={12} className="text-txt-muted mx-auto" />
                </div>

                {processedOptions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-txt-muted opacity-50 pb-10">
                        <Search size={32} />
                        <span className="text-xs mt-2">{t('selector_no_results')}</span>
                        {showImportHint && onOpenBgStats && onOpenBggImport && (
                            <div className="flex flex-col items-center gap-2 mt-4 animate-in fade-in duration-300 pointer-events-auto">
                                <span className="text-[11px] text-txt-muted">{t('selector_import_hint')}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenBgStats(); }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-brand-secondary bg-surface-bg-alt hover:bg-surface-bg rounded-lg border border-surface-border transition-all active:scale-95 shadow-sm"
                                    >
                                        <FileJson size={12} />
                                        {t('btn_bgstats_open')}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenBggImport(); }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-brand-secondary bg-surface-bg-alt hover:bg-surface-bg rounded-lg border border-surface-border transition-all active:scale-95 shadow-sm"
                                    >
                                        <Database size={12} />
                                        {t('btn_bgg_open')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex-1 flex flex-col-reverse justify-start overflow-y-auto no-scrollbar">
                            {scrollableItems.map(opt => renderItem(opt, false))}
                            {showImportHint && onOpenBgStats && onOpenBggImport && (
                                <div className="shrink-0 px-3 py-2 mb-1 flex items-center gap-2 text-[11px] text-txt-muted animate-in fade-in duration-300">
                                    <span>{t('selector_import_hint')}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenBgStats(); }}
                                        className="text-brand-secondary font-bold hover:underline"
                                    >
                                        BG Stats
                                    </button>
                                    <span>|</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenBggImport(); }}
                                        className="text-brand-secondary font-bold hover:underline"
                                    >
                                        BGG
                                    </button>
                                </div>
                            )}
                            <div className="h-2 shrink-0"></div>
                        </div>

                        <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} relative z-30 border-t border-surface-border bg-app-bg shadow-sm`}>
                            {dockedItem ? (
                                renderItem(dockedItem, true)
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-txt-muted text-xs italic opacity-70">
                                    {t('selector_placeholder_choice')}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* --- RIGHT: Controls (Chimney - Grows Upwards) --- */}
            <div className={`${RIGHT_PANEL_WIDTH} flex flex-col bg-app-bg-deep shrink-0 relative z-50 pointer-events-auto rounded-t-2xl shadow-ui-floating border-t border-l border-surface-border ml-[-1px] transition-all duration-300 ${isAdvancedMode ? 'h-full' : ''}`}>

                <div className={`flex flex-col p-2 gap-1.5 pb-2 min-h-[160px] ${isAdvancedMode ? 'flex-1' : ''}`}>
                    {isAdvancedMode && (
                        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1 py-1 border-b border-surface-border/30 mb-1 animate-in slide-in-from-bottom-4 duration-300">
                            {/* 0. Quick Scenario Filters (Small Table, Recent Only) */}
                            <div className="grid grid-cols-2 gap-1.5 shrink-0 border-b border-surface-border/20 pb-1.5 mb-0.5">
                                <button
                                    onClick={() => setSearchFilters(p => ({ ...p, smallTable: !p.smallTable }))}
                                    className={`h-8 text-[10px] font-black rounded-lg border transition-all ${searchFilters.smallTable ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'}`}
                                >
                                    {t('selector_filter_small_table')}
                                </button>
                                <button
                                    onClick={() => setSearchFilters(p => ({ ...p, recentOnly: !p.recentOnly }))}
                                    className={`h-8 text-[10px] font-black rounded-lg border transition-all ${searchFilters.recentOnly ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'}`}
                                >
                                    {t('selector_filter_recent_only')}
                                </button>
                            </div>

                            {/* 1. Type Filter (Competitive / Cooperative) - No Title, at the top */}
                            <div className="grid grid-cols-2 gap-1.5 shrink-0 border-b border-surface-border/20 pb-1.5 mb-0.5">
                                {(['competitive', 'cooperative'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSearchFilters(p => ({ ...p, gameType: p.gameType === type ? null : type }))}
                                        className={`h-8 text-xs font-black rounded-lg border transition-all ${searchFilters.gameType === type ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'}`}
                                    >
                                        {type === 'competitive' ? t('selector_filter_type_competitive') : t('selector_filter_type_cooperative')}
                                    </button>
                                ))}
                            </div>

                            {/* 2. Players Filter (Single Toggle - Best Only) */}
                            <div className="pb-1.5 border-b border-surface-border/20 mb-0.5">
                                <button
                                    onClick={() => setSearchFilters(p => ({ ...p, bestOnly: !p.bestOnly }))}
                                    className={`w-full h-8 flex items-center justify-center gap-2 rounded-lg border transition-all ${searchFilters.bestOnly ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'}`}
                                >
                                    <Star size={12} fill={searchFilters.bestOnly ? "currentColor" : "none"} />
                                    <span className="text-[11px] font-black">{t('selector_filter_players_best', { n: playerCount })}</span>
                                </button>
                            </div>

                            {/* 2. Rating Filter */}
                            <div className="pb-1.5 border-b border-surface-border/20 mb-0.5">
                                <div className="flex items-center justify-center relative mb-0.5 h-3">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${searchFilters.rating !== null ? 'text-brand-primary' : 'text-txt-muted'}`}>{t('selector_filter_rating')}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {[7, 8, 9].map(r => (
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
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${searchFilters.complexity !== null ? 'text-brand-primary' : 'text-txt-muted'}`}>{t('selector_filter_complexity')}</span>
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
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${searchFilters.duration !== null ? 'text-brand-primary' : 'text-txt-muted'}`}>{t('selector_filter_duration')}</span>
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
                    )}

                    {/* Mode Toggle - Anchored Handle (Temporarily hidden) */}
                    {/* 
                    <button
                        onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                        className={`flex items-center justify-center gap-2 w-full transition-all active:scale-95 shrink-0 mb-1 rounded-lg border shadow-ui-floating z-10
                            ${isAdvancedMode
                                ? 'bg-app-bg-deep text-brand-primary border-brand-primary h-7'
                                : 'bg-app-bg-deep text-txt-muted border-surface-border hover:border-txt-muted h-9'
                            }
                        `}
                    >
                        {isAdvancedMode ? <ChevronDown size={18} /> : <ChevronUp size={20} />}
                        {!isAdvancedMode && <span className="text-[11px] font-black uppercase tracking-widest">{t('selector_mode_advanced')}</span>}
                    </button>
                    */}

                    {/* Mode Toggle - TOP position in Lite Mode (Removed as integrated above) */}

                    {/* 1. Time */}
                    <div className="shrink-0">
                        <div className="relative w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center justify-center">
                            <input
                                type="time"
                                value={startTimeStr}
                                onClick={handleTimeClick}
                                onChange={(e) => setStartTimeStr(e.target.value)}
                                className="bg-transparent text-txt-primary font-mono font-bold text-sm outline-none w-full text-center p-0 border-none appearance-none"
                            />
                        </div>
                    </div>

                    {/* 2. Mode */}
                    <div className="shrink-0 relative">
                        <button
                            onClick={(e) => openMenu('mode', e)}
                            className={`w-full bg-app-bg border border-surface-border rounded-lg p-2 flex items-center justify-between text-txt-primary hover:border-txt-secondary transition-colors
                          ${activeMenu?.type === 'mode' ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : ''}
                      `}
                        >
                            <div className="flex-1 flex items-center overflow-hidden">
                                <span className="text-sm font-bold truncate">{currentModeLabel}</span>
                            </div>
                            <ChevronUp size={14} className={`text-txt-muted shrink-0 transition-transform ${activeMenu?.type === 'mode' ? 'rotate-180 text-brand-primary' : ''}`} />
                        </button>
                    </div>

                    {/* 3. Location */}
                    <div className="shrink-0">
                        {isManualInput ? (
                            <div className="relative w-full">
                                <input
                                    ref={inputRef}
                                    type="search"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    name="loc"
                                    value={location}
                                    onChange={(e) => handleLocationChange(e.target.value)}
                                    placeholder={t('selector_placeholder_location')}
                                    className={`w-full bg-app-bg border rounded-lg p-2 pr-7 text-sm text-txt-primary focus:border-brand-primary outline-none placeholder-txt-muted transition-colors
                                  ${isLocationManual ? 'border-brand-primary shadow-[0_0_8px_rgba(var(--c-brand-primary),0.15)]' : 'border-surface-border'}
                              `}
                                />
                                {hasLocationHistory && (
                                    <button
                                        onClick={switchToList}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-txt-muted hover:text-brand-primary transition-colors"
                                        title={t('selector_history_location_hint')}
                                    >
                                        <List size={14} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        if (activeMenu?.type === 'location') {
                                            setIsManualInput(true);
                                            setActiveMenu(null);
                                        } else {
                                            openMenu('location', e);
                                        }
                                    }}
                                    className={`w-full flex items-center justify-between bg-app-bg border rounded-lg p-2 text-sm outline-none transition-colors text-left
                                  ${activeMenu?.type === 'location'
                                            ? 'border-brand-primary text-brand-primary bg-brand-primary/10 relative z-20'
                                            : (isLocationManual ? 'border-brand-primary text-txt-primary shadow-[0_0_8px_rgba(var(--c-brand-primary),0.15)]' : 'border-surface-border hover:border-txt-secondary text-txt-primary')
                                        }
                              `}
                                >
                                    {activeMenu?.type === 'location' ? (
                                        <span className="flex items-center gap-2 font-bold animate-in fade-in duration-200">
                                            <PenLine size={14} />
                                            {t('selector_new_location')}
                                        </span>
                                    ) : (
                                        <span className={`truncate ${!location ? 'text-txt-muted' : ''}`}>
                                            {location || t('selector_placeholder_location_select')}
                                        </span>
                                    )}

                                    <ChevronUp
                                        size={14}
                                        className={`shrink-0 ml-1 transition-transform duration-200 ${activeMenu?.type === 'location' ? 'rotate-180 text-brand-primary' : (isLocationManual ? 'text-brand-primary/80' : 'text-txt-muted')}`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 4. Player Count */}
                    <div className="shrink-0 flex flex-col justify-center items-center py-1">
                        <div
                            className={`flex items-center justify-between w-full bg-app-bg rounded-xl p-1.5 border relative overflow-hidden transition-all duration-300 ${isPlayerCountManual ? 'border-brand-primary shadow-[0_0_10px_rgba(var(--c-brand-primary),0.2)]' : 'border-surface-border'}`}
                        >
                            <button
                                onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                                className={`w-9 h-9 flex items-center justify-center bg-surface-bg text-txt-muted rounded-lg active:scale-95 transition-transform hover:bg-surface-bg-alt relative z-10 shrink-0 ${isPlayerCountManual ? 'opacity-80' : ''}`}
                            >
                                <Minus size={16} />
                            </button>

                            <div className="flex-1 relative h-9 flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                    <Users size={24} className="transition-colors text-txt-muted opacity-40" />
                                </div>
                                <span className={`text-xl font-black font-mono relative z-10 drop-shadow-md transition-colors ${isPlayerCountManual ? 'text-brand-primary' : 'text-txt-primary'}`}>
                                    {playerCount}
                                </span>
                            </div>

                            <button
                                onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                                className={`w-9 h-9 flex items-center justify-center bg-brand-primary/10 text-brand-primary rounded-lg active:scale-95 transition-transform border border-brand-primary/20 hover:bg-brand-primary/20 relative z-10 shrink-0 ${isPlayerCountManual ? 'opacity-80' : ''}`}
                            >
                                <Plus size={16} />
                            </button>

                        </div>
                    </div>

                    {/* Mode Toggle - BOTTOM position in Advanced Mode (Integrated at top) */}
                </div>

                {/* 5. Bottom Actions */}
                <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-surface-border z-10 bg-app-bg-deep`}>
                    <button
                        onClick={onSearchClick}
                        className="w-[50px] h-full flex items-center justify-center bg-app-bg hover:bg-surface-bg text-brand-primary transition-colors active:brightness-90 border-r border-surface-border"
                        title={t('selector_search_more')}
                    >
                        <Search size={22} strokeWidth={2.5} />
                    </button>

                    <button
                        onClick={handleStart}
                        disabled={!dockedItem}
                        className={`
                      w-[90px] h-full flex flex-col items-center justify-center transition-all active:brightness-90
                      ${dockedItem
                                ? 'bg-brand-primary hover:filter hover:brightness-110 text-white'
                                : 'bg-surface-bg text-txt-muted cursor-not-allowed'
                            }
                  `}
                    >
                        {dockedItem?.uid === '__CREATE_NEW__' ? <Plus size={28} /> : <Play size={28} fill="currentColor" />}
                    </button>
                </div>
            </div>

            {/* Overflow Menus */}
            {activeMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[60] pointer-events-auto"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (activeMenu.type === 'location') setIsManualInput(true);
                            setActiveMenu(null);
                        }}
                    />
                    <div
                        ref={listRef}
                        className="fixed bg-surface-bg border border-surface-border rounded-xl shadow-ui-floating z-[70] overflow-hidden max-h-[50vh] overflow-y-auto no-scrollbar flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 pointer-events-auto"
                        style={{
                            bottom: `${activeMenu.bottom + 8}px`,
                            left: `${activeMenu.left}px`,
                            width: `${activeMenu.width}px`
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {activeMenu.type === 'mode' && [...SCORING_MODES].reverse().map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setScoringRule(opt.value); setActiveMenu(null); }}
                                className={`w-full text-left px-3 py-2.5 text-xs font-bold border-b border-surface-border/50 last:border-0 hover:bg-surface-bg-alt flex items-center justify-between ${scoringRule === opt.value ? 'text-brand-primary bg-brand-primary/10' : 'text-txt-primary'}`}
                            >
                                {opt.label}
                                {scoringRule === opt.value && <Check size={12} />}
                            </button>
                        ))}

                        {activeMenu.type === 'location' && (
                            <>
                                {uniqueLocations.map((loc) => (
                                    <button
                                        key={loc.id}
                                        onClick={() => handleLocationSelect(loc)}
                                        className="w-full text-left px-3 py-3 text-xs text-txt-secondary hover:bg-surface-bg-alt hover:text-txt-primary border-b border-surface-border/50 last:border-0 truncate font-medium shrink-0 leading-normal block"
                                    >
                                        {loc.name}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </>
            )}

        </div>
    );
});

StartGamePanel.displayName = 'StartGamePanel';

export default StartGamePanel;
