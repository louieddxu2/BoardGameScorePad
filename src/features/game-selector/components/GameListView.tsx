import React from 'react';
import { ChevronUp, Search, FileJson, Database, Cloud } from 'lucide-react';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCloudLibraryTranslation } from '../../../i18n/cloud_library';
import { GameOption, SearchFilters } from '../types';
import { GameOptionItem } from './GameOptionItem';

export interface GameListViewProps {
    processedOptions: GameOption[];
    scrollableItems: GameOption[];
    dockedItem: GameOption | null;
    playerCount: number;
    searchFilters: SearchFilters;
    isAdvancedMode: boolean;
    showImportHint: boolean;
    
    // Handlers
    onOptionClick: (t: GameOption) => void;
    onPin: (t: GameOption) => void;
    onOpenBgStats?: () => void;
    onOpenBggImport?: () => void;
}

const BOTTOM_ROW_HEIGHT_CLASS = "h-[60px]";

export const GameListView: React.FC<GameListViewProps> = ({
    processedOptions,
    scrollableItems,
    dockedItem,
    playerCount,
    searchFilters,
    isAdvancedMode,
    showImportHint,
    onOptionClick,
    onPin,
    onOpenBgStats,
    onOpenBggImport
}) => {
    const { t } = useIntegrationTranslation();
    const { t: tCloudLib } = useCloudLibraryTranslation();

    return (
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
                            <div className="flex flex-wrap justify-center gap-2 max-w-[90%]">
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
                                onClick={onOptionClick}
                                onPin={onPin}
                            />
                        ))}
                        {showImportHint && onOpenBgStats && onOpenBggImport && (
                            <div className="shrink-0 px-3 py-2 mb-1 flex items-center gap-1.5 flex-wrap text-[11px] text-txt-muted animate-in fade-in duration-300">
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
                                onClick={onOptionClick}
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
    );
};
