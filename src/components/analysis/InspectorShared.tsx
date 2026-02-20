
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Search, X, Database, ExternalLink, Star, Hash } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { inspectorTranslations, InspectorTranslationKey } from '../../i18n/inspector';
import MetaFriendlyView from './MetaFriendlyView';

// --- Helper Hook ---
export const useInspectorTranslation = () => {
    const { language } = useTranslation();
    const t = (key: InspectorTranslationKey) => {
        const dict = inspectorTranslations[language] || inspectorTranslations['zh-TW'];
        return dict[key] || key;
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
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            {selectedItem ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shadow-sm"><Icon size={24}/></div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">
                                {selectedItem.id && selectedItem.id.startsWith('weekday_') 
                                    ? selectedItem.name // Weekday logic is handled in View wrapper if needed, simplify here
                                    : selectedItem.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono mt-1">{selectedItem.id}</p>
                        </div>
                    </div>

                    {/* BGG Info Card */}
                    {bggInfo && (
                        <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 shadow-inner">
                            <div className="w-full">
                                <div className="flex items-start justify-between mb-2">
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
                                
                                <div className="flex flex-wrap gap-x-3 text-xs text-indigo-300/70">
                                    {bggInfo.year && <span>年份: <span className="text-indigo-200">{bggInfo.year}</span></span>}
                                    {bggInfo.rank && <span>排名: <span className="text-indigo-200">#{bggInfo.rank}</span></span>}
                                </div>

                                {bggInfo.complexity > 0 && (
                                     <div className="text-xs text-indigo-300/70 mt-0.5">
                                        重度: <span className="text-indigo-200">{Number(bggInfo.complexity).toFixed(2)} / 5</span>
                                     </div>
                                )}
                            </div>

                            <div className="text-xs text-indigo-300/70 space-y-1 pt-2 border-t border-indigo-500/20">
                                <div className="flex flex-wrap gap-x-4">
                                    {(bggInfo.minPlayers || bggInfo.maxPlayers) && (
                                        <div>人數: <span className="text-indigo-200">{bggInfo.minPlayers || 1}{bggInfo.maxPlayers ? `-${bggInfo.maxPlayers}` : ''}</span></div>
                                    )}
                                    {bggInfo.bestPlayers && bggInfo.bestPlayers.length > 0 && (
                                         <div><Star size={10} className="inline mb-0.5 mr-0.5 text-yellow-500" fill="currentColor"/>最佳: <span className="text-emerald-300 font-bold">{bggInfo.bestPlayers.join(', ')}</span> 人</div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-x-4">
                                    {bggInfo.playingTime && (
                                        <div>時間: <span className="text-indigo-200">{bggInfo.playingTime}m</span></div>
                                    )}
                                    {bggInfo.minAge && (
                                        <div>年齡: <span className="text-indigo-200">{bggInfo.minAge}+</span></div>
                                    )}
                                </div>
                                
                                {bggInfo.designers && (
                                    <div className="truncate">設計師: <span className="text-indigo-200">{bggInfo.designers}</span></div>
                                )}

                                {bggInfo.altNames && bggInfo.altNames.length > 0 && (
                                    <div className="pt-1 mt-1 border-t border-indigo-500/10">
                                        <span className="block opacity-60 text-[10px] uppercase">別名:</span>
                                        <div className="text-indigo-200 flex flex-wrap gap-1 mt-0.5">
                                            {bggInfo.altNames.map((name: string) => (
                                                <span key={name} className="bg-indigo-900/40 px-1.5 py-0.5 rounded text-[10px] border border-indigo-500/20">{name}</span>
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

// --- List Component ---
export const DataList = ({ title, table, icon: Icon, isBGG = false }: { title: string, table: any, icon: any, isBGG?: boolean }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const t = useInspectorTranslation();

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

  if (!data) return <div className="p-4 text-slate-500">{t('loading')}</div>;

  const selectedItem = data.find((i: any) => i.id === selectedId);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: List */}
      <div className="w-1/3 border-r border-slate-700 overflow-y-auto no-scrollbar bg-slate-900/50">
        <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 backdrop-blur-sm bg-opacity-95">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Icon size={12} /> {title} (顯示前{data.length}筆)
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
            {data.map((item: any) => (
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
            {data.length === 0 && (
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
