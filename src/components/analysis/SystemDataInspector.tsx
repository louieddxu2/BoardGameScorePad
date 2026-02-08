import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Users, MapPin, Clock, Hash, LayoutGrid, ChevronRight, ChevronDown, Palette, Calendar, Watch, RefreshCw, Loader2, Trash2, AlertTriangle, Image as ImageIcon, HardDrive, Table as TableIcon, Skull, ExternalLink, Search, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import Dexie from 'dexie'; 
import { SavedListItem, LocalImage } from '../../types';
import { useTranslation } from '../../i18n';
import { inspectorTranslations, InspectorTranslationKey } from '../../i18n/inspector';
import { relationshipService } from '../../services/relationshipService'; 
import { useToast } from '../../hooks/useToast'; 
import ConfirmationModal from '../shared/ConfirmationModal'; 

// --- Helpers for formatting ---
const WEEKDAY_MAP = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

// Helper to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Helper hook for local translations
const useInspectorTranslation = () => {
    const { language } = useTranslation();
    const t = (key: InspectorTranslationKey) => {
        const dict = inspectorTranslations[language] || inspectorTranslations['zh-TW'];
        return dict[key] || key;
    };
    return t;
};

const CollapsibleSection = ({ icon, title, count, children }: { icon: React.ReactNode, title: string, count: number, children?: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/30">
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex items-center justify-between p-2 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
                    <div className="flex items-center gap-1.5">
                        {icon}
                        <span className="text-xs font-bold text-slate-300">{title}</span>
                    </div>
                </div>
                <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 rounded">{count}</span>
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

    // Fetch all reference data to resolve IDs
    const players = useLiveQuery(() => db.savedPlayers.toArray()) || [];
    const locations = useLiveQuery(() => db.savedLocations.toArray()) || [];
    const games = useLiveQuery(() => db.savedGames.toArray()) || [];
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
        if (!items || !Array.isArray(items) || items.length === 0) return null;

        // Filter valid items (ensure referencing object exists) and Sort by count
        const validItems = items
            .map((r: any) => {
                // Special case for colors: ID is the value, so it always "exists"
                if (key === 'colors') return { ...r, resolved: r.id };
                
                // For DB entities, check existence in Map
                // Key mapping: relations key -> lookup key
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
                    return entity ? { ...r, entity } : null;
                }
                return r; // Fallback for unknown categories
            })
            .filter(Boolean); // Remove nulls (deleted items)

        if (validItems.length === 0) return null;

        return (
            <CollapsibleSection icon={icon} title={title} count={validItems.length}>
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
            {renderCategory('players', <Users size={12} className="text-indigo-400"/>, t('rel_players'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}
            
            {renderCategory('locations', <MapPin size={12} className="text-rose-400"/>, t('rel_locations'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('games', <LayoutGrid size={12} className="text-emerald-400"/>, t('rel_games'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('playerCounts', <Hash size={12} className="text-orange-400"/>, t('rel_player_counts'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id} 人</span>
            ))}

            {renderCategory('gameModes', <Trophy size={12} className="text-yellow-400"/>, t('rel_modes'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}

            {renderCategory('colors', <Palette size={12} className="text-pink-400"/>, t('rel_colors'), (id) => (
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: id === 'transparent' ? 'transparent' : id }}>
                        {id === 'transparent' && <div className="w-full h-full border border-slate-500 rounded-full" />}
                    </div>
                    <span className="text-slate-400">{id}</span>
                </div>
            ))}

            {renderCategory('weekdays', <Calendar size={12} className="text-sky-400"/>, t('rel_weekdays'), (id, { entity }) => {
                const dayIdx = parseInt(entity?.name || '0', 10);
                return <span className="text-slate-300">{WEEKDAY_MAP[dayIdx] || entity?.name}</span>;
            })}

            {renderCategory('timeSlots', <Watch size={12} className="text-amber-400"/>, t('rel_timeslots'), (id, { entity }) => (
                <span className="text-slate-300">{entity?.name || id}</span>
            ))}
        </div>
    );
};

// Reusable Detail Panel
const InspectorDetailPanel = ({ selectedItem, icon: Icon, isBGG = false }: { selectedItem: any, icon: any, isBGG?: boolean }) => {
    const t = useInspectorTranslation();

    // Fetch BGG Metadata if available (If this IS a BGG item, it already IS the metadata)
    const bggInfo = useLiveQuery(async () => {
        if (isBGG) return selectedItem; // Direct display
        if (selectedItem?.bggId) {
            return await db.bggGames.get(selectedItem.bggId.toString());
        }
        return null;
    }, [selectedItem, isBGG]);

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            {selectedItem ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shadow-sm"><Icon size={24}/></div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">
                                {/* Special formatting for Weekdays */}
                                {selectedItem.id && selectedItem.id.startsWith('weekday_') 
                                    ? WEEKDAY_MAP[parseInt(selectedItem.name)] || selectedItem.name
                                    : selectedItem.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono mt-1">{selectedItem.id}</p>
                        </div>
                    </div>

                    {/* BGG Info Card */}
                    {bggInfo && (
                        <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 flex gap-4 animate-in fade-in slide-in-from-top-2 shadow-inner">
                            <div className="w-16 h-16 shrink-0 bg-black/20 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                                {bggInfo.thumbnailUrl ? (
                                    <img src={bggInfo.thumbnailUrl} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-indigo-800">
                                        <ImageIcon size={24} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                    <h4 className="font-bold text-indigo-200 text-sm truncate">{bggInfo.name}</h4>
                                    <a 
                                        href={`https://boardgamegeek.com/boardgame/${bggInfo.id}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-indigo-400 hover:text-indigo-300 p-1 bg-indigo-500/10 rounded transition-colors"
                                        title="Open in BGG"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                                <div className="text-xs text-indigo-300/70 mt-1 space-y-0.5">
                                    {bggInfo.year && <div>年份: <span className="text-indigo-200">{bggInfo.year}</span></div>}
                                    
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {(bggInfo.minPlayers || bggInfo.maxPlayers) && (
                                            <div>人數: <span className="text-indigo-200">{bggInfo.minPlayers || 1}{bggInfo.maxPlayers ? `-${bggInfo.maxPlayers}` : ''}</span></div>
                                        )}
                                        {bggInfo.playingTime && (
                                            <div>時間: <span className="text-indigo-200">{bggInfo.playingTime}m</span></div>
                                        )}
                                        {bggInfo.minAge && (
                                            <div>年齡: <span className="text-indigo-200">{bggInfo.minAge}+</span></div>
                                        )}
                                    </div>
                                    
                                    {bggInfo.designers && <div className="truncate">設計師: <span className="text-indigo-200">{bggInfo.designers}</span></div>}
                                    <div className="font-mono text-[9px] opacity-40 mt-1">BGG ID: {bggInfo.id}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isBGG && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{t('usage_count')}</span>
                                <span className="text-lg font-mono text-emerald-400 font-bold">{selectedItem.usageCount}</span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{t('last_used')}</span>
                                <span className="text-sm font-mono text-slate-300">{selectedItem.lastUsed > 0 ? new Date(selectedItem.lastUsed).toLocaleString() : '-'}</span>
                            </div>
                        </div>
                    )}

                    {!isBGG && (
                        <div className="space-y-2">
                            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center">
                                    <span>{t('relations_analysis')}</span>
                                    <span className="text-[9px] bg-slate-700 px-1.5 rounded text-slate-300">{t('filtered')}</span>
                                </div>
                                <div className="p-3">
                                    <MetaFriendlyView meta={selectedItem.meta} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                        <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase">{t('full_dump')}</div>
                        <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar">
                            <pre className="text-xs font-mono text-sky-400/80 whitespace-pre-wrap break-all">
                                {JSON.stringify(selectedItem, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-800 border-dashed">
                        <Database size={24} className="opacity-50" />
                    </div>
                    <span className="text-sm font-medium">{t('select_hint')}</span>
                </div>
            )}
        </div>
    );
};

const DataList = ({ title, table, icon: Icon, isBGG = false }: { title: string, table: any, icon: any, isBGG?: boolean }) => {
  const data = useLiveQuery(() => table.toArray());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const t = useInspectorTranslation();

  const filteredData = useMemo(() => {
      if (!data) return [];
      if (!searchTerm.trim()) return data;
      
      const lower = searchTerm.toLowerCase();
      return data.filter((item: any) => 
          (item.name && item.name.toLowerCase().includes(lower)) ||
          (item.id && item.id.toLowerCase().includes(lower)) ||
          (item.bggId && String(item.bggId).includes(lower))
      );
  }, [data, searchTerm]);

  if (!data) return <div className="p-4 text-slate-500">{t('loading')}</div>;

  const selectedItem = data.find((i: any) => i.id === selectedId);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: List */}
      <div className="w-1/3 border-r border-slate-700 overflow-y-auto no-scrollbar bg-slate-900/50">
        <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 backdrop-blur-sm bg-opacity-95">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Icon size={12} /> {title} ({filteredData.length})
                </span>
            </div>
            <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-6 py-1 text-xs text-white focus:border-emerald-500 outline-none"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1">
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
        <div className="p-2 space-y-1">
            {filteredData.map((item: any) => (
            <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all flex justify-between items-center ${selectedId === item.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'}`}
            >
                <div className="flex flex-col min-w-0">
                    <span className="truncate font-bold">{item.name || item.id}</span>
                    {/* Visual hint for BGG link */}
                    {!isBGG && item.bggId && (
                        <span className="text-[9px] text-indigo-300/80 font-mono leading-none mt-0.5 flex items-center gap-0.5">
                            <Hash size={8} /> BGG
                        </span>
                    )}
                    {isBGG && (
                        <span className="text-[9px] text-slate-500 font-mono leading-none mt-0.5">
                            ID: {item.id}
                        </span>
                    )}
                </div>
                {!isBGG && <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedId === item.id ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-700 text-slate-500'}`}>{item.usageCount || 0}</span>}
            </button>
            ))}
            {filteredData.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-600 italic">
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

// Specialized Time Inspector with Split Left Pane
const TimeInspector = () => {
    const weekdays = useLiveQuery(() => db.savedWeekdays.toArray()) || [];
    const timeSlots = useLiveQuery(() => db.savedTimeSlots.toArray()) || [];
    const t = useInspectorTranslation();
    
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const selectedItem = useMemo(() => {
        return weekdays.find(i => i.id === selectedId) || timeSlots.find(i => i.id === selectedId);
    }, [selectedId, weekdays, timeSlots]);

    const SelectedIcon = selectedItem ? (selectedItem.id.startsWith('weekday') ? Calendar : Watch) : Clock;

    const renderListItem = (item: any, label: string, icon: any) => {
        const isSelected = selectedId === item.id;
        return (
            <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all flex justify-between items-center ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'}`}
            >
                <span className="truncate font-bold flex items-center gap-1.5">
                    {label}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-700 text-slate-500'}`}>{item.usageCount || 0}</span>
            </button>
        );
    };

    return (
        <div className="flex flex-1 min-h-0">
            {/* Left Sidebar (Split Top/Bottom) */}
            <div className="w-1/3 border-r border-slate-700 flex flex-col bg-slate-900/50">
                <div className="flex-1 overflow-y-auto no-scrollbar border-b border-slate-700 flex flex-col min-h-0">
                    <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 flex justify-between items-center backdrop-blur-sm bg-opacity-90">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Calendar size={12} /> {t('list_weekdays')}
                        </span>
                    </div>
                    <div className="p-2 space-y-1">
                        {weekdays.map(w => renderListItem(w, WEEKDAY_MAP[parseInt(w.name)] || w.name, Calendar))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
                    <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 flex justify-between items-center backdrop-blur-sm bg-opacity-90">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Watch size={12} /> {t('list_timeslots')}
                        </span>
                    </div>
                    <div className="p-2 space-y-1">
                        {timeSlots.map(t => renderListItem(t, t.name, Watch))}
                    </div>
                </div>
            </div>
            <InspectorDetailPanel selectedItem={selectedItem} icon={SelectedIcon} />
        </div>
    );
}

// [New] Image Inspector Tab
const ImageInspector = () => {
    const images = useLiveQuery(() => db.images.toArray()) || [];
    const t = useInspectorTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const totalSize = useMemo(() => images.reduce((acc, img) => acc + (img.blob?.size || 0), 0), [images]);
    const selectedImage = images.find(img => img.id === selectedId);

    const filteredImages = useMemo(() => {
        if (!searchTerm.trim()) return images;
        const lower = searchTerm.toLowerCase();
        return images.filter(img => 
            img.id.toLowerCase().includes(lower) || 
            img.relatedId.toLowerCase().includes(lower)
        );
    }, [images, searchTerm]);

    useEffect(() => {
        if (selectedImage) {
            const url = URL.createObjectURL(selectedImage.blob);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [selectedImage]);

    return (
        <div className="flex flex-1 min-h-0">
            {/* Left: Image List */}
            <div className="w-1/3 border-r border-slate-700 overflow-y-auto no-scrollbar bg-slate-900/50">
                <div className="p-3 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 backdrop-blur-sm bg-opacity-95">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <ImageIcon size={12} /> {t('list_images')}
                        </span>
                        <span className="text-xs font-bold text-white bg-slate-700 px-2 py-0.5 rounded-full">{filteredImages.length}</span>
                    </div>
                    <div className="relative mb-2">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="搜尋 ID..." 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-6 py-1 text-xs text-white focus:border-emerald-500 outline-none"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                        {t('img_total_size')}: <span className="text-emerald-400 font-bold">{formatBytes(totalSize)}</span>
                    </div>
                </div>
                <div className="p-2 space-y-1">
                    {filteredImages.map((img: LocalImage) => (
                        <button
                            key={img.id}
                            onClick={() => setSelectedId(img.id)}
                            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex flex-col gap-1 ${selectedId === img.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <div className="flex justify-between w-full">
                                <span className="font-mono truncate w-24 text-[10px] opacity-70">{img.id.substring(0,8)}...</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selectedId === img.id ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-900 text-slate-400'}`}>
                                    {formatBytes(img.blob.size)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80">
                                <span className={`w-2 h-2 rounded-full ${img.relatedType === 'template' ? 'bg-sky-400' : 'bg-yellow-400'}`} />
                                <span>{img.relatedType === 'template' ? t('img_type_template') : t('img_type_session')}</span>
                            </div>
                        </button>
                    ))}
                    {filteredImages.length === 0 && (
                        <div className="text-center py-8 text-xs text-slate-600 italic">
                            {t('no_data_category')}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Preview */}
            <div className="flex-1 bg-slate-950 p-4 flex flex-col items-center justify-center overflow-hidden">
                {selectedImage ? (
                    <div className="flex flex-col items-center gap-4 w-full h-full">
                        <div className="relative flex-1 w-full min-h-0 rounded-xl overflow-hidden border border-slate-800 bg-black/50 flex items-center justify-center">
                            {previewUrl && <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Preview" />}
                        </div>
                        <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block mb-1">ID</span>
                                <span className="text-white font-mono break-all">{selectedImage.id}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Size</span>
                                <span className="text-emerald-400 font-bold">{formatBytes(selectedImage.blob.size)}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Related ID</span>
                                <span className="text-indigo-300 font-mono break-all">{selectedImage.relatedId}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Type</span>
                                <span className="text-white capitalize">{selectedImage.relatedType}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-3">
                        <HardDrive size={48} className="opacity-20" />
                        <span>{t('select_hint')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// [New] Database Overview Inspector
interface TableStats {
    name: string;
    count: number;
    size: number;
}

const DatabaseInspector = ({ onRequestFactoryReset }: { onRequestFactoryReset: () => void }) => {
    const [stats, setStats] = useState<TableStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useInspectorTranslation();

    const calculateObjectSize = (obj: any): number => {
        if (!obj) return 0;
        // For LocalImage records, count the blob size explicitly
        if (obj.blob instanceof Blob) {
            return obj.blob.size;
        }
        // Fallback: estimate using JSON string length * 2 (UTF-16)
        try {
            const str = JSON.stringify(obj);
            return str ? str.length * 2 : 0;
        } catch (e) {
            return 0;
        }
    };

    useEffect(() => {
        const analyzeDB = async () => {
            setIsLoading(true);
            try {
                const tables = (db as any).tables;
                const results: TableStats[] = [];

                for (const table of tables) {
                    const count = await table.count();
                    let size = 0;
                    
                    // Optimization: For 'images', we don't want to JSON stringify everything.
                    // We iterate and check .size directly.
                    // For other tables, iteration is fine for small-medium DBs.
                    await table.each((item: any) => {
                        size += calculateObjectSize(item);
                    });

                    results.push({ name: table.name, count, size });
                }
                
                // Sort by Size (Desc)
                results.sort((a, b) => b.size - a.size);
                setStats(results);
            } catch (e) {
                console.error("Failed to analyze DB", e);
            } finally {
                setIsLoading(false);
            }
        };
        analyzeDB();
    }, []);

    const totalSize = stats.reduce((acc, curr) => acc + curr.size, 0);

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Summary Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                        <HardDrive size={32} className="text-emerald-500" />
                    </div>
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t('db_total_size')}</span>
                    <h2 className="text-4xl font-black text-white">{isLoading ? '...' : formatBytes(totalSize)}</h2>
                </div>

                {/* Table List */}
                <div className="space-y-3">
                    <h3 className="text-slate-400 text-xs font-bold uppercase px-2">{t('list_db_tables')}</h3>
                    
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                            <Loader2 size={16} className="animate-spin" /> {t('loading')}
                        </div>
                    ) : (
                        stats.map((stat) => (
                            <div key={stat.name} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-slate-200">{stat.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{stat.count} {t('db_row_count')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono font-bold text-emerald-400">{formatBytes(stat.size)}</div>
                                    <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-600 rounded-full" 
                                            style={{ width: `${totalSize > 0 ? (stat.size / totalSize) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <p className="text-[10px] text-slate-600 text-center pt-4">
                    {t('db_calc_note')}
                </p>

                {/* Factory Reset Section */}
                <div className="pt-8 border-t border-slate-800">
                    <button 
                        onClick={onRequestFactoryReset}
                        className="w-full py-4 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded-xl border border-red-900/30 flex items-center justify-center gap-2 transition-all active:scale-95 group"
                    >
                        <Skull size={20} className="group-hover:animate-pulse" />
                        {t('btn_factory_reset')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SystemDataInspector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'games' | 'players' | 'locations' | 'time' | 'counts' | 'modes' | 'images' | 'bgg' | 'db'>('games');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'reprocess' | 'factory_reset' | null>(null); 
  
  const t = useInspectorTranslation();
  const { showToast } = useToast();

  const handleConfirmAction = async () => {
      if (confirmAction === 'reset') {
          await executeResetStats();
      } else if (confirmAction === 'reprocess') {
          await executeReprocessHistory();
      } else if (confirmAction === 'factory_reset') {
          await executeFactoryReset();
      }
      setConfirmAction(null);
  };

  const executeResetStats = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          await (db as any).transaction('rw', db.savedPlayers, db.savedLocations, db.savedGames, db.savedWeekdays, db.savedTimeSlots, db.savedPlayerCounts, db.savedGameModes, db.analyticsLogs, async () => {
              // 1. Clear Logs
              await db.analyticsLogs.clear();

              // 2. Clear All Saved Lists (Wipe Everything)
              await db.savedPlayers.clear();
              await db.savedLocations.clear();
              await db.savedGames.clear();
              await db.savedWeekdays.clear();
              await db.savedTimeSlots.clear();
              await db.savedPlayerCounts.clear();
              await db.savedGameModes.clear();
          });
          
          showToast({ message: "統計資料庫已清空 (請點擊右方按鈕重新掃描)", type: 'success' });
      } catch (error) {
          console.error("Reset failed", error);
          showToast({ message: "重置失敗", type: 'error' });
      } finally {
          setIsProcessing(false);
      }
  };

  const executeReprocessHistory = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          // 1. Fetch all history sorted by time (oldest first)
          const allHistory = await db.history.orderBy('endTime').toArray();
          
          let count = 0;
          
          // 2. Sequential processing to preserve logical order
          for (const record of allHistory) {
              await relationshipService.processGameEnd(record);
              count++;
          }
          
          showToast({ message: `已成功掃描 ${count} 筆紀錄`, type: 'success' });
      } catch (error) {
          console.error("Reprocess failed", error);
          showToast({ message: "掃描過程發生錯誤", type: 'error' });
      } finally {
          setIsProcessing(false);
      }
  };

  const executeFactoryReset = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          // [Fix] Close connection first to prevent hook updates from crashing UI
          (db as any).close();
          
          // 2. Delete the entire database
          await Dexie.delete('BoardGameScorePadDB');
          
          // 3. Clear local storage
          localStorage.clear();

          // 4. Reload to re-initialize
          window.location.reload();
      } catch (error) {
          console.error("Factory Reset failed", error);
          // Force reload anyway if something went wrong, as state is likely corrupted
          window.location.reload();
      }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      
      {/* --- Confirmation Modal --- */}
      <ConfirmationModal 
          isOpen={!!confirmAction}
          title={
              confirmAction === 'factory_reset' ? t('confirm_factory_reset_title') : 
              confirmAction === 'reset' ? t('confirm_reset_title') : 
              t('confirm_reprocess_title')
          }
          message={
              confirmAction === 'factory_reset' ? t('confirm_factory_reset_msg') :
              confirmAction === 'reset' ? t('confirm_reset_msg') : 
              t('confirm_reprocess_msg')
          }
          confirmText={
              confirmAction === 'factory_reset' ? t('btn_factory_reset') :
              confirmAction === 'reset' ? t('btn_reset') : 
              t('btn_reprocess')
          }
          isDangerous={confirmAction === 'reset' || confirmAction === 'factory_reset'}
          zIndexClass="z-[110]"
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
      />

      {/* Header */}
      <div className="flex-none bg-slate-900 p-3 border-b border-slate-800 flex justify-between items-center shadow-md z-20">
        <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                <Database size={18} className="text-emerald-500" />
            </div>
            <div>
                <h3 className="font-bold text-white leading-tight">{t('title')}</h3>
                <span className="text-[10px] text-slate-500 block">{t('subtitle')}</span>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setConfirmAction('reset')} // [Updated] Open custom modal
                disabled={isProcessing}
                className="p-2 hover:bg-slate-800 rounded-lg text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                title="清空資料庫 (刪除所有列表與關聯)"
            >
                <Trash2 size={20} />
            </button>
            <button 
                onClick={() => setConfirmAction('reprocess')} // [Updated] Open custom modal
                disabled={isProcessing}
                className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                title="重新掃描並匯入歷史紀錄"
            >
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X size={20} />
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none bg-slate-900 border-b border-slate-800 flex px-2 overflow-x-auto no-scrollbar">
        {[
            { id: 'games', label: t('tab_games'), icon: LayoutGrid },
            { id: 'players', label: t('tab_players'), icon: Users },
            { id: 'locations', label: t('tab_locations'), icon: MapPin },
            { id: 'time', label: t('tab_time'), icon: Clock },
            { id: 'counts', label: t('tab_counts'), icon: Hash },
            { id: 'modes', label: t('tab_modes'), icon: Trophy }, // New
            { id: 'images', label: t('tab_images'), icon: ImageIcon },
            { id: 'bgg', label: t('tab_bgg'), icon: Database }, 
            { id: 'db', label: t('tab_db'), icon: HardDrive },
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
            >
                <tab.icon size={14} />
                {tab.label}
            </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col bg-black relative">
        {activeTab === 'games' && <DataList title={t('list_games')} table={db.savedGames} icon={LayoutGrid} />}
        {activeTab === 'players' && <DataList title={t('list_players')} table={db.savedPlayers} icon={Users} />}
        {activeTab === 'locations' && <DataList title={t('list_locations')} table={db.savedLocations} icon={MapPin} />}
        {activeTab === 'time' && <TimeInspector />}
        {activeTab === 'counts' && <DataList title={t('list_counts')} table={db.savedPlayerCounts} icon={Hash} />}
        {activeTab === 'modes' && <DataList title={t('list_modes')} table={db.savedGameModes} icon={Trophy} />}
        {activeTab === 'images' && <ImageInspector />}
        {activeTab === 'bgg' && <DataList title={t('list_bgg')} table={db.bggGames} icon={Database} isBGG={true} />}
        {activeTab === 'db' && <DatabaseInspector onRequestFactoryReset={() => setConfirmAction('factory_reset')} />}
      </div>
    </div>,
    document.body
  );
};

export default SystemDataInspector;