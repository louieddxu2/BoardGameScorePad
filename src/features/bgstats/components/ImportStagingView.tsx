
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ImportAnalysisReport, ImportManualLinks } from '../types';
import { LayoutGrid, Users, MapPin, ArrowRight, AlertTriangle, CheckCircle, Database, FileJson, Search, X } from 'lucide-react';
import { useImportLinking } from '../hooks/useImportLinking';
import { LinkerList, LinkerItemProps } from './LinkerList';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';

interface ImportStagingViewProps {
    report: ImportAnalysisReport;
    onConfirm: (links: ImportManualLinks) => void;
    onCancel: () => void;
    isProcessing: boolean;
}

const ImportStagingView: React.FC<ImportStagingViewProps> = ({ report, onConfirm, onCancel, isProcessing }) => {
    const { t } = useIntegrationTranslation();
    const { t: tCommon } = useCommonTranslation();

    // [Logic] Determine available tabs
    const tabs = useMemo(() => {
        const allTabs = [
            { id: 'games', label: tCommon('game'), icon: LayoutGrid, data: report.games },
            { id: 'players', label: tCommon('player'), icon: Users, data: report.players },
            { id: 'locations', label: tCommon('location'), icon: MapPin, data: report.locations },
        ];

        return allTabs.filter(t => {
            const hasLocal = t.data.localUnmatched.length > 0;
            const hasImport = t.data.importUnmatched.length > 0;
            const hasMatched = t.data.matchedCount > 0;
            return hasLocal || hasImport || hasMatched;
        });
    }, [report]);

    const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'games');

    useEffect(() => {
        if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Separate hooks per category
    const gameLinking = useImportLinking({ categoryData: report.games, categoryType: 'game' });
    const playerLinking = useImportLinking({ categoryData: report.players, categoryType: 'player' });
    const locationLinking = useImportLinking({ categoryData: report.locations, categoryType: 'location' });

    const activeHook = activeTab === 'games' ? gameLinking
        : activeTab === 'players' ? playerLinking
            : locationLinking;

    const currentData = activeTab === 'games' ? report.games
        : activeTab === 'players' ? report.players
            : report.locations;

    // --- Derived Data: Reverse Lookup for Linked Names ---
    // We need to know: Local ID -> Imported Name (if linked)
    const localToImportNameMap = useMemo(() => {
        const map = new Map<string, string>();

        // Iterate over links to build the reverse map
        activeHook.links.forEach((link, importId) => {
            // Find the import item name
            const importItem = currentData.importUnmatched.find(i => i.id === importId);
            if (importItem) {
                map.set(link.targetId, importItem.name);
            }
        });
        return map;
    }, [activeHook.links, currentData.importUnmatched]);

    // --- Scroll Logic ---
    useEffect(() => {
        if (activeHook.lastLinkedLocalId) {
            const targetElement = document.getElementById(`linker-item-${activeHook.lastLinkedLocalId}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [activeHook.lastLinkedLocalId]);

    // --- Prepare List Data ---

    // LEFT: Local List (Target)
    const localListItems: LinkerItemProps[] = currentData.localUnmatched.map(item => ({
        id: item.id,
        name: item.name,
        subTitle: item.bggId ? `BGG: ${item.bggId}` : undefined,
        isSelected: activeHook.selectedLocalId === item.id,
        isLinked: localToImportNameMap.has(item.id),
        linkedName: localToImportNameMap.get(item.id)
    }));

    // RIGHT: Import List (Source)
    const importListItems: LinkerItemProps[] = activeHook.displayedImportItems.map(item => {
        // Highlight if it matches the CURRENT selected Local Item's link
        const isActuallyLinked = item.id === activeHook.activeLinkedImportId;

        // Highlight as Suggested if it matches search AND isn't the one already linked
        const isSuggested = activeHook.suggestedMatchId === item.id && !isActuallyLinked;

        return {
            id: item.id,
            name: item.name,
            subTitle: (item as any).bggId ? `BGG: ${(item as any).bggId}` : undefined,
            isLinked: isActuallyLinked,
            isSuggested: isSuggested,
        };
    });

    const handleConfirmClick = () => {
        onConfirm({
            games: gameLinking.links,
            players: playerLinking.links,
            locations: locationLinking.links
        });
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">

            {/* Header Summary */}
            <div className="flex-none p-4 border-b border-slate-800 bg-slate-800/50">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold">{t('staging_analysis_done')}</h3>
                        <p className="text-xs text-slate-400">
                            {t('staging_summary', {
                                games: report.games.matchedCount,
                                players: report.players.matchedCount,
                                locations: report.locations.matchedCount
                            })}
                        </p>
                    </div>
                </div>
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-200 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{t('staging_hint')}</span>
                </div>
            </div>

            {/* Tabs */}
            {tabs.length > 1 && (
                <div className="flex-none flex border-b border-slate-800">
                    {tabs.map(tab => {
                        // Count represents LOCAL items to process
                        const count = tab.data.localUnmatched.length;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-3 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <Icon size={14} /> {tab.label}
                                </div>
                                {count > 0 && <span className="text-[9px] bg-slate-700 px-1.5 rounded-full">{t('staging_pending', { count })}</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Content (Two Columns) */}
            <div className="flex-1 flex min-h-0">
                {/* Left: Local Unmatched (Target) */}
                <div className="flex-1 border-r border-slate-800 flex flex-col min-w-0 bg-slate-900/50">
                    <LinkerList
                        items={localListItems}
                        title={<><Database size={12} /> {t('staging_local_db', { count: localListItems.length })}</>}
                        onItemClick={activeHook.handleLocalSelect}
                    />
                </div>

                {/* Right: Import Unmatched (Source) */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-slate-800 flex-none">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={activeHook.manualSearchQuery}
                                onChange={(e) => activeHook.setManualSearchQuery(e.target.value)}
                                placeholder={t('staging_search_placeholder')}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                            />
                            {activeHook.manualSearchQuery && (
                                <button onClick={() => activeHook.setManualSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0">
                        <LinkerList
                            items={importListItems}
                            title={<><FileJson size={12} /> {t('staging_import_data', { count: activeHook.totalImportCount })}</>}
                            onItemClick={(id) => {
                                activeHook.handleImportSelect(Number(id));
                                if (searchInputRef.current) searchInputRef.current.blur();
                            }}
                            emptyMessage={activeHook.manualSearchQuery ? t('staging_no_results') : t('staging_empty_hint')}
                        />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex-none p-4 border-t border-slate-800 bg-slate-800 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 text-sm font-bold transition-colors"
                >
                    {tCommon('cancel')}
                </button>
                <button
                    onClick={handleConfirmClick}
                    disabled={isProcessing}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {t('staging_btn_confirm')} <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default ImportStagingView;
