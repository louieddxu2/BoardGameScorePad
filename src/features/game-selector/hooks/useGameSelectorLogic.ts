import { useState, useEffect, useMemo } from 'react';
import { GameOption, SearchFilters } from '../types';
import { getSearchResults, getRecommendations, applySort, byYearPublished, filterOptionsByCriteria, byMatchScore } from '../utils/sortStrategies';

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
    setUserSelectedUid: (uid: string | null) => void,
    playerCount: number = 4
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
            playerFilter: 'none',
            rating: null,
            complexity: null,
            duration: null,
            smallTable: false,
            isParty: false,
            isFamily: false,
            isCoop: false
        };
    });

    useEffect(() => {
        localStorage.setItem('pref_search_filters', JSON.stringify(searchFilters));
    }, [searchFilters]);

    const resetFilter = (key: keyof SearchFilters) => {
        setSearchFilters(prev => {
            const isBooleanKey = ['smallTable', 'isParty', 'isFamily', 'isCoop'].includes(key);
            return {
                ...prev,
                [key]: isBooleanKey ? false : (key === 'playerFilter' ? 'none' : null)
            };
        });
    };


    const displayLimit = isAdvancedMode ? 20 : 5;

    // --- 三階段處理管線 (Three-Stage Data Pipeline) ---

    // 階段一：進階篩選 (Filter Pipeline)
    const filteredOptions = useMemo(() => {
        if (!isAdvancedMode) return options;
        return filterOptionsByCriteria(options, searchFilters, playerCount);
    }, [options, isAdvancedMode, searchFilters, playerCount]);

    // 階段二：情境分流與排序 (Scenario Split & Sort)
    const sortedOptions = useMemo(() => {
        if (isSearching) {
            // 情境 B（有關鍵字）：模糊搜尋 ＋ 動態數量限制
            return getSearchResults(filteredOptions, searchQuery, displayLimit);
        }

        if (isAdvancedMode) {
            // 情境 C（無關鍵字 ＋ 篩選開啟）：符合優先，未知居後，再按遊戲出版年份排序 (最新優先)
            return applySort(filteredOptions, byMatchScore(searchFilters, playerCount), byYearPublished);
        }

        // 情境 A（無關鍵字 ＋ 無篩選）：提取原有「智慧推薦」
        return getRecommendations(filteredOptions);
    }, [filteredOptions, isSearching, searchQuery, isAdvancedMode, displayLimit, searchFilters, playerCount]);

    // 階段三：動態數量輸出 (Dynamic Limit Output)
    const processedOptions = useMemo(() => {
        if (isSearching) {
            // 模糊搜尋內部已自行做過 limit 處理與 virtual 選項追加
            return sortedOptions;
        }
        if (isAdvancedMode) {
            // 限制輸出筆數為 20 筆
            return sortedOptions.slice(0, displayLimit);
        }
        // 智慧推薦內部已限制為最多 5 筆
        return sortedOptions;
    }, [sortedOptions, isSearching, isAdvancedMode, displayLimit]);

    // --- Derived: Prediction Target ---
    const predictionTarget = useMemo(() => {
        if (userSelectedUid) return options.find(t => t.uid === userSelectedUid) || null;
        return processedOptions[0] || null;
    }, [processedOptions, userSelectedUid, options]);

    // 搜尋字串改變時，清空手動選取
    useEffect(() => {
        setUserSelectedUid(null);
    }, [searchQuery]);

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
