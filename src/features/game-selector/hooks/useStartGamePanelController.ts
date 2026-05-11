import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SavedListItem, ScoringRule } from '../../../types';
import { GameOption } from '../types';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';
import { useGameSelectorLogic } from './useGameSelectorLogic';
import { useRecommendedGameSetup } from './useRecommendedGameSetup';

export interface UseStartGamePanelControllerProps {
    options: GameOption[];
    locations?: SavedListItem[];
    onStart: (option: GameOption, playerCount: number, location: string, locationId?: string, extra?: { startTimeStr?: string, scoringRule?: ScoringRule }) => void;
    isSearching?: boolean;
    searchQuery?: string;
}

export const useStartGamePanelController = ({
    options,
    locations = [],
    onStart,
    isSearching = false,
    searchQuery = ''
}: UseStartGamePanelControllerProps) => {
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
    const [activePredictionTarget, setActivePredictionTarget] = useState<GameOption | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // --- 1. Environment Setup (Hook) ---
    const {
        playerCount, setPlayerCount,
        isPlayerCountManual,
        location, setLocation,
        isLocationManual,
        locationId, setLocationId,
        scoringRule, setScoringRule,
        startTimeStr, setStartTimeStr
    } = useRecommendedGameSetup(activePredictionTarget);

    // --- 2. Logic Hub (Hook) ---
    const {
        isAdvancedMode, setIsAdvancedMode,
        searchFilters, setSearchFilters, resetFilter,
        processedOptions,
        predictionTarget
    } = useGameSelectorLogic(options, isSearching, searchQuery, userSelectedUid, setUserSelectedUid, playerCount);

    // Sync prediction target to resolve circular hook dependency
    useEffect(() => {
        setActivePredictionTarget(predictionTarget);
    }, [predictionTarget]);

    // --- Bridging Effect: Auto-Lock ---
    useEffect(() => {
        if (isAdvancedMode && searchFilters.playerFilter !== 'none' && !isPlayerCountManual) {
            setPlayerCount(playerCount);
        }
    }, [isAdvancedMode, searchFilters.playerFilter, playerCount, isPlayerCountManual, setPlayerCount]);

    const SCORING_MODES: { value: ScoringRule, label: string }[] = [
        { value: 'HIGHEST_WINS', label: tCommon('rule_highest_wins') },
        { value: 'LOWEST_WINS', label: tCommon('rule_lowest_wins') },
        { value: 'COOP', label: tCommon('rule_coop') },
        { value: 'COMPETITIVE_NO_SCORE', label: tCommon('rule_competitive_no_score') },
        { value: 'COOP_NO_SCORE', label: tCommon('rule_coop_no_score') },
    ];

    // 5. Docked Item
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
        setLocation(locItem.name, locItem.id);
        setActiveMenu(null);
    };

    const handleLocationChange = (val: string) => {
        setLocation(val);
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

    return {
        // State
        playerCount,
        setPlayerCount,
        isPlayerCountManual,
        location,
        setLocation,
        isLocationManual,
        locationId,
        scoringRule,
        setScoringRule,
        startTimeStr,
        setStartTimeStr,
        isAdvancedMode,
        setIsAdvancedMode,
        searchFilters,
        setSearchFilters,
        resetFilter,
        processedOptions,
        predictionTarget,
        userSelectedUid,
        setUserSelectedUid,
        activeMenu,
        setActiveMenu,
        isManualInput,
        setIsManualInput,
        
        // Derived
        uniqueLocations,
        hasLocationHistory,
        dockedItem,
        scrollableItems,
        showImportHint,
        SCORING_MODES,
        currentModeLabel,

        // Refs
        inputRef,
        listRef,

        // Handlers
        handleOptionClick,
        handleStart,
        handleLocationSelect,
        handleLocationChange,
        switchToList,
        openMenu,
        handleTimeClick
    };
};

export type StartGamePanelController = ReturnType<typeof useStartGamePanelController>;
