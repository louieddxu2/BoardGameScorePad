import { useState, useEffect, useMemo } from 'react';
import { GameOption, SearchFilters } from '../types';
import { getSearchResults, getRecommendations } from '../utils/sortStrategies';

/**
 * useGameSelectorLogic
 * 封裝搜尋模式、篩選器狀態、搜尋/推薦結果派生。
 * 
 * 注意：不接收 playerCount，因為 playerCount 來自 useRecommendedGameSetup，
 * 而該 Hook 需要本 Hook 的 predictionTarget，會形成循環依賴。
 * 上鎖邏輯（bridging effect）留在組件層。
 */
export const useGameSelectorLogic = (
    options: GameOption[],
    isSearching: boolean,
    searchQuery: string,
    userSelectedUid: string | null,
    setUserSelectedUid: (uid: string | null) => void
) => {
    // --- Advanced Mode ---
    const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(() => {
        return localStorage.getItem('pref_search_advanced') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('pref_search_advanced', isAdvancedMode.toString());
    }, [isAdvancedMode]);

    // --- Search Filters ---
    const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => {
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

    // --- Derived: Search / Recommendations ---
    const baseOptions = useMemo(() => {
        if (isSearching) return getSearchResults(options, searchQuery);
        return getRecommendations(options);
    }, [options, isSearching, searchQuery]);

    // --- Derived: Prediction Target ---
    const predictionTarget = useMemo(() => {
        if (userSelectedUid) return options.find(t => t.uid === userSelectedUid) || null;
        return baseOptions[0] || null;
    }, [baseOptions, userSelectedUid, options]);

    // 搜尋字串改變時，清空手動選取
    useEffect(() => {
        setUserSelectedUid(null);
    }, [searchQuery]);

    // --- Final Results (Phase 1: passthrough) ---
    const processedOptions = baseOptions;

    return {
        isAdvancedMode,
        setIsAdvancedMode,
        searchFilters,
        setSearchFilters,
        resetFilter,
        processedOptions,
        predictionTarget
    };
};
