
import React, { useState, useMemo } from 'react';
import { Users, MapPin, Hash, LayoutGrid, ChevronRight, ChevronDown, Palette, Calendar, Watch, Trophy, Activity } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { useInspectorTranslation } from './inspector/shared/InspectorCommon';

const CollapsibleSection = ({ icon, title, count, confidence, children }: { icon: React.ReactNode, title: string, count: number, confidence?: number, children?: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(true);
    const t = useInspectorTranslation();
    return (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/30">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                    <div className="flex items-center gap-1.5">
                        {icon}
                        <span className="text-xs font-bold text-slate-300">{title}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {confidence !== undefined && (
                        <span className="text-[9px] font-mono text-sky-400 bg-sky-900/20 px-1.5 py-0.5 rounded border border-sky-500/20 flex items-center gap-1" title={t('confidence_hint')}>
                            <Activity size={10} />
                            {confidence.toFixed(2)}
                        </span>
                    )}
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 rounded">{count}</span>
                </div>
            </button>
            {isOpen && (
                <div className="p-2 border-t border-slate-800 bg-black/20">
                    {children}
                </div>
            )}
        </div>
    );
};

const MetaFriendlyView = ({ meta }: { meta: any }) => {
    const t = useInspectorTranslation();

    // Weekday map from translations
    const getWeekdayName = (idx: number) => {
        const key = `day_${idx}` as any;
        return t(key);
    };

    // Helper to extract IDs from relation object safely
    const getRelIds = (key: string): string[] => {
        if (!meta || !meta.relations || !meta.relations[key]) return [];
        return meta.relations[key].map((r: any) => r.id);
    };

    // Prepare stable dependency strings for hooks to avoid infinite loops
    const playerIdsStr = JSON.stringify(getRelIds('players'));
    const locationIdsStr = JSON.stringify(getRelIds('locations'));
    const gameIdsStr = JSON.stringify(getRelIds('games'));

    // Targeted Queries
    const players = useLiveQuery(() => db.savedPlayers.where('id').anyOf(JSON.parse(playerIdsStr)).toArray(), [playerIdsStr]) || [];
    const locations = useLiveQuery(() => db.savedLocations.where('id').anyOf(JSON.parse(locationIdsStr)).toArray(), [locationIdsStr]) || [];
    const games = useLiveQuery(() => db.savedGames.where('id').anyOf(JSON.parse(gameIdsStr)).toArray(), [gameIdsStr]) || [];

    // Small dimension tables
    const weekdays = useLiveQuery(() => db.savedWeekdays.toArray()) || [];
    const timeSlots = useLiveQuery(() => db.savedTimeSlots.toArray()) || [];
    const playerCounts = useLiveQuery(() => db.savedPlayerCounts.toArray()) || [];
    const gameModes = useLiveQuery(() => db.savedGameModes.toArray()) || [];

    // Create Lookup Maps
    const lookups = useMemo(() => {
        const createMap = (list: SavedListItem[]) => new Map(list.map(i => [i.id, i]));
        return {
            players: createMap(players),
            locations: createMap(locations),
            games: createMap(games),
            weekdays: createMap(weekdays),
            timeSlots: createMap(timeSlots),
            playerCounts: createMap(playerCounts),
            gameModes: createMap(gameModes)
        };
    }, [players, locations, games, weekdays, timeSlots, playerCounts, gameModes]);

    if (!meta || !meta.relations) return <span className="text-slate-500 italic text-xs">{t('no_relations')}</span>;

    const renderCategory = (key: string, icon: React.ReactNode, title: string, resolveFn: (id: string, item: any) => React.ReactNode) => {
        const items = meta.relations[key];
        const confidence = meta.confidence ? meta.confidence[key] : undefined;

        if (!items || !Array.isArray(items) || items.length === 0) return null;

        // Filter valid items
        const validItems = items
            .map((r: any) => {
                if (key === 'colors') return { ...r, resolved: r.id };

                let lookupKey: keyof typeof lookups | null = null;
                if (key === 'players') lookupKey = 'players';
                else if (key === 'locations') lookupKey = 'locations';
                else if (key === 'games') lookupKey = 'games';
                else if (key === 'weekdays') lookupKey = 'weekdays';
                else if (key === 'timeSlots') lookupKey = 'timeSlots';
                else if (key === 'playerCounts') lookupKey = 'playerCounts';
                else if (key === 'gameModes') lookupKey = 'gameModes';

                if (lookupKey) {
                    const entity = lookups[lookupKey].get(r.id);
                    return { ...r, entity };
                }
                return r;
            })
            .filter(Boolean);

        if (validItems.length === 0) return null;

        return (
            <CollapsibleSection icon={icon} title={title} count={validItems.length} confidence={confidence}>
                <div className="space-y-1 pl-2">
                    {validItems.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0">
                            <div className="flex items-center gap-2 truncate pr-2">
                                {resolveFn(item.id, item)}
                            </div>
                            <span className="font-mono text-emerald-500 font-bold bg-emerald-900/20 px-1.5 rounded">{item.count}</span>
                        </div>
                    ))}
                </div>
            </CollapsibleSection>
        );
    };

    return (
        <div className="space-y-1">
            {renderCategory('players', <Users size={12} className="text-indigo-400" />, t('rel_players'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('locations', <MapPin size={12} className="text-rose-400" />, t('rel_locations'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('games', <LayoutGrid size={12} className="text-emerald-400" />, t('rel_games'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('playerCounts', <Hash size={12} className="text-orange-400" />, t('rel_player_counts'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id} {t('unit_player')}</span>
            ))}

            {renderCategory('gameModes', <Trophy size={12} className="text-yellow-400" />, t('rel_modes'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('colors', <Palette size={12} className="text-pink-400" />, t('rel_colors'), (id) => (
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: id === 'transparent' ? 'transparent' : id }}>
                        {id === 'transparent' && <div className="w-full h-full border border-slate-500 rounded-full" />}
                    </div>
                    <span className="text-slate-400">{id}</span>
                </div>
            ))}

            {renderCategory('weekdays', <Calendar size={12} className="text-sky-400" />, t('rel_weekdays'), (id, { entity }) => {
                const dayIdx = parseInt(entity?.name || '0', 10);
                return <span className="text-slate-300">{getWeekdayName(dayIdx)}</span>;
            })}

            {renderCategory('timeSlots', <Watch size={12} className="text-amber-400" />, t('rel_timeslots'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}
        </div>
    );
};

export default MetaFriendlyView;
