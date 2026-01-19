
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Users, MapPin, Clock, Hash, LayoutGrid, ChevronRight, ChevronDown, Palette, Calendar, Watch, RefreshCw, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { SavedListItem } from '../../types';
import { useTranslation } from '../../i18n';
import { inspectorTranslations, InspectorTranslationKey } from '../../i18n/inspector';
import { relationshipService } from '../../services/relationshipService'; // Import Service
import { useToast } from '../../hooks/useToast'; // Import Toast

// --- Helpers for formatting ---
const WEEKDAY_MAP = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

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
    // [Requirement 1] Default to expanded (true)
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

    // Create Lookup Maps
    const lookups = useMemo(() => {
        const createMap = (list: SavedListItem[]) => new Map(list.map(i => [i.id, i]));
        return {
            players: createMap(players),
            locations: createMap(locations),
            games: createMap(games),
            weekdays: createMap(weekdays),
            timeSlots: createMap(timeSlots)
        };
    }, [players, locations, games, weekdays, timeSlots]);

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
const InspectorDetailPanel = ({ selectedItem, icon: Icon }: { selectedItem: any, icon: any }) => {
    const t = useInspectorTranslation();

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            {selectedItem ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shadow-sm"><Icon size={24}/></div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">
                                {/* Special formatting for Weekdays */}
                                {selectedItem.id.startsWith('weekday_') 
                                    ? WEEKDAY_MAP[parseInt(selectedItem.name)] || selectedItem.name
                                    : selectedItem.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono mt-1">{selectedItem.id}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{t('usage_count')}</span>
                            <span className="text-lg font-mono text-emerald-400 font-bold">{selectedItem.usageCount}</span>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{t('last_used')}</span>
                            <span className="text-sm font-mono text-slate-300">{new Date(selectedItem.lastUsed).toLocaleString()}</span>
                        </div>
                    </div>

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

                        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                            <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase">{t('full_dump')}</div>
                            <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar">
                                <pre className="text-xs font-mono text-sky-400/80 whitespace-pre-wrap break-all">
                                    {JSON.stringify(selectedItem, null, 2)}
                                </pre>
                            </div>
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

const DataList = ({ title, table, icon: Icon }: { title: string, table: any, icon: any }) => {
  const data = useLiveQuery(() => table.toArray());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const t = useInspectorTranslation();

  if (!data) return <div className="p-4 text-slate-500">{t('loading')}</div>;

  const selectedItem = data.find((i: any) => i.id === selectedId);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: List */}
      <div className="w-1/3 border-r border-slate-700 overflow-y-auto no-scrollbar bg-slate-900/50">
        <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 flex justify-between items-center backdrop-blur-sm bg-opacity-90">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Icon size={12} /> {title} ({data.length})
            </span>
        </div>
        <div className="p-2 space-y-1">
            {data.map((item: any) => (
            <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all flex justify-between items-center ${selectedId === item.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'}`}
            >
                <span className="truncate font-bold">{item.name || item.id}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedId === item.id ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-700 text-slate-500'}`}>{item.usageCount || 0}</span>
            </button>
            ))}
            {data.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-600 italic">
                    {t('no_data_category')}
                </div>
            )}
        </div>
      </div>

      {/* Right: Inspector */}
      <InspectorDetailPanel selectedItem={selectedItem} icon={Icon} />
    </div>
  );
};

// [Requirement 2] Specialized Time Inspector with Split Left Pane
const TimeInspector = () => {
    const weekdays = useLiveQuery(() => db.savedWeekdays.toArray()) || [];
    const timeSlots = useLiveQuery(() => db.savedTimeSlots.toArray()) || [];
    const t = useInspectorTranslation();
    
    // Unified selection state
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Find the item object from either list
    const selectedItem = useMemo(() => {
        return weekdays.find(i => i.id === selectedId) || timeSlots.find(i => i.id === selectedId);
    }, [selectedId, weekdays, timeSlots]);

    // Determine icon based on what is selected
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
                    {/* Only show icon if selected to save space, or maybe not needed */}
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
                
                {/* Top Half: Weekdays */}
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

                {/* Bottom Half: Time Slots */}
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

            {/* Right Panel: Unified Inspector */}
            <InspectorDetailPanel selectedItem={selectedItem} icon={SelectedIcon} />
        </div>
    );
}

const SystemDataInspector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'games' | 'players' | 'locations' | 'time'>('games');
  const [isProcessing, setIsProcessing] = useState(false);
  const t = useInspectorTranslation();
  const { showToast } = useToast();

  const handleReprocessHistory = async () => {
      if (isProcessing) return;
      
      const confirm = window.confirm("確定要重新掃描所有歷史紀錄嗎？\n這將補齊所有匯入資料的統計與關聯性。");
      if (!confirm) return;

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

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      
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
                onClick={handleReprocessHistory} 
                disabled={isProcessing}
                className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                title="重新掃描並匯入歷史紀錄 (補齊統計)"
            >
                {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
            </button>
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
      </div>
    </div>,
    document.body
  );
};

export default SystemDataInspector;
