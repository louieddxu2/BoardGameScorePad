
import React from 'react';
import { SavedListItem, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { ChevronUp } from 'lucide-react';
import { useStartGamePanelController } from '../hooks/useStartGamePanelController';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';
import { GameOptionItem } from './GameOptionItem';
import { AdvancedFilterChimney } from './AdvancedFilterChimney';
import { GameLaunchDashboard } from './GameLaunchDashboard';
import { GameListView } from './GameListView';
import { GameLaunchActions } from './GameLaunchActions';
import { StartGameOverlays } from './StartGameOverlays';

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
    onOpenCloudLibrary?: () => void;
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
    onOpenBggImport,
    onOpenCloudLibrary
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
                onOpenCloudLibrary={onOpenCloudLibrary}
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

                <GameLaunchActions
                    dockedItem={dockedItem}
                    onSearchClick={onSearchClick}
                    handleStart={handleStart}
                />
            </div>

            <StartGameOverlays
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                setIsManualInput={setIsManualInput}
                listRef={listRef}
                SCORING_MODES={SCORING_MODES}
                scoringRule={scoringRule}
                setScoringRule={setScoringRule}
                uniqueLocations={uniqueLocations}
                handleLocationSelect={handleLocationSelect}
            />

        </div>
    );
});

StartGamePanel.displayName = 'StartGamePanel';

export default StartGamePanel;
