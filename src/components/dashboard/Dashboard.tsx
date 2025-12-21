
import React, { useState } from 'react';
import { GameTemplate } from '../../types';
import { DEFAULT_TEMPLATES } from '../../constants';
import { Plus, Download, Dice5, Search, X, ChevronDown, ChevronRight, Pin, LayoutGrid, ArrowRightLeft, Library, Sparkles, RefreshCw, Copy, Code, Trash2, Check, Mail, HelpCircle } from 'lucide-react';
import ConfirmationModal from '../shared/ConfirmationModal';
import InstallGuideModal from '../modals/InstallGuideModal';
import { useToast } from '../../hooks/useToast';

interface DashboardProps {
  userTemplates: GameTemplate[];
  systemOverrides: Record<string, GameTemplate>;
  systemTemplates: GameTemplate[]; // New prop: Pre-migrated system templates
  pinnedIds: string[];
  knownSysIds: string[];
  onTemplateSelect: (template: GameTemplate) => void;
  onTemplateCreate: () => void;
  onTemplateDelete: (id: string) => void;
  onTemplateSave: (template: GameTemplate) => void; // For restore copy
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
  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  // Modal / Interaction State
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false); // New state for install guide
  const [activeModalTab, setActiveModalTab] = useState<'import' | 'export'>('import');
  
  // Import/Export State
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([]);
  
  // Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportCopying, setIsExportCopying] = useState(false);
  
  const { showToast } = useToast();

  // --- Helpers ---
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

  // --- Handlers ---

  const handleCopyJSON = (template: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      const json = JSON.stringify(template, null, 2);
      navigator.clipboard.writeText(json).then(() => {
          setCopiedId(template.id);
          setTimeout(() => setCopiedId(null), 2000);
      });
  };

  const handleCopySystemTemplate = (template: GameTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTemplate: GameTemplate = {
        ...JSON.parse(JSON.stringify(template)), // Deep copy
        id: crypto.randomUUID(),
        createdAt: Date.now(),
    };
    onTemplateSave(newTemplate);
  };

  const handleImportJSON = () => {
      try {
          setImportError(null);
          if (!importJson.trim()) return;
          const parsed = JSON.parse(importJson);
          
          let itemsToImport: any[] = [];
          if (Array.isArray(parsed)) {
              itemsToImport = parsed;
          } else {
              itemsToImport = [parsed];
          }
          
          const validTemplates: GameTemplate[] = [];
          itemsToImport.forEach(item => {
              if (!item.name || !Array.isArray(item.columns)) {
                  throw new Error(`格式錯誤：${item.name || '未命名'} 缺少必要欄位`);
              }
              // Regenerate IDs
              validTemplates.push({
                  ...item,
                  id: crypto.randomUUID(),
                  createdAt: Date.now(),
                  columns: item.columns.map((col: any) => ({ ...col, id: col.id || crypto.randomUUID() }))
              });
          });

          if (validTemplates.length > 0) {
            onBatchImport(validTemplates);
            setShowDataModal(false);
            setImportJson('');
            
            const MAX_NAMES_TO_SHOW = 5;
            const namesToShow = validTemplates.slice(0, MAX_NAMES_TO_SHOW).map(t => `- ${t.name}`);
            let message = namesToShow.join('\n');
            if (validTemplates.length > MAX_NAMES_TO_SHOW) {
                const remaining = validTemplates.length - MAX_NAMES_TO_SHOW;
                message += `\n...與其他 ${remaining} 筆`;
            }

            showToast({ 
                title: `成功匯入 ${validTemplates.length} 筆範本`, 
                message: message, 
                type: 'success',
                duration: 7000 // A bit longer to allow reading
            });

          } else {
              setImportError("沒有可匯入的有效資料");
          }
      } catch (e: any) {
          setImportError(e.message || "無效的 JSON 格式");
      }
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
          const dateStr = new Date().toLocaleDateString();
          const subject = `【萬用桌遊計分板】分享遊戲模板 (${dateStr})`;
          const body = `開發者你好！這是我製作的計分板\n↓↓↓ 資料已複製，請在下方貼上(Ctrl+V)↓↓↓\n--------------------------------------------------\n\n--------------------------------------------------`;
          window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }).catch(err => {
          console.error("Failed to copy:", err);
          showToast({ title: "自動複製失敗", message: "請手動複製後再寄信。", type: 'error' });
      });
  };

  const toggleExportSelection = (id: string) => {
      setExportSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
      {/* Header */}
      <header className="p-2.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center gap-2 shadow-md h-[58px] shrink-0">
        {isSearchActive ? (
          <div className="flex items-center gap-2 w-full animate-in fade-in duration-300">
            <Search size={20} className="text-emerald-500 shrink-0 ml-1" />
            <input 
                type="text"
                placeholder="搜尋遊戲..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-white focus:outline-none placeholder-slate-500"
            />
            <button 
                onClick={() => { setIsSearchActive(false); setSearchQuery(''); }}
                className="text-slate-400 hover:text-white p-2"
            >
                <X size={20} />
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-emerald-500">
              <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                <Dice5 size={24} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">萬用桌遊計分板</h1>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsSearchActive(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                  <Search size={20} />
                </button>
                
                {/* 
                  INSTALL BUTTON LOGIC:
                  1. If installed (PWA mode), hide completely.
                  2. If NOT installed:
                     a) If native prompt available (canInstall=true): Show standard "Install App" btn.
                     b) If native prompt unavailable (iOS/Desktop): Show "How to Install" btn (Download + ?)
                */}
                {!isInstalled && (
                  <button
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg active:scale-95 ${canInstall ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'}`}
                    onClick={canInstall ? onInstallClick : () => setShowInstallHelp(true)}
                  >
                      {/* Icon Composition */}
                      <div className="relative">
                        <Download size={14} />
                        {!canInstall && (
                           <HelpCircle size={10} className="absolute -bottom-1 -right-1.5 text-yellow-400 bg-slate-900 rounded-full" strokeWidth={3} />
                        )}
                      </div>
                      
                      <span className="hidden sm:inline">{canInstall ? '安裝 App' : '下載 App'}</span>
                  </button>
                )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        
        {/* Pinned Section */}
        {pinnedTemplates.length > 0 && (
            <div className="space-y-2">
                <div onClick={() => setIsPinnedLibOpen(!isPinnedLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                        {isPinnedLibOpen ? <ChevronDown size={20} className="text-yellow-400"/> : <ChevronRight size={20} className="text-slate-500"/>}
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Pin size={18} className="text-yellow-400" /> 已釘選 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredPinnedTemplates.length}</span>
                        </h3>
                    </div>
                </div>
                {isPinnedLibOpen && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {filteredPinnedTemplates.map(t => (
                            <div key={`pinned-${t.id}`} onClick={() => onTemplateSelect(t)} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group">
                                <h3 className="text-sm font-bold leading-tight line-clamp-2 pr-8 text-white">{t.name}</h3>
                                <button onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }} className="absolute top-1 right-1 p-1.5 text-yellow-400 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors"><Pin size={16} fill="currentColor" /></button>
                                <button onClick={(e) => handleCopyJSON(t, e)} className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-emerald-400 rounded transition-colors">{copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* User Library */}
        <div className="space-y-2">
            <div onClick={() => setIsUserLibOpen(!isUserLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                    {isUserLibOpen ? <ChevronDown size={20} className="text-emerald-500"/> : <ChevronRight size={20} className="text-slate-500"/>}
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <LayoutGrid size={18} className="text-emerald-500" /> 我的遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredUserTemplates.length}</span>
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setActiveModalTab('import'); setShowDataModal(true); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><ArrowRightLeft size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onTemplateCreate(); }} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg active:scale-95"><Plus size={14} /> 新增</button>
                </div>
            </div>
            {isUserLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {userTemplatesToShow.length === 0 && <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">還沒有建立遊戲模板</div>}
                    {filteredUserTemplates.map(t => (
                        <div key={t.id} onClick={() => onTemplateSelect(t)} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-emerald-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group">
                            <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 pr-8">{t.name}</h3>
                            <button onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }} className="absolute top-1 right-1 p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-slate-700 rounded-md transition-colors"><Pin size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setTemplateToDelete(t.id); }} className="absolute bottom-1 left-1 p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"><Trash2 size={16} /></button>
                            <button onClick={(e) => handleCopyJSON(t, e)} className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-emerald-400 rounded transition-colors">{copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}</button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* System Library */}
        <div className="space-y-2">
            <div onClick={() => setIsSystemLibOpen(!isSystemLibOpen)} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                    {isSystemLibOpen ? <ChevronDown size={20} className="text-indigo-400"/> : <ChevronRight size={20} className="text-slate-500"/>}
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Library size={18} className="text-indigo-400" /> 內建遊戲庫 <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredSystemTemplates.length}</span>
                    </h3>
                </div>
                {newSystemTemplatesCount > 0 && !searchQuery && (
                    <button onClick={(e) => { e.stopPropagation(); onMarkSystemSeen(); setIsSystemLibOpen(true); }} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse"><Sparkles size={14} /> 發現 {newSystemTemplatesCount} 個新遊戲</button>
                )}
            </div>
            {isSystemLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {filteredSystemTemplates.map(t => (
                        <div key={t.id} onClick={() => onTemplateSelect(t)} className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-indigo-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group">
                            <h3 className="text-sm font-bold text-indigo-100 leading-tight line-clamp-2 pr-8">{t.name}</h3>
                            <button onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }} className="absolute top-1 right-1 p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-slate-700 rounded-md transition-colors"><Pin size={16} /></button>
                            <div className="absolute bottom-1 left-1">
                                {systemOverrides[t.id] ? (
                                    <button onClick={(e) => { e.stopPropagation(); setRestoreTarget(t); }} className="flex items-center gap-1 text-[9px] text-yellow-500 font-normal border border-yellow-500/30 px-1.5 py-0.5 rounded hover:bg-yellow-900/20"><RefreshCw size={8} /> 備份並還原</button>
                                ) : (
                                    <button onClick={(e) => handleCopySystemTemplate(t, e)} className="flex items-center gap-1 text-[10px] text-slate-300 font-bold bg-slate-700/50 hover:bg-slate-700 px-1.5 py-1 rounded-md"><Copy size={11} /> 建立副本</button>
                                )}
                            </div>
                            <button onClick={(e) => handleCopyJSON(t, e)} className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-indigo-400 rounded transition-colors">{copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </main>

      {/* Modals */}
      <ConfirmationModal isOpen={!!templateToDelete} title="確定刪除此模板？" message="此動作將無法復原。" confirmText="刪除" isDangerous={true} onCancel={() => setTemplateToDelete(null)} onConfirm={() => { if(templateToDelete) onTemplateDelete(templateToDelete); setTemplateToDelete(null); }} />
      <ConfirmationModal isOpen={!!restoreTarget} title="備份修改並還原？" message="此動作將把您目前的修改備份到「我的遊戲庫」，並將此內建遊戲還原為官方最新版本。" confirmText="備份並還原" onCancel={() => setRestoreTarget(null)} onConfirm={() => { if(restoreTarget) { const backup = { ...restoreTarget, id: crypto.randomUUID(), name: `${restoreTarget.name} (備份)`, createdAt: Date.now() }; onTemplateSave(backup); onRestoreSystem(restoreTarget.id); setRestoreTarget(null); } }} />
      <InstallGuideModal isOpen={showInstallHelp} onClose={() => setShowInstallHelp(false)} />

      {/* Data Modal */}
      {showDataModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
                  <div className="flex-none bg-slate-800 rounded-t-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Library size={20} className="text-emerald-500" /> 資料管理</h3><button onClick={() => setShowDataModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button></div>
                    <div className="flex">
                        <button onClick={() => setActiveModalTab('import')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeModalTab === 'import' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>匯入資料</button>
                        <button onClick={() => setActiveModalTab('export')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeModalTab === 'export' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>匯出分享</button>
                    </div>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
                      {activeModalTab === 'import' ? (
                          <div className="space-y-4">
                              <p className="text-sm text-slate-400">請貼上其他裝置分享的 JSON 資料：</p>
                              <textarea 
                                value={importJson}
                                onChange={e => setImportJson(e.target.value)}
                                placeholder='[{"name":"Catan", ...}]'
                                className="w-full h-64 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none"
                              />
                              {importError && <p className="text-red-400 text-xs flex items-center gap-1"><X size={12}/> {importError}</p>}
                              <button onClick={handleImportJSON} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/50">匯入至我的遊戲庫</button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <p className="text-sm text-slate-400">選擇要匯出的遊戲：</p>
                              <div className="bg-slate-800 rounded-xl border border-slate-700 max-h-64 overflow-y-auto no-scrollbar p-2 space-y-1">
                                  {userTemplates.length === 0 && <p className="text-center text-xs text-slate-500 py-4">沒有可匯出的自訂遊戲</p>}
                                  {userTemplates.map(t => (
                                      <div key={t.id} onClick={() => toggleExportSelection(t.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${exportSelectedIds.includes(t.id) ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-transparent border-transparent hover:bg-slate-700'}`}>
                                          <span className={`text-sm ${exportSelectedIds.includes(t.id) ? 'text-indigo-200 font-bold' : 'text-slate-300'}`}>{t.name}</span>
                                          {exportSelectedIds.includes(t.id) && <Check size={16} className="text-indigo-400" />}
                                      </div>
                                  ))}
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => setExportSelectedIds(userTemplates.map(t => t.id))} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2">全選</button>
                                  <button onClick={() => setExportSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-400 px-2">取消全選</button>
                              </div>
                              <div className="grid grid-cols-2 gap-3 pt-2">
                                  <button onClick={handleExportCopy} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                                      {isExportCopying ? <Check size={18} /> : <Copy size={18} />} 複製 JSON
                                  </button>
                                  <button onClick={handleShareToDev} disabled={exportSelectedIds.length === 0} className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${exportSelectedIds.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                                      <Mail size={18} /> 投稿給開發者
                                  </button>
                              </div>
                              <p className="text-[10px] text-slate-500 text-center">投稿將開啟您的郵件軟體，開發者審核後將加入內建遊戲庫。</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
