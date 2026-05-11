
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedListItem, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { Users, Minus, Plus, Play, ChevronUp, Search, PenLine, List, ThumbsUp, Pin, Check, ChevronDown, FileJson, Database, Maximize2, Minimize2, Star, X, Brain, Calendar, Mountain, Clock, Trophy } from 'lucide-react';
import { useStartGamePanelController } from '../hooks/useStartGamePanelController';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';
import { GameOptionItem } from './GameOptionItem';
import { AdvancedFilterChimney } from './AdvancedFilterChimney';
import { GameLaunchDashboard } from './GameLaunchDashboard';
import { GameListView } from './GameListView';

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
            <GameListView
                processedOptions={processedOptions}
                scrollableItems={scrollableItems}
                dockedItem={dockedItem}
                playerCount={playerCount}
                searchFilters={searchFilters}
                isAdvancedMode={isAdvancedMode}
                showImportHint={showImportHint}
                onOptionClick={handleOptionClick}
                onPin={onPin}
                onOpenBgStats={onOpenBgStats}
                onOpenBggImport={onOpenBggImport}
            />

            {/* --- RIGHT: Controls (Chimney - Grows Upwards) --- */}
            <div className={`${RIGHT_PANEL_WIDTH} flex flex-col bg-app-bg-deep shrink-0 relative z-50 pointer-events-auto rounded-t-2xl shadow-ui-floating border-t border-l border-surface-border ml-[-1px] transition-all duration-300 ${isAdvancedMode ? 'h-full' : ''}`}>

                <div className={`flex flex-col p-2 gap-1.5 pb-2 min-h-[160px] ${isAdvancedMode ? 'flex-1' : ''}`}>
                    {isAdvancedMode && (
                        <AdvancedFilterChimney
                            searchFilters={searchFilters}
                            setSearchFilters={setSearchFilters}
                            playerCount={playerCount}
                        />
                    )}

                    <GameLaunchDashboard
                        isAdvancedMode={isAdvancedMode}
                        setIsAdvancedMode={setIsAdvancedMode}
                        startTimeStr={startTimeStr}
                        setStartTimeStr={setStartTimeStr}
                        currentModeLabel={currentModeLabel}
                        activeMenu={activeMenu}
                        setActiveMenu={setActiveMenu}
                        isManualInput={isManualInput}
                        setIsManualInput={setIsManualInput}
                        location={location}
                        isLocationManual={isLocationManual}
                        hasLocationHistory={hasLocationHistory}
                        playerCount={playerCount}
                        setPlayerCount={setPlayerCount}
                        isPlayerCountManual={isPlayerCountManual}
                        handleTimeClick={handleTimeClick}
                        openMenu={openMenu}
                        handleLocationChange={handleLocationChange}
                        switchToList={switchToList}
                        inputRef={inputRef}
                    />

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
