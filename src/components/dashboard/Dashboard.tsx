
import React, { useState, useMemo } from 'react';
import { GameTemplate, GameSession } from '../../types';
import { Plus, ChevronDown, ChevronRight, Pin, LayoutGrid, ArrowRightLeft, Library, Sparkles, CloudCog, Loader2, CloudAlert, Activity, CloudOff } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';
import InstallGuideModal from '../modals/InstallGuideModal';
import { useToast } from '../../hooks/useToast';
import { generateId } from '../../utils/idGenerator';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';

// Sub Components
import DashboardHeader from './parts/DashboardHeader';
import GameCard from './parts/GameCard';
import CloudManagerModal from './modals/CloudManagerModal';
import DataManagerModal from './modals/DataManagerModal';

interface DashboardProps {
  userTemplates: GameTemplate[];
  systemOverrides: Record<string, GameTemplate>;
  systemTemplates: GameTemplate[]; 
  pinnedIds: string[];
  newBadgeIds: string[]; // [Changed] knownSysIds -> newBadgeIds
  activeSessionIds: string[];
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  onTemplateSelect: (template: GameTemplate) => void;
  onDirectResume: (templateId: string) => void;
  onDiscardSession: (templateId: string) => void;
  onClearAllActiveSessions: () => void;
  getSessionPreview: (templateId: string) => GameSession | null;
  onTemplateCreate: () => void;
  onTemplateDelete: (id: string) => void;
  onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean }) => void; 
  onBatchImport: (templates: GameTemplate[]) => void;
  onTogglePin: (id: string) => void;
  onClearNewBadges: () => void; // [Changed] onMarkSystemSeen -> onClearNewBadges
  onRestoreSystem: (id: string) => void;
  isInstalled: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  userTemplates,
  systemOverrides,
  systemTemplates,
  pinnedIds,
  newBadgeIds,
  activeSessionIds,
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
  isInstalled,
  canInstall,
  onInstallClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Section Toggles
  const [isActiveLibOpen, setIsActiveLibOpen] = useState(true);
  const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  // Modal Control States
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null); 
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { showToast } = useToast();
  const { 
      handleBackup, fetchFileList, restoreBackup, restoreFromTrash, deleteCloudFile, emptyTrash, 
      toggleCloudConnection, isSyncing, isConnected, isAutoConnectEnabled, isMockMode 
  } = useGoogleDrive();
  
  // New games count is simply the length of the badge list
  const newSystemTemplatesCount = newBadgeIds.length;
  const allTemplates = [...userTemplates, ...systemTemplates];

  const filterTemplates = (t: GameTemplate) => t.name.toLowerCase().includes(searchQuery.toLowerCase());

  // --- Data Logic ---
  
  const activeGameItems = useMemo(() => {
      return activeSessionIds.map(id => {
          const t = allTemplates.find(template => template.id === id);
          if (!t) return null;
          const session = getSessionPreview(id);
          return { template: t, timestamp: session ? session.startTime : 0 };
      })
      .filter((item): item is { template: GameTemplate, timestamp: number } => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [activeSessionIds, allTemplates, getSessionPreview]);

  const filteredActiveGames = activeGameItems.filter(item => filterTemplates(item.template));

  const pinnedTemplates = pinnedIds
    .map(id => allTemplates.find(t => t.id === id))
    .filter((t): t is GameTemplate => t !== undefined);
  const filteredPinnedTemplates = pinnedTemplates.filter(filterTemplates);
  
  const userTemplatesToShow = userTemplates.filter(t => !pinnedIds.includes(t.id));
  const filteredUserTemplates = userTemplatesToShow.filter(filterTemplates);
  
  const systemTemplatesToShow = systemTemplates.filter(t => !pinnedIds.includes(t.id));
  const filteredSystemTemplates = systemTemplatesToShow.filter(filterTemplates);

  // --- Handlers ---

  const handleCopyJSON = (template: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      const json = JSON.stringify(template, null, 2);
      navigator.clipboard.writeText(json).then(() => {
          setCopiedId(template.id);
          setTimeout(() => setCopiedId(null), 2000);
          showToast({ message: "JSON 已複製", type: 'success' });
      });
  };

  const handleCloudBackup = async (template: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAutoConnectEnabled) {
          showToast({ message: "請先點擊上方雲端按鈕啟用連線", type: 'warning' });
          return;
      }
      const updated = await handleBackup(template, null);
      if (updated) {
          onTemplateSave({ ...updated, lastSyncedAt: Date.now() }, { skipCloud: true });
      }
  };

  const handleCloudButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isSyncing) return;
      if (isConnected && isAutoConnectEnabled) setShowCloudModal(true);
      else toggleCloudConnection();
  };

  const handleCopySystemTemplate = (template: GameTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTemplate: GameTemplate = {
        ...JSON.parse(JSON.stringify(template)),
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    onTemplateSave(newTemplate, { skipCloud: true });
    showToast({ message: "已建立副本", type: 'success' });
  };

  const getCloudButtonContent = () => {
      if (isSyncing) return { icon: <Loader2 size={18} className="animate-spin" />, colorClass: 'text-sky-400 bg-slate-700 cursor-wait', title: "同步中" };
      if (isAutoConnectEnabled) {
          if (isConnected) return { icon: <CloudCog size={18} />, colorClass: 'text-sky-400 hover:text-white hover:bg-slate-700', title: "雲端管理 (已連線)" };
          return { icon: <CloudAlert size={18} />, colorClass: 'text-amber-400 hover:text-amber-200 hover:bg-slate-700', title: "連線失敗 (點擊重試)" };
      }
      return { icon: <CloudOff size={18} />, colorClass: 'text-slate-500 hover:text-white hover:bg-slate-700', title: "開啟雲端同步" };
  };

  const cloudBtn = getCloudButtonContent();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 transition-colors duration-300">
      
      <DashboardHeader 
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isInstalled={isInstalled}
        canInstall={canInstall}
        onInstallClick={onInstallClick}
        onShowInstallGuide={() => setShowInstallGuide(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        
        {/* Active Games */}
        {activeGameItems.length > 0 && (
            <div className="space-y-2">
                <div onClick={() => setIsActiveLibOpen(!isActiveLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">{isActiveLibOpen ? <ChevronDown size={20} className="text-emerald-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Activity size={18} className="text-emerald-400" /> 進行中遊戲 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredActiveGames.length}</span></h3></div>
                    <button onClick={(e) => { e.stopPropagation(); setShowClearAllConfirm(true); }} className="text-xs text-slate-500 hover:text-red-400 px-2 py-1">全部清空</button>
                </div>
                {isActiveLibOpen && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {filteredActiveGames.map(item => (
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
                    <div className="flex items-center gap-2">{isPinnedLibOpen ? <ChevronDown size={20} className="text-yellow-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Pin size={18} className="text-yellow-400" /> 已釘選 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredPinnedTemplates.length}</span></h3></div>
                </div>
                {isPinnedLibOpen && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {filteredPinnedTemplates.map(t => (
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
                <div className="flex items-center gap-2">{isUserLibOpen ? <ChevronDown size={20} className="text-emerald-500"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><LayoutGrid size={18} className="text-emerald-500" /> 我的遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredUserTemplates.length}</span></h3></div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleCloudButtonClick} 
                        className={`p-1.5 rounded-lg transition-colors ${cloudBtn.colorClass}`} 
                        title={cloudBtn.title}
                    >
                        {cloudBtn.icon}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDataModal(true); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="匯入/匯出 JSON"><ArrowRightLeft size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onTemplateCreate(); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg active:scale-95"><Plus size={14} /> 新增</button>
                </div>
            </div>
            {isUserLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {userTemplatesToShow.length === 0 && <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">還沒有建立遊戲模板</div>}
                    {filteredUserTemplates.map(t => (
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
                <div className="flex items-center gap-2">{isSystemLibOpen ? <ChevronDown size={20} className="text-indigo-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Library size={18} className="text-indigo-400" /> 內建遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredSystemTemplates.length}</span></h3></div>
                {/* 顯示「發現新遊戲」按鈕：使用 newSystemTemplatesCount */}
                {newSystemTemplatesCount > 0 && !searchQuery && (
                    <button onClick={(e) => { e.stopPropagation(); onClearNewBadges(); setIsSystemLibOpen(true); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse">
                        <Sparkles size={14} /> 發現 {newSystemTemplatesCount} 個新遊戲
                    </button>
                )}
            </div>
            {isSystemLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {filteredSystemTemplates.map(t => {
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
      </main>

      {/* --- Modals --- */}
      <ConfirmationModal isOpen={!!templateToDelete} title="確定刪除此模板？" message="此動作將無法復原。" confirmText="刪除" isDangerous={true} onCancel={() => setTemplateToDelete(null)} onConfirm={() => { if(templateToDelete) onTemplateDelete(templateToDelete); setTemplateToDelete(null); }} />
      <ConfirmationModal isOpen={!!sessionToDelete} title="確定刪除此進行中的遊戲嗎？" message="您將遺失目前的計分進度。" confirmText="刪除" isDangerous={true} onCancel={() => setSessionToDelete(null)} onConfirm={() => { if(sessionToDelete) onDiscardSession(sessionToDelete); setSessionToDelete(null); }} />
      <ConfirmationModal isOpen={showClearAllConfirm} title="清空所有進行中遊戲？" message="此動作將刪除所有暫存進度，無法復原。" confirmText="全部清空" isDangerous={true} onCancel={() => setShowClearAllConfirm(false)} onConfirm={() => { onClearAllActiveSessions(); setShowClearAllConfirm(false); }} />
      <ConfirmationModal isOpen={!!restoreTarget} title="備份修改並還原？" message="此動作將把您目前的修改備份到「我的遊戲庫」，並將此內建遊戲還原為官方最新版本。" confirmText="備份並還原" onCancel={() => setRestoreTarget(null)} onConfirm={() => { if(restoreTarget) { const backup = { ...restoreTarget, id: generateId(), name: `${restoreTarget.name} (備份)`, createdAt: Date.now(), updatedAt: Date.now() }; onTemplateSave(backup); onRestoreSystem(restoreTarget.id); setRestoreTarget(null); } }} />
      
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

      <DataManagerModal 
        isOpen={showDataModal} 
        onClose={() => setShowDataModal(false)}
        userTemplates={userTemplates}
        onImport={onBatchImport}
      />

      <CloudManagerModal 
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        isMockMode={isMockMode}
        fetchFileList={fetchFileList}
        restoreBackup={restoreBackup}
        restoreFromTrash={restoreFromTrash}
        deleteCloudFile={deleteCloudFile}
        emptyTrash={emptyTrash}
        onRestoreSuccess={(t) => onTemplateSave(t, { skipCloud: true })}
      />
    </div>
  );
};

export default Dashboard;
