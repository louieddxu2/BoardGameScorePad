
import React, { useState, useEffect } from 'react';
import { GameTemplate } from '../../types';
import { DEFAULT_TEMPLATES } from '../../constants';
import { Plus, Download, Dice5, Search, X, ChevronDown, ChevronRight, Pin, LayoutGrid, ArrowRightLeft, Library, Sparkles, RefreshCw, Copy, Code, Trash2, Check, Mail, HelpCircle, UploadCloud, DownloadCloud, FileJson, Clock, FolderOpen, RefreshCcw, Cloud, CloudOff } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';
import InstallGuideModal from '../modals/InstallGuideModal';
import { useToast } from '../../hooks/useToast';
import { generateId } from '../../utils/idGenerator';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { CloudFile } from '../../services/googleDrive'; 
import { googleDriveService } from '../../services/googleDrive';

interface DashboardProps {
  userTemplates: GameTemplate[];
  systemOverrides: Record<string, GameTemplate>;
  systemTemplates: GameTemplate[]; 
  pinnedIds: string[];
  knownSysIds: string[];
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  onTemplateSelect: (template: GameTemplate) => void;
  onTemplateCreate: () => void;
  onTemplateDelete: (id: string) => void;
  onTemplateSave: (template: GameTemplate) => void; 
  onBatchImport: (templates: GameTemplate[]) => void;
  onTogglePin: (id: string) => void;
  onMarkSystemSeen: () => void;
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
  knownSysIds,
  themeMode,
  onToggleTheme,
  onTemplateSelect,
  onTemplateCreate,
  onTemplateDelete,
  onTemplateSave,
  onBatchImport,
  onTogglePin,
  onMarkSystemSeen,
  onRestoreSystem,
  isInstalled,
  canInstall,
  onInstallClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'import' | 'export'>('import');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudViewMode, setCloudViewMode] = useState<'active' | 'trash'>('active');
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [cloudFileToDelete, setCloudFileToDelete] = useState<CloudFile | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([]);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportCopying, setIsExportCopying] = useState(false);
  
  const { showToast } = useToast();
  const { handleBackup, fetchFileList, restoreBackup, restoreFromTrash, deleteCloudFile, emptyTrash, isSyncing, isMockMode } = useGoogleDrive();
  
  const newSystemTemplatesCount = DEFAULT_TEMPLATES.filter(dt => !knownSysIds.includes(dt.id)).length;
  
  const allTemplates = [...userTemplates, ...systemTemplates];

  const filterTemplates = (t: GameTemplate) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase());

  const pinnedTemplates = pinnedIds
    .map(id => allTemplates.find(t => t.id === id))
    .filter((t): t is GameTemplate => t !== undefined);

  const filteredPinnedTemplates = pinnedTemplates.filter(filterTemplates);
  const userTemplatesToShow = userTemplates.filter(t => !pinnedIds.includes(t.id));
  const filteredUserTemplates = userTemplatesToShow.filter(filterTemplates);
  const systemTemplatesToShow = systemTemplates.filter(t => !pinnedIds.includes(t.id));
  const filteredSystemTemplates = systemTemplatesToShow.filter(filterTemplates);

  const handleCopyJSON = (template: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      const json = JSON.stringify(template, null, 2);
      navigator.clipboard.writeText(json).then(() => {
          setCopiedId(template.id);
          setTimeout(() => setCopiedId(null), 2000);
      });
  };

  const handleCloudBackup = async (template: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = await handleBackup(template, null);
      if (updated) {
          onTemplateSave({ ...updated, lastSyncedAt: Date.now() });
      }
  };

  const refreshCloudList = async () => {
      setIsLoadingCloud(true);
      setCloudFiles([]);
      try {
          const files = await fetchFileList(cloudViewMode);
          setCloudFiles(files);
      } catch (e) {} finally {
          setIsLoadingCloud(false);
      }
  };

  useEffect(() => {
      if (showCloudModal) refreshCloudList();
  }, [cloudViewMode]);

  const openCloudRestore = () => {
      setCloudViewMode('active');
      setShowCloudModal(true);
      refreshCloudList();
  };

  const handleCloudFileSelect = async (file: CloudFile) => {
      if (cloudViewMode === 'trash') return;
      setIsLoadingCloud(true);
      try {
          const templateWithExtra = await restoreBackup(file.id);
          const { _tempImageBase64, ...cleanTemplate } = templateWithExtra as any;
          onTemplateSave({ ...cleanTemplate, lastSyncedAt: Date.now() });
          if (_tempImageBase64) {
              showToast({ message: "模板已還原。注意：背景圖片需在開啟遊戲時重新設定或由雲端載入。", type: 'info' });
          }
          setShowCloudModal(false);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingCloud(false);
      }
  };

  const handleCloudFileDelete = async () => {
      if (!cloudFileToDelete) return;
      const success = await deleteCloudFile(cloudFileToDelete.id);
      if (success) await refreshCloudList();
      setCloudFileToDelete(null);
  };

  const handleRestoreFromTrash = async (file: CloudFile) => {
      const success = await restoreFromTrash(file.id);
      if (success) await refreshCloudList();
  };

  const handleEmptyTrash = async () => {
      const success = await emptyTrash();
      if (success) await refreshCloudList();
      setShowEmptyTrashConfirm(false);
  };

  const handleCopySystemTemplate = (template: GameTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTemplate: GameTemplate = {
        ...JSON.parse(JSON.stringify(template)),
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    onTemplateSave(newTemplate);
  };

  const handleImportJSON = () => {
      try {
          setImportError(null);
          if (!importJson.trim()) return;
          const parsed = JSON.parse(importJson);
          let itemsToImport: any[] = Array.isArray(parsed) ? parsed : [parsed];
          const validTemplates: GameTemplate[] = [];
          itemsToImport.forEach(item => {
              if (!item.name || !Array.isArray(item.columns)) throw new Error(`格式錯誤：${item.name || '未命名'} 缺少必要欄位`);
              validTemplates.push({
                  ...item,
                  id: generateId(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  columns: item.columns.map((col: any) => ({ ...col, id: col.id || generateId(8) }))
              });
          });
          if (validTemplates.length > 0) {
            onBatchImport(validTemplates);
            setShowDataModal(false);
            setImportJson('');
            showToast({ title: `成功匯入 ${validTemplates.length} 筆範本`, message: "匯入成功", type: 'success' });
          } else setImportError("沒有可匯入的有效資料");
      } catch (e: any) { setImportError(e.message || "無效的 JSON 格式"); }
  };
  
  const handleExportCopy = () => {
      const selectedTemplates = userTemplates.filter(t => exportSelectedIds.includes(t.id));
      if (selectedTemplates.length === 0) return;
      const templateStrings = selectedTemplates.map(t => `  ${JSON.stringify(t)}`);
      const json = `[\n${templateStrings.join(',\n')}\n]`;
      navigator.clipboard.writeText(json).then(() => {
          setIsExportCopying(true);
          setTimeout(() => setIsExportCopying(false), 2000);
      });
  };

  const handleShareToDev = () => {
      const selectedTemplates = userTemplates.filter(t => exportSelectedIds.includes(t.id));
      if (selectedTemplates.length === 0) return;
      const templateStrings = selectedTemplates.map(t => `  ${JSON.stringify(t)}`);
      const json = `[\n${templateStrings.join(',\n')}\n]`;
      navigator.clipboard.writeText(json).then(() => {
          setIsExportCopying(true);
          setTimeout(() => setIsExportCopying(false), 2000);
          const email = "louieddxu2@gmail.com";
          const subject = `【萬用桌遊計分板】分享遊戲模板 (${new Date().toLocaleDateString()})`;
          const body = `開發者你好！這是我製作的計分板\n↓↓↓ 資料已複製，請在下方貼上(Ctrl+V)↓↓↓\n--------------------------------------------------\n\n--------------------------------------------------`;
          window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }).catch(err => {
          console.error("Failed to copy:", err);
          showToast({ title: "自動複製失敗", message: "請手動複製後再寄信。", type: 'error' });
      });
  };

  const toggleExportSelection = (id: string) => setExportSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const renderSyncIcon = (template: GameTemplate) => {
      if (!googleDriveService.isAuthorized) return null;
      if (!template.lastSyncedAt) return <CloudOff size={14} className="text-slate-500" title="未上傳雲端" />;
      const isSynced = template.lastSyncedAt >= (template.updatedAt || 0);
      if (isSynced) return <Cloud size={14} className="text-emerald-500" title="已同步" />;
      return (
          <div className="relative" title="待同步">
              <Cloud size={14} className="text-slate-400" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full border border-slate-800" />
          </div>
      );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 transition-colors duration-300">
      <header className="p-2.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center gap-2 shadow-md h-[58px] shrink-0 transition-colors duration-300">
        {isSearchActive ? (
          <div className="flex items-center gap-2 w-full animate-in fade-in duration-300">
            <Search size={20} className="text-emerald-500 shrink-0 ml-1" />
            <input type="text" placeholder="搜尋遊戲..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="w-full bg-transparent text-white focus:outline-none placeholder-slate-500" />
            <button onClick={() => { setIsSearchActive(false); setSearchQuery(''); }} className="text-slate-400 hover:text-white p-2"><X size={20} /></button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-500">
              <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20"><Dice5 size={24} /></div>
              <h1 className="text-xl font-bold tracking-tight text-white">萬用桌遊計分板</h1>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsSearchActive(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Search size={20} /></button>
                {!isInstalled && (
                    <button className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-white shadow-lg ${canInstall ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`} onClick={canInstall ? onInstallClick : () => setShowInstallGuide(true)}>
                        <div className="relative"><Download size={14} />{!canInstall && <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full w-2.5 h-2.5 flex items-center justify-center border border-slate-700"><HelpCircle size={8} className="text-slate-900" strokeWidth={3} /></div>}</div>
                        <span className="hidden sm:inline">安裝 App</span>
                    </button>
                )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {pinnedTemplates.length > 0 && (
            <div className="space-y-2">
                <div onClick={() => setIsPinnedLibOpen(!isPinnedLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">{isPinnedLibOpen ? <ChevronDown size={20} className="text-yellow-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Pin size={18} className="text-yellow-400" /> 已釘選 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredPinnedTemplates.length}</span></h3></div>
                </div>
                {isPinnedLibOpen && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {filteredPinnedTemplates.map(t => (
                            <div key={`pinned-${t.id}`} onClick={() => onTemplateSelect(t)} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group">
                                <div className="flex items-start justify-between gap-1 pr-7">
                                    <h3 className="text-sm font-bold leading-tight line-clamp-2 text-white">{t.name}</h3>
                                    <div className="shrink-0 mt-0.5">{renderSyncIcon(t)}</div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }} className="absolute top-1 right-1 p-1.5 text-yellow-400 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors"><Pin size={16} fill="currentColor" /></button>
                                <button onClick={(e) => handleCopyJSON(t, e)} className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-emerald-400 rounded transition-colors">{copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div className="space-y-2">
            <div onClick={() => setIsUserLibOpen(!isUserLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">{isUserLibOpen ? <ChevronDown size={20} className="text-emerald-500"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><LayoutGrid size={18} className="text-emerald-500" /> 我的遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredUserTemplates.length}</span></h3></div>
                <div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); openCloudRestore(); }} className="p-1.5 text-sky-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="從雲端還原"><DownloadCloud size={18} /></button><button onClick={(e) => { e.stopPropagation(); setActiveModalTab('import'); setShowDataModal(true); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="匯入/匯出 JSON"><ArrowRightLeft size={18} /></button><button onClick={(e) => { e.stopPropagation(); onTemplateCreate(); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg active:scale-95"><Plus size={14} /> 新增</button></div>
            </div>
            {isUserLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {userTemplatesToShow.length === 0 && <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">還沒有建立遊戲模板</div>}
                    {filteredUserTemplates.map(t => (
                        <div key={t.id} onClick={() => onTemplateSelect(t)} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-emerald-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group">
                            <div className="flex items-start justify-between gap-1 pr-7">
                                <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{t.name}</h3>
                                <div className="shrink-0 mt-0.5">{renderSyncIcon(t)}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }} className="absolute top-1 right-1 p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-slate-700 rounded-md transition-colors"><Pin size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setTemplateToDelete(t.id); }} className="absolute bottom-1 left-1 p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"><Trash2 size={16} /></button>
                            <div className="absolute bottom-1 right-1 flex gap-1">
                                <button onClick={(e) => handleCloudBackup(t, e)} className="p-1.5 text-sky-500/70 hover:text-sky-400 rounded transition-colors" title="備份到 Google Drive"><UploadCloud size={14} /></button>
                                <button onClick={(e) => handleCopyJSON(t, e)} className="p-1.5 text-slate-600 hover:text-emerald-400 rounded transition-colors">{copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="space-y-2">
            <div onClick={() => setIsSystemLibOpen(!isSystemLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">{isSystemLibOpen ? <ChevronDown size={20} className="text-indigo-400"/> : <ChevronRight size={20} className="text-slate-500"/>}<h3 className="text-base font-bold text-white flex items-center gap-2"><Library size={18} className="text-indigo-400" /> 內建遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredSystemTemplates.length}</span></h3></div>
                {newSystemTemplatesCount > 0 && !searchQuery && (<button onClick={(e) => { e.stopPropagation(); onMarkSystemSeen(); setIsSystemLibOpen(true); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse"><Sparkles size={14} /> 發現 {newSystemTemplatesCount} 個新遊戲</button>)}
            </div>
            {isSystemLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {filteredSystemTemplates.map(t => (
                        <div key={t.id} onClick={() => onTemplateSelect(t)} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-indigo-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group">
                            <h3 className="text-sm font-bold text-indigo-100 leading-tight line-clamp-2 pr-8">{t.name}</h3>
                            <button onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }} className="absolute top-1 right-1 p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-slate-700 rounded-md transition-colors"><Pin size={16} /></button>
                            <div className="absolute bottom-1 left-1">{systemOverrides[t.id] ? (<button onClick={(e) => { e.stopPropagation(); setRestoreTarget(t); }} className="flex items-center gap-1 text-[9px] text-yellow-500 font-normal border border-yellow-500/30 px-1.5 py-0.5 rounded hover:bg-yellow-900/20"><RefreshCw size={8} /> 備份並還原</button>) : (<button onClick={(e) => handleCopySystemTemplate(t, e)} className="flex items-center gap-1 text-[10px] text-slate-300 font-bold bg-slate-700/50 hover:bg-slate-700 px-1.5 py-1 rounded-md"><Copy size={11} /> 建立副本</button>)}</div>
                            <button onClick={(e) => handleCopyJSON(t, e)} className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-indigo-400 rounded transition-colors">{copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </main>

      {/* Modals */}
      <ConfirmationModal isOpen={!!templateToDelete} title="確定刪除此模板？" message="此動作將無法復原。" confirmText="刪除" isDangerous={true} onCancel={() => setTemplateToDelete(null)} onConfirm={() => { if(templateToDelete) onTemplateDelete(templateToDelete); setTemplateToDelete(null); }} />
      <ConfirmationModal isOpen={!!restoreTarget} title="備份修改並還原？" message="此動作將把您目前的修改備份到「我的遊戲庫」，並將此內建遊戲還原為官方最新版本。" confirmText="備份並還原" onCancel={() => setRestoreTarget(null)} onConfirm={() => { if(restoreTarget) { const backup = { ...restoreTarget, id: generateId(), name: `${restoreTarget.name} (備份)`, createdAt: Date.now(), updatedAt: Date.now() }; onTemplateSave(backup); onRestoreSystem(restoreTarget.id); setRestoreTarget(null); } }} />
      <ConfirmationModal isOpen={!!cloudFileToDelete} title="永久刪除備份？" message={`確定要永久刪除「${cloudFileToDelete?.name.replace(/_[a-zA-Z0-9]{6,}$/, '')}」嗎？此動作無法復原。`} confirmText="永久刪除" isDangerous={true} onCancel={() => setCloudFileToDelete(null)} onConfirm={handleCloudFileDelete} />
      <ConfirmationModal isOpen={showEmptyTrashConfirm} title="清空垃圾桶？" message="確定要永久刪除垃圾桶中的所有檔案嗎？此動作無法復原。" confirmText="確認清空" isDangerous={true} onCancel={() => setShowEmptyTrashConfirm(false)} onConfirm={handleEmptyTrash} />
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

      {showCloudModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
                  <div className="flex-none bg-slate-800 rounded-t-2xl px-4 py-3 border-b border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2"><DownloadCloud size={20} className="text-sky-400" /> 雲端備份管理 {isMockMode && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">模擬</span>}</h3>
                          <button onClick={() => setShowCloudModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                      </div>
                      <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
                          <button onClick={() => setCloudViewMode('active')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${cloudViewMode === 'active' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><FolderOpen size={14} /> 我的備份</button>
                          <button onClick={() => setCloudViewMode('trash')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1 ${cloudViewMode === 'trash' ? 'bg-red-900/50 text-red-200 shadow-sm border border-red-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><Trash2 size={14} /> 垃圾桶</button>
                      </div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto no-scrollbar bg-slate-900">
                      {isLoadingCloud ? (
                          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500"><RefreshCw size={24} className="animate-spin" /><span className="text-xs">讀取中...</span></div>
                      ) : cloudFiles.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">{cloudViewMode === 'trash' ? <Trash2 size={32} className="opacity-50" /> : <UploadCloud size={32} className="opacity-50" />}<span className="text-sm">{cloudViewMode === 'trash' ? "垃圾桶是空的" : "雲端沒有找到備份檔案"}</span></div>
                      ) : (
                          <div className="space-y-2">
                              {cloudFiles.map(file => (
                                  <div key={file.id} onClick={() => cloudViewMode === 'active' ? handleCloudFileSelect(file) : null} className={`w-full bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center justify-between group transition-all ${cloudViewMode === 'active' ? 'cursor-pointer hover:bg-slate-700 hover:border-sky-500/50' : 'cursor-default opacity-80 hover:opacity-100'}`}>
                                      <div className="flex items-start gap-3 text-left flex-1 min-w-0">
                                          <div className={`p-2 bg-slate-900 rounded-lg shrink-0 ${cloudViewMode === 'active' ? 'text-sky-500' : 'text-red-400'}`}><FileJson size={20} /></div>
                                          <div className="min-w-0"><div className="font-bold text-slate-200 group-hover:text-white transition-colors truncate">{file.name.replace(/_[a-zA-Z0-9]{6,}$/, '')}</div><div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Clock size={10} /> {new Date(file.createdTime).toLocaleString()}</div></div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                          {cloudViewMode === 'active' ? (<><Download size={18} className="text-slate-600 group-hover:text-sky-400 transition-colors mr-2" /><button onClick={(e) => { e.stopPropagation(); setCloudFileToDelete(file); }} className="p-2 -m-2 text-slate-600 hover:text-red-400 hover:bg-slate-900/50 rounded-lg transition-colors z-10" title="移至垃圾桶"><Trash2 size={18} /></button></>) : (<div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleRestoreFromTrash(file); }} className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-emerald-900/30 border border-slate-700 rounded-lg transition-colors" title="還原"><RefreshCcw size={16} /></button><button onClick={(e) => { e.stopPropagation(); setCloudFileToDelete(file); }} className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-900 hover:bg-red-900/30 border border-slate-700 rounded-lg transition-colors" title="永久刪除"><Trash2 size={16} /></button></div>)}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  {cloudViewMode === 'trash' && cloudFiles.length > 0 && (<div className="flex-none p-3 bg-slate-800 border-t border-slate-700"><button onClick={() => setShowEmptyTrashConfirm(true)} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"><Trash2 size={16} /> 清空垃圾桶</button></div>)}
              </div>
          </div>
      )}

      {showDataModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
                  <div className="flex-none bg-slate-800 rounded-t-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Library size={20} className="text-emerald-500" /> 資料管理</h3><button onClick={() => setShowDataModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button></div>
                    <div className="flex"><button onClick={() => setActiveModalTab('import')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeModalTab === 'import' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>匯入資料</button><button onClick={() => setActiveModalTab('export')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeModalTab === 'export' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>匯出分享</button></div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
                      {activeModalTab === 'import' ? (<div className="space-y-4"><p className="text-sm text-slate-400">請貼上其他裝置分享的 JSON 資料：</p><textarea value={importJson} onChange={e => setImportJson(e.target.value)} placeholder='[{"name":"Catan", ...}]' className="w-full h-64 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none"/>{importError && <p className="text-red-400 text-xs flex items-center gap-1"><X size={12}/> {importError}</p>}<button onClick={handleImportJSON} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50">匯入至我的遊戲庫</button></div>) : (<div className="space-y-4"><p className="text-sm text-slate-400">選擇要匯出的遊戲：</p><div className="bg-slate-800 rounded-xl border border-slate-700 max-h-64 overflow-y-auto no-scrollbar p-2 space-y-1">{userTemplates.length === 0 && <p className="text-center text-xs text-slate-500 py-4">沒有可匯出的自訂遊戲</p>}{userTemplates.map(t => (<div key={t.id} onClick={() => toggleExportSelection(t.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${exportSelectedIds.includes(t.id) ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-transparent border-transparent hover:bg-slate-700'}`}><span className={`text-sm ${exportSelectedIds.includes(t.id) ? 'text-indigo-200 font-bold' : 'text-slate-300'}`}>{t.name}</span>{exportSelectedIds.includes(t.id) && <Check size={16} className="text-indigo-400" />}</div>))}</div><div className="flex gap-2"><button onClick={() => setExportSelectedIds(userTemplates.map(t => t.id))} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2">全選</button><button onClick={() => setExportSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-400 px-2">取消全選</button></div><div className="grid grid-cols-2 gap-3 pt-2"><button onClick={handleExportCopy} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>{isExportCopying ? <Check size={18} /> : <Copy size={18} />} 複製 JSON</button><button onClick={handleShareToDev} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}><Mail size={18} /> 投稿給開發者</button></div><p className="text-[10px] text-slate-500 text-center">投稿將開啟您的郵件軟體，開發者審核後將加入內建遊戲庫。</p></div>)}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
