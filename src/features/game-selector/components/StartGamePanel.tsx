
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedListItem, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { Users, Minus, Plus, Play, ChevronUp, Search, PenLine, List, ThumbsUp, Pin, Check, ChevronDown, FileJson, Database, Maximize2, Minimize2, Star, X, Brain, Calendar, Mountain, Clock, Trophy } from 'lucide-react';
import { useStartGamePanelController } from '../hooks/useStartGamePanelController';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';
import { GameOptionItem } from './GameOptionItem';

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

    const {
        // State
        playerCount, setPlayerCount, isPlayerCountManual,
        location, setLocation, isLocationManual, locationId,
        scoringRule, setScoringRule,
        startTimeStr, setStartTimeStr,
        isAdvancedMode, setIsAdvancedMode,
        searchFilters, setSearchFilters, resetFilter,
        processedOptions, predictionTarget,
        userSelectedUid, setUserSelectedUid,
        activeMenu, setActiveMenu,
        isManualInput, setIsManualInput,
        
        // Derived
        uniqueLocations, hasLocationHistory,
        dockedItem, scrollableItems, showImportHint,
        SCORING_MODES, currentModeLabel,

        // Refs
        inputRef, listRef,

        // Handlers
        handleOptionClick, handleStart,
        handleLocationSelect, handleLocationChange,
        switchToList, openMenu, handleTimeClick
    } = useStartGamePanelController({
        options, locations, onStart, isSearching, searchQuery
    });

    // Constants
    // [Fix] Use static class string for Tailwind compiler detection
    const BOTTOM_ROW_HEIGHT_CLASS = "h-[60px]";
    const LIST_ITEM_HEIGHT = "h-[56px]";
    const RIGHT_PANEL_WIDTH = "w-[140px]";


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
                            {scrollableItems.map(opt => (
                                <GameOptionItem
                                    key={opt.uid}
                                    option={opt}
                                    isDocked={false}
                                    playerCount={playerCount}
                                    searchFilters={searchFilters}
                                    isAdvancedMode={isAdvancedMode}
                                    onClick={handleOptionClick}
                                    onPin={onPin}
                                />
                            ))}
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
                                <GameOptionItem
                                    option={dockedItem}
                                    isDocked={true}
                                    playerCount={playerCount}
                                    searchFilters={searchFilters}
                                    isAdvancedMode={isAdvancedMode}
                                    onClick={handleOptionClick}
                                    onPin={onPin}
                                />
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
                            {/* 0. Quick Scenario Filters (Small Table) */}
                            <div className="flex shrink-0 border-b border-surface-border/20 pb-1.5 mb-0.5">
                                <button
                                    onClick={() => setSearchFilters(p => ({ ...p, smallTable: !p.smallTable }))}
                                    className={`w-full h-8 text-[10px] font-black rounded-lg border transition-all ${searchFilters.smallTable ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-surface-bg/40 border-surface-border text-txt-primary hover:border-txt-primary'}`}
                                >
                                    {t('selector_filter_small_table')}
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
                    )}

                    {/* Mode Toggle - Anchored Handle */}
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
