
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedListItem, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { Users, Minus, Plus, Play, ChevronUp, Search, PenLine, List, ThumbsUp, Pin, Check, ChevronDown } from 'lucide-react';
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
}



const StartGamePanel = React.forwardRef<HTMLDivElement, StartGamePanelProps>(({
    options,
    locations = [],
    onStart,
    onSearchClick,
    onPin,
    isSearching = false,
    searchQuery = ''
}, ref) => {
    const { t } = useIntegrationTranslation();
    const { t: tCommon } = useCommonTranslation();

    const SCORING_MODES: { value: ScoringRule, label: string }[] = [
        { value: 'HIGHEST_WINS', label: tCommon('rule_highest_wins') },
        { value: 'LOWEST_WINS', label: tCommon('rule_lowest_wins') },
        { value: 'COOP', label: tCommon('rule_coop') },
        { value: 'COMPETITIVE_NO_SCORE', label: tCommon('rule_competitive_no_score') },
        { value: 'COOP_NO_SCORE', label: tCommon('rule_coop_no_score') },
    ];

    // --- Derived Data ---
    const uniqueLocations = useMemo(() => {
        return [...locations].sort((a, b) => a.lastUsed - b.lastUsed);
    }, [locations]);

    const hasLocationHistory = uniqueLocations.length > 0;

    // --- Logic: Process Options ---
    const processedOptions = useMemo(() => {
        if (isSearching) {
            return getSearchResults(options, searchQuery);
        } else {
            return getRecommendations(options);
        }
    }, [options, isSearching, searchQuery]);

    // --- Local UI State (Selection & Menus) ---
    const [selectedOptionUid, setSelectedOptionUid] = useState<string | null>(null);
    const [activeMenu, setActiveMenu] = useState<{ type: 'mode' | 'location', bottom: number, left: number, width: number } | null>(null);
    const [isManualInput, setIsManualInput] = useState(!hasLocationHistory);
    const [showRuleMenu, setShowRuleMenu] = useState(false); // For compact dropdown

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-select first option
    useEffect(() => {
        if (processedOptions.length > 0) {
            setSelectedOptionUid(processedOptions[0].uid);
        } else {
            setSelectedOptionUid(null);
        }
    }, [processedOptions]);

    // Determine Docked Item
    const dockedItem = useMemo(() => {
        if (selectedOptionUid) {
            const found = processedOptions.find(t => t.uid === selectedOptionUid);
            if (found) return found;
        }
        if (processedOptions.length > 0) {
            return processedOptions[0];
        }
        return null;
    }, [processedOptions, selectedOptionUid]);

    // --- Hook: Setup State & Recommendations ---
    // Passing dockedItem as the active context for recommendations
    const {
        playerCount, setPlayerCount,
        isPlayerCountManual,
        location, setLocation,
        isLocationManual, // [New] Visual feedback state
        locationId, setLocationId,
        scoringRule, setScoringRule,
        startTimeStr, setStartTimeStr
    } = useRecommendedGameSetup(dockedItem);

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
        if (!dockedItem) return processedOptions;
        return processedOptions.filter(t => t.uid !== dockedItem.uid);
    }, [processedOptions, dockedItem]);

    const currentModeLabel = SCORING_MODES.find(m => m.value === scoringRule)?.label || t('selector_rule_label');

    // --- Handlers ---

    const handleOptionClick = (t: GameOption) => {
        setSelectedOptionUid(t.uid);
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
                <button
                    onClick={() => handleOptionClick(option)}
                    className={`absolute inset-0 w-full px-4 text-left transition-all ${isSelected ? 'bg-slate-800 z-10' : 'bg-transparent text-slate-400 hover:bg-slate-800/50'}`}
                >
                    <div className="flex items-stretch w-full h-full gap-3">
                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 py-1">
                            <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : ''} ${isVirtual ? 'text-emerald-400' : ''}`}>
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
                                        {isRecommended && <ThumbsUp size={10} className="text-emerald-500 mb-0.5" strokeWidth={2.5} />}
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
                                        ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-500'
                                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-700'
                                    }
                                `}
                                title={option.isPinned ? t('selector_unpin_hint') : t('selector_pin_hint')}
                            >
                                <Pin size={12} className={option.isPinned ? "fill-current" : ""} />
                                <span className="text-[9px] leading-none scale-90 origin-center font-bold">{t('selector_label_simple')}</span>
                            </button>
                        )}
                    </div>
                </button>
                {!isDocked && <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-800 pointer-events-none"></div>}
            </div>
        );
    };

    return (
        <div ref={ref} className="fixed bottom-0 left-0 right-0 z-40 flex flex-row items-end pointer-events-none animate-in slide-in-from-bottom-full duration-300">

            {/* --- LEFT: Game List (Fixed Height Base) --- */}
            <div className="flex-1 flex flex-col bg-slate-900 h-[220px] min-h-0 border-t border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto relative">
                <div className="absolute top-0 left-0 right-0 p-1 text-center pointer-events-none z-10 opacity-30">
                    <ChevronUp size={12} className="text-slate-500 mx-auto" />
                </div>

                {processedOptions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 pb-10">
                        <Search size={32} />
                        <span className="text-xs mt-2">{t('selector_no_results')}</span>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 flex flex-col-reverse justify-start overflow-y-auto no-scrollbar">
                            {scrollableItems.map(opt => renderItem(opt, false))}
                            <div className="h-2 shrink-0"></div>
                        </div>

                        <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} relative z-30 border-t border-slate-800 bg-slate-900 shadow-[0_-4px_15px_rgba(0,0,0,0.3)]`}>
                            {dockedItem ? (
                                renderItem(dockedItem, true)
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs italic opacity-70">
                                    {t('selector_placeholder_choice')}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* --- RIGHT: Controls (Chimney - Grows Upwards) --- */}
            <div className={`${RIGHT_PANEL_WIDTH} flex flex-col bg-slate-950 shrink-0 relative z-50 pointer-events-auto rounded-t-2xl shadow-2xl border-t border-l border-slate-700 ml-[-1px]`}>

                <div className="flex flex-col justify-end p-2 gap-2 pb-2 min-h-[160px]">

                    {/* 1. Time */}
                    <div className="shrink-0">
                        <div className="relative w-full bg-slate-900 border border-slate-700 rounded-lg p-2 flex items-center justify-center">
                            <input
                                type="time"
                                value={startTimeStr}
                                onClick={handleTimeClick}
                                onChange={(e) => setStartTimeStr(e.target.value)}
                                className="bg-transparent text-white font-mono font-bold text-sm outline-none w-full text-center p-0 border-none appearance-none"
                            />
                        </div>
                    </div>

                    {/* 2. Mode */}
                    <div className="shrink-0 relative">
                        <button
                            onClick={(e) => openMenu('mode', e)}
                            className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-2 flex items-center justify-between text-white hover:border-slate-600 transition-colors
                          ${activeMenu?.type === 'mode' ? 'border-emerald-500 text-emerald-400 bg-emerald-900/10' : ''}
                      `}
                        >
                            <div className="flex-1 flex items-center overflow-hidden">
                                <span className="text-sm font-bold truncate">{currentModeLabel}</span>
                            </div>
                            <ChevronUp size={14} className={`text-slate-500 shrink-0 transition-transform ${activeMenu?.type === 'mode' ? 'rotate-180 text-emerald-500' : ''}`} />
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
                                    className={`w-full bg-slate-900 border rounded-lg p-2 pr-7 text-sm text-white focus:border-emerald-500 outline-none placeholder-slate-400 transition-colors
                                  ${isLocationManual ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : 'border-slate-700'}
                              `}
                                />
                                {hasLocationHistory && (
                                    <button
                                        onClick={switchToList}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-emerald-400 transition-colors"
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
                                    className={`w-full flex items-center justify-between bg-slate-900 border rounded-lg p-2 text-sm outline-none transition-colors text-left
                                  ${activeMenu?.type === 'location'
                                            ? 'border-emerald-500 text-emerald-400 bg-emerald-900/10 relative z-20'
                                            : (isLocationManual ? 'border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.15)]' : 'border-slate-700 hover:border-slate-600 text-white')
                                        }
                              `}
                                >
                                    {activeMenu?.type === 'location' ? (
                                        <span className="flex items-center gap-2 font-bold animate-in fade-in duration-200">
                                            <PenLine size={14} />
                                            {t('selector_new_location')}
                                        </span>
                                    ) : (
                                        <span className={`truncate ${!location ? 'text-slate-400' : ''}`}>
                                            {location || t('selector_placeholder_location_select')}
                                        </span>
                                    )}

                                    <ChevronUp
                                        size={14}
                                        className={`shrink-0 ml-1 transition-transform duration-200 ${activeMenu?.type === 'location' ? 'rotate-180 text-emerald-500' : (isLocationManual ? 'text-emerald-500/80' : 'text-slate-500')}`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 4. Player Count */}
                    <div className="shrink-0 flex flex-col justify-center items-center py-1">
                        <div
                            className={`flex items-center justify-between w-full bg-slate-900 rounded-xl p-1.5 border relative overflow-hidden transition-all duration-300 ${isPlayerCountManual ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-700'}`}
                        >
                            <button
                                onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                                className={`w-9 h-9 flex items-center justify-center bg-slate-800 text-slate-400 rounded-lg active:scale-90 transition-transform hover:bg-slate-700 relative z-10 shrink-0 ${isPlayerCountManual ? 'opacity-80' : ''}`}
                            >
                                <Minus size={16} />
                            </button>

                            <div className="flex-1 flex items-center justify-center relative h-9">
                                <Users size={24} className={`absolute pointer-events-none transition-colors ${isPlayerCountManual ? 'text-emerald-500/20' : 'text-slate-600'}`} />
                                <span className={`text-xl font-black font-mono relative z-10 drop-shadow-md transition-colors ${isPlayerCountManual ? 'text-emerald-400' : 'text-white'}`}>
                                    {playerCount}
                                </span>
                            </div>

                            <button
                                onClick={() => setPlayerCount(Math.min(20, playerCount + 1))}
                                className={`w-9 h-9 flex items-center justify-center bg-emerald-900/30 text-emerald-400 rounded-lg active:scale-90 transition-transform border border-emerald-500/30 hover:bg-emerald-900/50 relative z-10 shrink-0 ${isPlayerCountManual ? 'opacity-80' : ''}`}
                            >
                                <Plus size={16} />
                            </button>

                        </div>
                    </div>
                </div>

                {/* 5. Bottom Actions */}
                <div className={`flex-none ${BOTTOM_ROW_HEIGHT_CLASS} flex border-t border-slate-800 z-10 bg-slate-950`}>
                    <button
                        onClick={onSearchClick}
                        className="w-[50px] h-full flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-emerald-500 transition-colors active:brightness-90 border-r border-slate-800"
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
                                ? (dockedItem.uid === '__CREATE_NEW__' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white')
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
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
                        className="fixed bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[70] overflow-hidden max-h-[50vh] overflow-y-auto no-scrollbar flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 pointer-events-auto"
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
                                className={`w-full text-left px-3 py-2.5 text-xs font-bold border-b border-slate-700/50 last:border-0 hover:bg-slate-700 flex items-center justify-between ${scoringRule === opt.value ? 'text-emerald-400 bg-emerald-900/10' : 'text-slate-200'}`}
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
                                        className="w-full text-left px-3 py-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white border-b border-slate-700/50 last:border-0 truncate font-medium shrink-0 leading-normal block"
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
