
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Users, MapPin, Clock, Hash, LayoutGrid, Zap, Image as ImageIcon, HardDrive, Loader2, Trash2, Search, RefreshCw, Skull, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import Dexie from 'dexie'; 
import { LocalImage } from '../../types';
import { relationshipService } from '../../services/relationshipService'; 
import { useToast } from '../../hooks/useToast'; 
import ConfirmationModal from '../shared/ConfirmationModal'; 
import WeightsInspector from './WeightsInspector'; 
import { DataList, InspectorDetailPanel, useInspectorTranslation } from './InspectorShared';

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

// Specialized Time Inspector with Split Left Pane
const TimeInspector = () => {
    const weekdays = useLiveQuery(() => db.savedWeekdays.toArray()) || [];
    const timeSlots = useLiveQuery(() => db.savedTimeSlots.toArray()) || [];
    const t = useInspectorTranslation();
    
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Local icon components for list
    const Calendar = (props: any) => <Clock {...props} />; // Placeholder
    const Watch = (props: any) => <Clock {...props} />;

    const selectedItem = useMemo(() => {
        return weekdays.find(i => i.id === selectedId) || timeSlots.find(i => i.id === selectedId);
    }, [selectedId, weekdays, timeSlots]);

    const SelectedIcon = selectedItem ? (selectedItem.id.startsWith('weekday') ? Calendar : Watch) : Clock;

    const renderListItem = (item: any, label: string) => {
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
                            <Clock size={12} /> {t('list_weekdays')}
                        </span>
                    </div>
                    <div className="p-2 space-y-1">
                        {weekdays.map(w => renderListItem(w, WEEKDAY_MAP[parseInt(w.name)] || w.name))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
                    <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 flex justify-between items-center backdrop-blur-sm bg-opacity-90">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={12} /> {t('list_timeslots')}
                        </span>
                    </div>
                    <div className="p-2 space-y-1">
                        {timeSlots.map(t => renderListItem(t, t.name))}
                    </div>
                </div>
            </div>
            <InspectorDetailPanel selectedItem={selectedItem} icon={SelectedIcon} />
        </div>
    );
}

// [New] Image Inspector Tab
const ImageInspector = () => {
    const t = useInspectorTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState<LocalImage | null>(null);

    // [Performance] DB-Level Pagination & Filtering
    const images = useLiveQuery(async () => {
        let collection = db.images.toCollection();
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            collection = collection.filter(img => 
                img.id.toLowerCase().includes(lower) || 
                img.relatedId.toLowerCase().includes(lower)
            );
        }
        return await collection.limit(50).toArray();
    }, [searchTerm]);

    // Load full image blob only for the SINGLE selected item
    useEffect(() => {
        if (selectedId) {
            db.images.get(selectedId).then(img => {
                if (img) {
                    setSelectedImage(img);
                    const url = URL.createObjectURL(img.blob);
                    setPreviewUrl(url);
                }
            });
        } else {
            setSelectedImage(null);
            setPreviewUrl(null);
        }
        
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const displayImages = images || [];

    return (
        <div className="flex flex-1 min-h-0">
            {/* Left: Image List */}
            <div className="w-1/3 border-r border-slate-700 overflow-y-auto no-scrollbar bg-slate-900/50">
                <div className="p-3 sticky top-0 bg-slate-900 border-b border-slate-700 z-10 backdrop-blur-sm bg-opacity-95">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <ImageIcon size={12} /> {t('list_images')} (前{displayImages.length}筆)
                        </span>
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
                </div>
                <div className="p-2 space-y-1">
                    {displayImages.map((img: LocalImage) => (
                        <button
                            key={img.id}
                            onClick={() => setSelectedId(img.id)}
                            className={`w-full text-left p-2 rounded-lg text-xs transition-all flex flex-col gap-1 ${selectedId === img.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <div className="flex justify-between w-full">
                                <span className="font-mono truncate w-24 text-[10px] opacity-70">{img.id.substring(0,8)}...</span>
                                {/* Since we haven't loaded the blob in list view for performance, size isn't available here without full load. */}
                                {/* We show type instead */}
                                <span className="text-[9px] font-bold text-slate-400">{img.relatedType}</span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80">
                                <span className={`w-2 h-2 rounded-full ${img.relatedType === 'template' ? 'bg-sky-400' : 'bg-yellow-400'}`} />
                                <span className="truncate w-full">{img.relatedId}</span>
                            </div>
                        </button>
                    ))}
                    {displayImages.length === 0 && (
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
                    
                    if (count < 5000) {
                        await table.each((item: any) => {
                            size += calculateObjectSize(item);
                        });
                    } else {
                        // Estimate for huge tables
                         size = count * 100; // Rough average
                    }

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
  const [activeTab, setActiveTab] = useState<'games' | 'players' | 'locations' | 'time' | 'counts' | 'modes' | 'weights' | 'images' | 'bgg' | 'session' | 'db'>('games');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); // [New]
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
      setProgress(0);
      try {
          // 1. Fetch all history sorted by time (oldest first)
          const allHistory = await db.history.orderBy('endTime').toArray();
          const total = allHistory.length;
          let count = 0;
          
          // 2. Batch Processing with Chunking
          // [Optimization] Increase chunk size to 200 as requested
          const CHUNK_SIZE = 200;
          
          for (let i = 0; i < total; i += CHUNK_SIZE) {
              const chunk = allHistory.slice(i, i + CHUNK_SIZE);
              
              // Process chunk
              await relationshipService.processHistoryBatch(chunk);
              
              count += chunk.length;
              setProgress(Math.min(100, Math.round((count / total) * 100)));
              
              // Yield to main thread to prevent UI freeze
              await new Promise(resolve => setTimeout(resolve, 0));
          }
          
          showToast({ message: `已成功掃描 ${total} 筆紀錄`, type: 'success' });
      } catch (error) {
          console.error("Reprocess failed", error);
          showToast({ message: "掃描過程發生錯誤", type: 'error' });
      } finally {
          setIsProcessing(false);
          setProgress(0);
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
                onClick={() => setConfirmAction('reset')} 
                disabled={isProcessing}
                className="p-2 hover:bg-slate-800 rounded-lg text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                title="清空資料庫 (刪除所有列表與關聯)"
            >
                <Trash2 size={20} />
            </button>
            <button 
                onClick={() => setConfirmAction('reprocess')} 
                disabled={isProcessing}
                className="p-2 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 relative overflow-hidden"
                title="重新掃描並匯入歷史紀錄"
            >
                {isProcessing ? (
                    <>
                        <div className="absolute inset-0 bg-indigo-500/20" style={{ width: `${progress}%` }}></div>
                        <span className="relative text-[10px] font-bold">{progress}%</span>
                    </>
                ) : (
                    <RefreshCw size={20} />
                )}
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
            { id: 'modes', label: t('tab_modes'), icon: Trophy }, 
            { id: 'session', label: t('tab_session'), icon: Zap }, // Moved Session before Weights
            { id: 'weights', label: t('tab_weights'), icon: Users }, 
            { id: 'images', label: t('tab_images'), icon: ImageIcon },
            { id: 'bgg', label: t('tab_bgg'), icon: Database }, 
            { id: 'db', label: t('tab_db'), icon: HardDrive },
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-emerald-500 text-emerald-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}
            >
                {/* Use imported icon or fallback */}
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
        {activeTab === 'weights' && <WeightsInspector />} 
        {activeTab === 'images' && <ImageInspector />}
        {activeTab === 'bgg' && <DataList title={t('list_bgg')} table={db.bggGames} icon={Database} isBGG={true} />}
        {activeTab === 'session' && <DataList title={t('list_session')} table={db.savedCurrentSession} icon={Zap} />}
        {activeTab === 'db' && <DatabaseInspector onRequestFactoryReset={() => setConfirmAction('factory_reset')} />}
      </div>
    </div>,
    document.body
  );
};

export default SystemDataInspector;
