
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../types';
import { Plus, ChevronDown, ChevronRight, Pin, LayoutGrid, ArrowRightLeft, Library, Sparkles, CloudCog, Loader2, Activity, CloudOff, History, Search, ChevronLeft } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';
import InstallGuideModal from '../modals/InstallGuideModal';
import { useToast } from '../../hooks/useToast';
import { generateId } from '../../utils/idGenerator';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { useAppData } from '../../hooks/useAppData'; 
import { useSwipe } from '../../hooks/useSwipe'; 
import { usePullAction } from '../../hooks/usePullAction'; 

// Sub Components
import DashboardHeader from './parts/DashboardHeader';
import GameCard from './parts/GameCard';
import HistoryList from './HistoryList'; 
import CloudManagerModal from './modals/CloudManagerModal';
import DataManagerModal from './modals/DataManagerModal';
import PullActionIsland from './parts/PullActionIsland'; 

interface DashboardProps {
  isVisible: boolean; 
  userTemplates: GameTemplate[];
  userTemplatesCount: number; 
  systemOverrides: Record<string, GameTemplate>;
  systemTemplates: GameTemplate[]; 
  systemTemplatesCount: number; 
  pinnedIds: string[];
  newBadgeIds: string[]; 
  activeSessionIds: string[];
  historyRecords?: HistoryRecord[];
  historyCount?: number; 
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  onTemplateSelect: (template: GameTemplate) => void;
  onDirectResume: (templateId: string) => void;
  onDiscardSession: (templateId: string) => void;
  onClearAllActiveSessions: () => void;
  getSessionPreview: (templateId: string) => GameSession | null;
  onTemplateCreate: () => void;
  onTemplateDelete: (id: string) => void;
  onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean, preserveTimestamps?: boolean }) => void; 
  onBatchImport: (templates: GameTemplate[]) => void;
  onTogglePin: (id: string) => void;
  onClearNewBadges: () => void; 
  onRestoreSystem: (id: string) => void;
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
  onDeleteHistory: (id: string) => void; 
  onHistorySelect: (record: HistoryRecord) => void; 
  isInstalled: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  onImportSession: (session: GameSession) => void;
  onImportHistory: (record: HistoryRecord) => void; 
  onImportSettings?: (settings: any) => void; 
}

