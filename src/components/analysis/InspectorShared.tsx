
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Search, X, Database, ExternalLink, Star, Hash } from 'lucide-react';
import { inspectorTranslations, InspectorTranslationKey } from '../../i18n/inspector';
import { useCommonTranslation } from '../../i18n/common';
import MetaFriendlyView from './MetaFriendlyView';

// --- Helper Hook ---
export const useInspectorTranslation = () => {
    const { language } = useCommonTranslation();
    const t = (key: InspectorTranslationKey, params?: Record<string, any>) => {
        const dict = inspectorTranslations[language] || inspectorTranslations['zh-TW'];
        let text = dict[key] || key;

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };
    return t;
};

// --- Detail Panel ---
export const InspectorDetailPanel = ({ selectedItem, icon: Icon, isBGG = false }: { selectedItem: any, icon: any, isBGG?: boolean }) => {
    const t = useInspectorTranslation();

    // Fetch BGG Metadata if available
    const bggInfo = useLiveQuery(async () => {
        if (isBGG) return selectedItem;
        if (selectedItem?.bggId) {
            return await db.bggGames.get(selectedItem.bggId.toString());
        }
        return null;
    }, [selectedItem, isBGG]);

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-app-bg">
            {selectedItem ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface-border">
                        <div className="p-3 bg-brand-secondary/10 border border-brand-secondary/30 rounded-xl text-brand-secondary shadow-sm"><Icon size={24} /></div>
                        <div>
                            <h3 className="text-xl font-bold text-txt-title leading-tight">
                                {selectedItem.name || selectedItem.id}
                            </h3>
                            <p className="text-xs text-txt-muted font-mono mt-1">{selectedItem.id}</p>
                        </div>
                    </div>

                    {/* BGG Info Card */}
                    {bggInfo && (
                        <div className="bg-status-info/20 border border-status-info/20 rounded-xl p-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 shadow-inner">
                            <div className="w-full">
                                <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-bold text-status-info text-sm truncate">{bggInfo.name}</h4>
                                    <a
                                        href={`https://boardgamegeek.com/boardgame/${bggInfo.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-status-info hover:text-status-info/80 p-1 bg-status-info/10 rounded transition-colors"
                                        title="Open in BGG"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>

                                <div className="flex flex-wrap gap-x-3 text-xs text-txt-muted/70">
                                    {bggInfo.year && <span>{t('bgg_year')}: <span className="text-status-info">{bggInfo.year}</span></span>}
                                    {bggInfo.rank && <span>{t('bgg_rank')}: <span className="text-status-info">#{bggInfo.rank}</span></span>}
                                </div>

                                {bggInfo.complexity > 0 && (
                                    <div className="text-xs text-txt-muted/70 mt-0.5">
                                        {t('bgg_complexity')}: <span className="text-status-info">{Number(bggInfo.complexity).toFixed(2)} / 5</span>
                                    </div>
                                )}
                            </div>

                            <div className="text-xs text-txt-muted/70 space-y-1 pt-2 border-t border-status-info/20">
                                <div className="flex flex-wrap gap-x-4">
                                    {(bggInfo.minPlayers || bggInfo.maxPlayers) && (
                                        <div>{t('bgg_players')}: <span className="text-status-info">{bggInfo.minPlayers || 1}{bggInfo.maxPlayers ? `-${bggInfo.maxPlayers}` : ''}</span></div>
                                    )}
                                    {bggInfo.bestPlayers && bggInfo.bestPlayers.length > 0 && (
                                        <div><Star size={10} className="inline mb-0.5 mr-0.5 text-status-warning" fill="currentColor" />{t('bgg_best')}: <span className="text-status-success font-bold">{bggInfo.bestPlayers.join(', ')}</span> {t('unit_player')}</div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-x-4">
                                    {bggInfo.playingTime && (
                                        <div>{t('bgg_playing_time')}: <span className="text-status-info">{bggInfo.playingTime}{t('unit_minute')}</span></div>
                                    )}
                                    {bggInfo.minAge && (
                                        <div>{t('bgg_age')}: <span className="text-status-info">{bggInfo.minAge}+</span></div>
                                    )}
                                </div>

                                {bggInfo.designers && (
                                    <div className="truncate">{t('bgg_designers')}: <span className="text-status-info">{bggInfo.designers}</span></div>
                                )}

                                {bggInfo.altNames && bggInfo.altNames.length > 0 && (
                                    <div className="pt-1 mt-1 border-t border-status-info/10">
                                        <span className="block opacity-60 text-[10px] uppercase">{t('bgg_alt_names')}:</span>
                                        <div className="text-status-info flex flex-wrap gap-1 mt-0.5">
                                            {bggInfo.altNames.map((name: string) => (
                                                <span key={name} className="bg-status-info/10 px-1.5 py-0.5 rounded text-[10px] border border-status-info/20">{name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="font-mono text-[9px] opacity-40 mt-1 text-right">BGG ID: {bggInfo.id}</div>
                            </div>
                        </div>
                    )}

                    {!isBGG && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-app-bg-deep p-3 rounded-lg border border-surface-border">
                                <span className="text-[10px] text-txt-muted uppercase font-bold block mb-1">{t('usage_count')}</span>
                                <span className="text-lg font-mono text-brand-primary font-bold">{selectedItem.usageCount}</span>
                            </div>
                            <div className="bg-app-bg-deep p-3 rounded-lg border border-surface-border">
                                <span className="text-[10px] text-txt-muted uppercase font-bold block mb-1">{t('last_used')}</span>
                                <span className="text-sm font-mono text-txt-primary">{selectedItem.lastUsed > 0 ? new Date(selectedItem.lastUsed).toLocaleString() : '-'}</span>
                            </div>
                        </div>
                    )}

                    {!isBGG && (
                        <div className="space-y-2">
                            <div className="bg-app-bg-deep rounded-lg border border-surface-border overflow-hidden">
                                <div className="px-3 py-2 bg-surface-bg/50 border-b border-surface-border text-[10px] font-bold text-txt-muted uppercase flex justify-between items-center">
                                    <span>{t('relations_analysis')}</span>
                                    <span className="text-[9px] bg-surface-hover px-1.5 rounded text-txt-secondary">{t('filtered')}</span>
                                </div>
                                <div className="p-3">
                                    <MetaFriendlyView meta={selectedItem.meta} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-app-bg-deep rounded-lg border border-surface-border overflow-hidden">
                        <div className="px-3 py-2 bg-surface-bg/50 border-b border-surface-border text-[10px] font-bold text-txt-muted uppercase">{t('full_dump')}</div>
                        <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar">
                            <pre className="text-xs font-mono text-status-info/80 whitespace-pre-wrap break-all">
                                {JSON.stringify(selectedItem, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-txt-muted gap-3">
                    <div className="w-16 h-16 rounded-full bg-app-bg-deep flex items-center justify-center border-2 border-surface-border border-dashed">
                        <Database size={24} className="opacity-50" />
                    </div>
                    <span className="text-sm font-medium">{t('select_hint')}</span>
                </div>
            )}
        </div>
    );
};

// --- List Component ---
export const DataList = ({ title, table, icon: Icon, isBGG = false }: { title: string, table: any, icon: any, isBGG?: boolean }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const t = useInspectorTranslation();
    const { t: tCommon } = useCommonTranslation();

    // [Performance] DB-Level Pagination & Filtering
    const data = useLiveQuery(async () => {
        let collection = table.toCollection();

        // If searching, use JS filter inside DB traversal
        if (searchTerm.trim()) {
            const lower = searchTerm.trim().toLowerCase();
            collection = collection.filter((item: any) => {
                return (item.name && item.name.toLowerCase().includes(lower)) ||
                    (item.id && item.id.toString().toLowerCase().includes(lower)) ||
                    (item.bggId && String(item.bggId).includes(lower)) ||
                    (item.altNames && Array.isArray(item.altNames) && item.altNames.some((n: string) => n.toLowerCase().includes(lower)));
            });
        }

        // Limit is essential
        return await collection.limit(50).toArray();
    }, [searchTerm, table]);

    if (!data) return <div className="p-4 text-txt-muted">{tCommon('loading')}</div>;

    const selectedItem = data.find((i: any) => i.id === selectedId);

    return (
        <div className="flex flex-1 min-h-0">
            {/* Left: List */}
            <div className="w-1/3 border-r border-surface-border overflow-y-auto no-scrollbar bg-app-bg-deep/50">
                <div className="p-2 sticky top-0 bg-app-bg border-b border-surface-border z-10 backdrop-blur-sm bg-opacity-95">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-txt-secondary flex items-center gap-1">
                            <Icon size={12} /> {title} ({t('list_display_prefix')}{data.length}{t('list_display_suffix')})
                        </span>
                    </div>
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('input_search_placeholder')}
                            className="w-full bg-app-bg-deep border border-surface-border rounded-lg pl-7 pr-6 py-1 text-xs text-txt-primary focus:border-brand-primary outline-none"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary p-1">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-2 space-y-1">
                    {data.map((item: any) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex justify-between items-center ${selectedId === item.id ? 'bg-brand-primary text-white shadow-md' : 'bg-surface-bg text-txt-secondary hover:bg-surface-hover hover:text-txt-primary'}`}
                        >
                            <div className="flex flex-col min-w-0">
                                <span className="truncate font-bold">{item.name || item.id}</span>
                                {/* Visual hint for BGG link */}
                                {!isBGG && item.bggId && (
                                    <span className="text-[9px] text-brand-secondary/80 font-mono leading-none mt-0.5 flex items-center gap-0.5">
                                        <Hash size={8} /> BGG
                                    </span>
                                )}
                                {isBGG && (
                                    <span className="text-[9px] text-txt-muted font-mono leading-none mt-0.5">
                                        ID: {item.id}
                                    </span>
                                )}
                            </div>
                            {!isBGG && <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedId === item.id ? 'bg-brand-secondary text-white' : 'bg-surface-bg text-txt-muted'}`}>{item.usageCount || 0}</span>}
                        </button>
                    ))}
                    {data.length === 0 && (
                        <div className="text-center py-8 text-xs text-txt-muted italic">
                            {t('no_data_category')}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Inspector */}
            <InspectorDetailPanel selectedItem={selectedItem} icon={Icon} isBGG={isBGG} />
        </div>
    );
};