const Dashboard: React.FC<DashboardProps> = React.memo(({
  isVisible,
  userTemplates,
  userTemplatesCount,
  systemOverrides,
  systemTemplates,
  systemTemplatesCount,
  pinnedIds,
  newBadgeIds,
  activeSessionIds,
  historyRecords,
  historyCount,
  searchQuery,
  setSearchQuery,
  onTemplateSelect,
  onDirectResume,
  onDiscardSession,
  onClearAllActiveSessions,
  getSessionPreview,
  onTemplateCreate,
  onTemplateDelete,
  onTemplateSave,
  onBatchImport,
  onTogglePin,
  onClearNewBadges,
  onRestoreSystem,
  onGetFullTemplate,
  onDeleteHistory,
  onHistorySelect,
  isInstalled,
  canInstall,
  onInstallClick,
  onImportSession,
  onImportHistory,
  onImportSettings
}) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [viewMode, setViewMode] = useState<'library' | 'history'>('library');
  
  // Animation Control: Only show entry animations on first mount
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
      const timer = setTimeout(() => setHasMounted(true), 1000);
      return () => clearTimeout(timer);
  }, []);

  // [New] Back Button Handling for Search
  const isSearchPoppedRef = useRef(false);

  useEffect(() => {
    if (isSearchActive) {
      // Push history state when search opens
      window.history.pushState({ modal: 'search' }, '');
      isSearchPoppedRef.current = false;
    } else {
      // If closed manually (not by popstate) and we are currently in the search state
      if (!isSearchPoppedRef.current && window.history.state?.modal === 'search') {
         window.history.back();
      }
      isSearchPoppedRef.current = false;
    }
  }, [isSearchActive]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isSearchActive) {
        // Handle back button when search is active
        isSearchPoppedRef.current = true;
        setIsSearchActive(false);
        setSearchQuery(''); // [Requirement] Clear query and exit search state
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSearchActive, setSearchQuery]);

  // Section Toggles
  const [isActiveLibOpen, setIsActiveLibOpen] = useState(true);
  const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  // Modal Control States
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null); 
  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null); 
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudModalCategory, setCloudModalCategory] = useState<'templates' | 'sessions' | 'history'>('templates');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // [New] Ref for Pull-to-Action
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { showToast } = useToast();
  const { 
      handleBackup, fetchFileList, restoreBackup, restoreSessionBackup, restoreHistoryBackup, restoreFromTrash, deleteCloudFile, emptyTrash, 
      connectToCloud, disconnectFromCloud, isSyncing, isConnected, isAutoConnectEnabled, isMockMode,
      performFullBackup, performFullRestore 
  } = useGoogleDrive();
  
  const { getSystemExportData } = useAppData();
  
  const newSystemTemplatesCount = newBadgeIds.length;
  const allTemplates = [...userTemplates, ...systemTemplates];

  // --- Data Logic ---
  
  const activeGameItems = useMemo(() => {
      return activeSessionIds.map(id => {
          const t = allTemplates.find(template => template.id === id);
          if (!t) return null;
          const session = getSessionPreview(id);
          const sortTime = session ? (session.lastUpdatedAt || session.startTime) : 0;
          return { template: t, timestamp: sortTime };
      })
      .filter((item): item is { template: GameTemplate, timestamp: number } => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [activeSessionIds, allTemplates, getSessionPreview]);

  const pinnedTemplates = pinnedIds
    .map(id => allTemplates.find(t => t.id === id))
    .filter((t): t is GameTemplate => t !== undefined);
  
  const userTemplatesToShow = userTemplates.filter(t => !pinnedIds.includes(t.id));
  const systemTemplatesToShow = systemTemplates.filter(t => !pinnedIds.includes(t.id));

  // --- Handlers ---

  const handleHeaderCloudClick = async () => {
      if (viewMode === 'history') {
          setCloudModalCategory('history');
      } else {
          setCloudModalCategory('templates');
      }
      
      setShowCloudModal(true);
      if (!isConnected && !isSyncing) {
          await connectToCloud();
      }
  };

  // --- Pull-to-Action Hook ---
  const { pullY, pullX, activeState, isPulling } = usePullAction(scrollContainerRef, {
      onTriggerSearch: () => {
          setIsSearchActive(true);
          // Auto focus will be handled by DashboardHeader effect
      },
      onTriggerCloud: handleHeaderCloudClick,
      disabled: false // Optional: disable when modals are open if needed
  });

  // --- Swipe Logic ---
  const SWIPE_THRESHOLD = 35;
  const { onTouchStart, onTouchMove, onTouchEnd, swipeOffset } = useSwipe({
    onSwipeLeft: () => {
      if (viewMode === 'library') setViewMode('history');
    },
    onSwipeRight: () => {
      if (viewMode === 'history') setViewMode('library');
    },
  }, {
    minSwipeDistance: SWIPE_THRESHOLD,
    minFlickDistance: 10 
  });

  // [Conflict Resolution] Block horizontal swipe effect if vertical pulling is active
  let validOffset = 0;
  if (!isPulling) { // Only calculate offset if NOT pulling vertically
      if (viewMode === 'library') {
          validOffset = Math.min(0, swipeOffset); 
      } else if (viewMode === 'history') {
          validOffset = Math.max(0, swipeOffset); 
      }
  }
  const dampedOffset = validOffset * 0.5;

  // --- Handlers (Existing) ---

  const handleCopyJSON = async (partialTemplate: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      let templateToCopy = partialTemplate;
      if (!partialTemplate.columns || partialTemplate.columns.length === 0) {
          const full = await onGetFullTemplate(partialTemplate.id);
          if (full) templateToCopy = full;
      }
      const json = JSON.stringify(templateToCopy, null, 2);
      navigator.clipboard.writeText(json).then(() => {
          setCopiedId(partialTemplate.id);
          setTimeout(() => setCopiedId(null), 2000);
          showToast({ message: "JSON 已複製", type: 'success' });
      });
  };

  const handleCloudBackup = async (partialTemplate: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAutoConnectEnabled) {
          showToast({ message: "請先點擊上方雲端按鈕啟用連線", type: 'warning' });
          return;
      }
      let templateToBackup = partialTemplate;
      if (!partialTemplate.columns || partialTemplate.columns.length === 0) {
          const full = await onGetFullTemplate(partialTemplate.id);
          if (full) templateToBackup = full;
          else {
              showToast({ message: "讀取模板失敗", type: 'error' });
              return;
          }
      }
      const updated = await handleBackup(templateToBackup);
      if (updated) {
          onTemplateSave({ ...updated, lastSyncedAt: Date.now() }, { skipCloud: true, preserveTimestamps: true });
      }
  };

  const handleCopySystemTemplate = async (partialTemplate: GameTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    let sourceTemplate = partialTemplate;
    if (!sourceTemplate.columns || sourceTemplate.columns.length === 0) {
        const full = await onGetFullTemplate(partialTemplate.id);
        if (full) sourceTemplate = full;
    }
    const newTemplate: GameTemplate = {
        ...JSON.parse(JSON.stringify(sourceTemplate)),
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    onTemplateSave(newTemplate, { skipCloud: true });
    showToast({ message: "已建立副本", type: 'success' });
  };

  const handleSystemBackupAction = async (onProgress: (count: number, total: number) => void, onError: (failedItems: string[]) => void) => {
      const data = await getSystemExportData();
      const templates = data.data.templates || [];
      const overrides = data.data.overrides || []; 
      const history = data.data.history || [];
      const sessions = data.data.sessions || []; 
      
      return await performFullBackup(
          templates, 
          history, 
          sessions, 
          overrides, 
          onProgress, 
          onError, 
          (type, item) => {
              if (type === 'template' && item) {
                  // [Fix] Explicitly set lastSyncedAt to now, so the UI indicator turns green immediately.
                  // 'item' is the updated template returned from backup service (with cloudImageId).
                  onTemplateSave({ ...item, lastSyncedAt: Date.now() }, { skipCloud: true, preserveTimestamps: true });
              }
          }
      );
  };

  const handleSystemRestoreAction = async (
      localMeta: { templates: Map<string, number>, history: Map<string, number>, sessions: Map<string, number> },
      onProgress: (count: number, total: number) => void, 
      onError: (failedItems: string[]) => void
  ) => {
      return await performFullRestore(
          localMeta,
          onProgress,
          onError,
          async (type, item) => {
              if (type === 'template') {
                  const syncedItem = { ...item, lastSyncedAt: item.updatedAt || Date.now() };
                  onTemplateSave(syncedItem, { skipCloud: true, preserveTimestamps: true });
              } else if (type === 'history') {
                  onImportHistory(item);
              } else if (type === 'session') {
                  onImportSession(item);
              }
          },
          (settings) => {
              if (onImportSettings) {
                  onImportSettings(settings);
              }
          }
      );
  };

  const animClass = hasMounted ? "" : "animate-in fade-in slide-in-from-top-2 duration-300";

  return (
    <div 
        className="flex-1 flex flex-col min-h-0 bg-slate-900 transition-colors duration-300 overflow-hidden"
    >
      <DashboardHeader 
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isInstalled={isInstalled}
        canInstall={canInstall}
        onInstallClick={onInstallClick}
        onShowInstallGuide={() => setShowInstallGuide(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isConnected={isConnected}
        isSyncing={isSyncing}
        onCloudClick={handleHeaderCloudClick}
      />

      {/* 
          Main Scroll Container with Ref 
          PullActionIsland is absolute positioned inside relative wrapper
      */}
      <div 
        className="flex-1 overflow-y-auto no-scrollbar relative"
        ref={scrollContainerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull to Action Visual Feedback */}
        <PullActionIsland 
            pullY={pullY} 
            pullX={pullX} 
            activeState={activeState} 
        />

        <main 
            className="p-4 space-y-4 min-h-full transition-transform duration-75 ease-out"
            style={{ transform: `translateX(${dampedOffset}px)` }}
        >
            {/* Conditional Rendering based on View Mode */}
            {viewMode === 'history' ? (
                <>
                    {searchQuery.trim().length > 0 && (
                        <div className="flex justify-end items-center bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2 px-2">
                                <Search size={14} className="text-emerald-500" />
                                <span className="text-sm font-bold text-slate-300">
                                    搜尋結果：{historyCount} 筆
                                </span>
                                {historyCount && historyCount > 100 && (
                                    <span className="text-xs text-slate-500 border-l border-slate-600 pl-2 ml-1">
                                        顯示最近 100 筆
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <HistoryList 
                        records={historyRecords} 
                        onDelete={(id) => setHistoryToDelete(id)}
                        onSelect={onHistorySelect}
                    />
                </>
            ) : (
                <>
                    {/* Active Games */}
                    {activeGameItems.length > 0 && (
                        <div className="space-y-2">
                            <div onClick={() => setIsActiveLibOpen(!isActiveLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-2">{isActiveLibOpen ? <ChevronDown size={20} className="text-emerald-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Activity size={18} className="text-emerald-400" /> 進行中遊戲 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{activeGameItems.length}</span></h3></div>
                                <button onClick={(e) => { e.stopPropagation(); setShowClearAllConfirm(true); }} className="text-xs text-slate-500 hover:text-red-400 px-2 py-1">全部清空</button>
                            </div>
                            {isActiveLibOpen && (
                                <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                                    {activeGameItems.map(item => (
                                        <GameCard 
                                            key={`active-${item.template.id}`}
                                            template={item.template}
                                            mode="active"
                                            onClick={() => onDirectResume(item.template.id)}
                                            onDelete={(e) => { e.stopPropagation(); setSessionToDelete(item.template.id); }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pinned */}
                    {pinnedTemplates.length > 0 && (
                        <div className="space-y-2">
                            <div onClick={() => setIsPinnedLibOpen(!isPinnedLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-2">{isPinnedLibOpen ? <ChevronDown size={20} className="text-yellow-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Pin size={18} className="text-yellow-400" /> 已釘選 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{pinnedTemplates.length}</span></h3></div>
                            </div>
                            {isPinnedLibOpen && (
                                <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                                    {pinnedTemplates.map(t => (
                                        <GameCard 
                                            key={`pinned-${t.id}`}
                                            template={t}
                                            mode="pinned"
                                            onClick={() => onTemplateSelect(t)}
                                            onPin={(e) => { e.stopPropagation(); onTogglePin(t.id); }}
                                            onCopyJSON={(e) => handleCopyJSON(t, e)}
                                            isCopied={copiedId === t.id}
                                            isConnected={isConnected}
                                            isAutoConnectEnabled={isAutoConnectEnabled}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* User Library */}
                    <div className="space-y-2">
                        <div onClick={() => setIsUserLibOpen(!isUserLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-2">{isUserLibOpen ? <ChevronDown size={20} className="text-emerald-500"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><LayoutGrid size={18} className="text-emerald-500" /> 我的遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{userTemplatesCount}</span></h3></div>
                            <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setShowDataModal(true); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="匯入/匯出 JSON"><ArrowRightLeft size={18} /></button>
                                <button onClick={(e) => { e.stopPropagation(); onTemplateCreate(); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg active:scale-95"><Plus size={14} /> 新增</button>
                            </div>
                        </div>
                        {isUserLibOpen && (
                            <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                                {userTemplatesCount === 0 && <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">
                                    {searchQuery ? '沒有符合搜尋的遊戲' : '還沒有建立遊戲模板'}
                                </div>}
                                {userTemplatesToShow.map(t => (
                                    <GameCard 
                                        key={t.id}
                                        template={t}
                                        mode="user"
                                        onClick={() => onTemplateSelect(t)}
                                        onPin={(e) => { e.stopPropagation(); onTogglePin(t.id); }}
                                        onDelete={(e) => { e.stopPropagation(); setTemplateToDelete(t.id); }}
                                        onCopyJSON={(e) => handleCopyJSON(t, e)}
                                        onCloudBackup={(e) => handleCloudBackup(t, e)}
                                        isCopied={copiedId === t.id}
                                        isConnected={isConnected}
                                        isAutoConnectEnabled={isAutoConnectEnabled}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* System Library */}
                    <div className="space-y-2">
                        <div onClick={() => setIsSystemLibOpen(!isSystemLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-2">{isSystemLibOpen ? <ChevronDown size={20} className="text-indigo-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Library size={18} className="text-indigo-400" /> 內建遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{systemTemplatesCount}</span></h3></div>
                            {newSystemTemplatesCount > 0 && !searchQuery && (
                                <button onClick={(e) => { e.stopPropagation(); onClearNewBadges(); setIsSystemLibOpen(true); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse">
                                    <Sparkles size={14} /> 發現 {newSystemTemplatesCount} 個新遊戲
                                </button>
                            )}
                        </div>
                        {isSystemLibOpen && (
                            <div className={`grid grid-cols-2 gap-3 ${animClass}`}>
                                {systemTemplatesToShow.map(t => {
                                    const isNew = newBadgeIds.includes(t.id);
                                    return (
                                        <div key={t.id} className="relative">
                                            {isNew && (
                                                <div className="absolute -top-1 -right-1 z-10 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 shadow-md animate-bounce" />
                                            )}
                                            <GameCard 
                                                template={t}
                                                mode="system"
                                                onClick={() => onTemplateSelect(t)}
                                                onPin={(e) => { e.stopPropagation(); onTogglePin(t.id); }}
                                                onCopyJSON={(e) => handleCopyJSON(t, e)}
                                                onSystemCopy={(e) => handleCopySystemTemplate(t, e)}
                                                onSystemRestore={(e) => { e.stopPropagation(); setRestoreTarget(t); }}
                                                isCopied={copiedId === t.id}
                                                systemOverride={!!systemOverrides[t.id]}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </main>
      </div>

      {/* --- Modals --- */}
      <ConfirmationModal isOpen={!!templateToDelete} title="確定刪除此模板？" message="此動作將無法復原。" confirmText="刪除" isDangerous={true} onCancel={() => setTemplateToDelete(null)} onConfirm={() => { if(templateToDelete) onTemplateDelete(templateToDelete); setTemplateToDelete(null); }} />
      <ConfirmationModal isOpen={!!sessionToDelete} title="確定刪除此進行中的遊戲嗎？" message="您將遺失目前的計分進度。" confirmText="刪除" isDangerous={true} onCancel={() => setSessionToDelete(null)} onConfirm={() => { if(sessionToDelete) onDiscardSession(sessionToDelete); setSessionToDelete(null); }} />
      <ConfirmationModal isOpen={!!historyToDelete} title="確定刪除此紀錄？" message="此動作將無法復原。" confirmText="刪除" isDangerous={true} onCancel={() => setHistoryToDelete(null)} onConfirm={() => { if(historyToDelete) onDeleteHistory(historyToDelete); setHistoryToDelete(null); }} />
      <ConfirmationModal isOpen={showClearAllConfirm} title="清空所有進行中遊戲？" message="此動作將刪除所有暫存進度，無法復原。" confirmText="全部清空" isDangerous={true} onCancel={() => setShowClearAllConfirm(false)} onConfirm={() => { onClearAllActiveSessions(); setShowClearAllConfirm(false); }} />
      <ConfirmationModal 
        isOpen={!!restoreTarget} 
        title="還原預設值？" 
        message="目前的修改將會自動備份到「我的遊戲庫」，並還原至初始設定。" 
        confirmText="還原" 
        onCancel={() => setRestoreTarget(null)} 
        onConfirm={async () => { 
            if(restoreTarget) { 
                onRestoreSystem(restoreTarget.id);
                setRestoreTarget(null); 
            } 
        }} 
      />
      
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

      <DataManagerModal 
        isOpen={showDataModal} 
        onClose={() => setShowDataModal(false)}
        userTemplates={userTemplates} 
        onImport={onBatchImport}
        onGetFullTemplate={onGetFullTemplate}
      />

      <CloudManagerModal 
        isOpen={showCloudModal}
        initialCategory={cloudModalCategory} 
        isConnected={isConnected} 
        onClose={() => setShowCloudModal(false)}
        isMockMode={isMockMode}
        fetchFileList={fetchFileList}
        restoreBackup={restoreBackup}
        restoreSessionBackup={restoreSessionBackup}
        restoreHistoryBackup={restoreHistoryBackup} 
        restoreFromTrash={restoreFromTrash}
        deleteCloudFile={deleteCloudFile}
        emptyTrash={emptyTrash}
        connectToCloud={connectToCloud}
        disconnectFromCloud={disconnectFromCloud}
        onRestoreSuccess={(t) => onTemplateSave({ ...t, lastSyncedAt: t.updatedAt || Date.now() }, { skipCloud: true, preserveTimestamps: true })} 
        onSessionRestoreSuccess={onImportSession}
        onHistoryRestoreSuccess={onImportHistory} 
        onSystemBackup={handleSystemBackupAction} 
        onSystemRestore={handleSystemRestoreAction} 
        onGetLocalData={getSystemExportData} 
      />
    </div>
  );
}, (prevProps, nextProps) => {
    // Optimization: Freeze dashboard when hidden
    if (!prevProps.isVisible && !nextProps.isVisible) {
        return true; 
    }
    return false;
});

export default Dashboard;
