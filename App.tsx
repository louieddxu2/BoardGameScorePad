

import React, { useState, useEffect, useCallback } from 'react';
import { AppView, GameTemplate, GameSession, Player } from './types';
import { DEFAULT_TEMPLATES, COLORS } from './src/constants';
import { calculatePlayerTotal } from './utils/scoring';
import TemplateEditor from './components/TemplateEditor';
import SessionView from './components/SessionView';
import ConfirmationModal from './components/shared/ConfirmationModal';
import { Plus, Play, Trash2, Dice5, Users, X, Minus, ChevronDown, ChevronRight, LayoutGrid, Library, FolderInput, Code, Check, Sparkles, RefreshCw, ArchiveRestore, Download } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  
  // Data State
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [systemOverrides, setSystemOverrides] = useState<Record<string, GameTemplate>>({});
  const [knownSysIds, setKnownSysIds] = useState<string[]>([]); // Track which system IDs user has seen
  
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  
  // UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);
  const [setupPlayerCount, setSetupPlayerCount] = useState(4);
  const [playerHistory, setPlayerHistory] = useState<string[]>([]);
  
  // Modal States
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null); // For system restore confirmation
  
  // Dashboard Sections
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // PWA Install Prompt State
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // --- PWA Install Logic ---
  useEffect(() => {
    // 優先檢查 localStorage 中是否已記錄安裝狀態
    const pwaInstalled = localStorage.getItem('pwa_installed') === 'true';

    // 檢查 App 是否已在獨立模式下運行
    if (pwaInstalled || window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return; // 如果已安裝，則無需監聽安裝提示
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      console.log("`beforeinstallprompt` event was fired.");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const handleAppInstalled = () => {
        console.log('PWA was installed');
        // 使用 localStorage 永久記錄安裝狀態
        localStorage.setItem('pwa_installed', 'true');
        setIsInstalled(true);
        setInstallPromptEvent(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
        window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);


  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setInstallPromptEvent(null);
  };

  // --- Initial Load ---
  useEffect(() => {
    try {
        // Load User Templates
        const savedTemplates = localStorage.getItem('sm_templates');
        const parsedUserTemplates = savedTemplates ? JSON.parse(savedTemplates) : [];

        // Load System Overrides
        const savedOverrides = localStorage.getItem('sm_system_overrides');
        const parsedOverrides = savedOverrides ? JSON.parse(savedOverrides) : {};
        setSystemOverrides(parsedOverrides);
        
        // Load Known System IDs
        const savedKnownIds = localStorage.getItem('sm_known_sys_ids');
        const parsedKnownIds = savedKnownIds ? JSON.parse(savedKnownIds) : [];
        setKnownSysIds(parsedKnownIds);

        setTemplates(parsedUserTemplates);

    } catch(e) {
        console.error("Init Error", e);
        setTemplates([]);
    }
  }, []);

  // --- Restore Session ---
  useEffect(() => {
    try {
        const savedSession = localStorage.getItem('sm_current_session');
        const savedActiveTemplateId = localStorage.getItem('sm_active_template_id');
        const savedHistory = localStorage.getItem('sm_player_history');
        
        if (savedHistory) setPlayerHistory(JSON.parse(savedHistory));

        if (savedSession && savedActiveTemplateId) {
            const session = JSON.parse(savedSession);
            
            // Reconstruct the template source
            // 1. Check user templates
            let template = templates.find(t => t.id === savedActiveTemplateId);
            
            // 2. Check system overrides
            if (!template && systemOverrides[savedActiveTemplateId]) {
                template = systemOverrides[savedActiveTemplateId];
            }

            // 3. Check defaults
            if (!template) {
                template = DEFAULT_TEMPLATES.find(t => t.id === savedActiveTemplateId);
            }

            if (template && session) {
                setCurrentSession(session);
                setActiveTemplate(template);
                setView(AppView.ACTIVE_SESSION);
            }
        }
    } catch (e) {
        console.error("Failed to restore session", e);
    }
  }, [templates, systemOverrides]);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('sm_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('sm_system_overrides', JSON.stringify(systemOverrides));
  }, [systemOverrides]);
  
  useEffect(() => {
    localStorage.setItem('sm_known_sys_ids', JSON.stringify(knownSysIds));
  }, [knownSysIds]);

  useEffect(() => {
    if (currentSession && activeTemplate) {
        localStorage.setItem('sm_current_session', JSON.stringify(currentSession));
        localStorage.setItem('sm_active_template_id', activeTemplate.id);
    } else {
        localStorage.removeItem('sm_current_session');
        localStorage.removeItem('sm_active_template_id');
    }
  }, [currentSession, activeTemplate]);


  // --- Logic Helpers ---

  // Check if an ID belongs to the system defaults
  const isSystemTemplate = (id: string) => DEFAULT_TEMPLATES.some(dt => dt.id === id);

  // Get the effective system template (Default OR Overridden)
  const getSystemTemplates = () => {
      return DEFAULT_TEMPLATES.map(dt => {
          return systemOverrides[dt.id] ? systemOverrides[dt.id] : dt;
      });
  };
  
  // Calculate new templates
  const newSystemTemplatesCount = DEFAULT_TEMPLATES.filter(dt => !knownSysIds.includes(dt.id)).length;

  const handleUpdatePlayerHistory = (newName: string) => {
      if (!newName.trim()) return;
      const cleanName = newName.trim();
      setPlayerHistory(prev => {
          const filtered = prev.filter(n => n !== cleanName);
          const updated = [cleanName, ...filtered].slice(0, 20);
          localStorage.setItem('sm_player_history', JSON.stringify(updated));
          return updated;
      });
  };

  const handleSaveTemplate = (template: GameTemplate) => {
    setTemplates(prev => [template, ...prev]);
    setView(AppView.DASHBOARD);
    setIsUserLibOpen(true);
  };

  const initSetup = (template: GameTemplate) => {
    setPendingTemplate(template);
    setSetupPlayerCount(4);
  };

  const handleConfirmSetup = () => {
    if (!pendingTemplate) return;

    const players: Player[] = [];
    for (let i = 0; i < setupPlayerCount; i++) {
        players.push({
            id: crypto.randomUUID(),
            name: `玩家 ${i + 1}`,
            scores: {},
            totalScore: 0,
            color: COLORS[i % COLORS.length]
        });
    }

    const newSession: GameSession = {
      id: crypto.randomUUID(),
      templateId: pendingTemplate.id,
      startTime: Date.now(),
      players: players,
      status: 'active'
    };

    setActiveTemplate(pendingTemplate);
    setCurrentSession(newSession);
    setView(AppView.ACTIVE_SESSION);
    setPendingTemplate(null);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateToDelete(id);
  };

  const confirmDeleteTemplate = () => {
      if (templateToDelete) {
          setTemplates(prev => prev.filter(t => t.id !== templateToDelete));
          setTemplateToDelete(null);
      }
  };

  const handleCopyJSON = (template: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      const json = JSON.stringify(template, null, 2);
      navigator.clipboard.writeText(json).then(() => {
          setCopiedId(template.id);
          setTimeout(() => setCopiedId(null), 2000);
      });
  };

  const handleImportJSON = () => {
      try {
          setImportError(null);
          if (!importJson.trim()) return;
          const parsed = JSON.parse(importJson);
          
          // Basic Validation
          if (!parsed.name || !Array.isArray(parsed.columns)) {
              throw new Error("格式錯誤：缺少必要欄位 (name, columns)");
          }

          // Force new ID to treat as a user template
          parsed.id = crypto.randomUUID();
          parsed.createdAt = Date.now();
          
          // Ensure column IDs exist
          parsed.columns = parsed.columns.map((col: any) => ({
              ...col,
              id: col.id || crypto.randomUUID()
          }));

          handleSaveTemplate(parsed);
          setShowImportModal(false);
          setImportJson('');
      } catch (e) {
          setImportError("無效的 JSON 格式或資料不完整");
      }
  };
  
  // Sync new system templates (mark all as known)
  const handleSyncNewTemplates = (e: React.MouseEvent) => {
      e.stopPropagation();
      const allIds = DEFAULT_TEMPLATES.map(t => t.id);
      setKnownSysIds(allIds);
      setIsSystemLibOpen(true); // Auto open to show
  };
  
  // Restore System Template Logic
  const handleRestoreSystem = () => {
      if (!restoreTarget) return;
      
      // 1. Backup current override to user templates
      const backup: GameTemplate = {
          ...restoreTarget,
          id: crypto.randomUUID(),
          name: `${restoreTarget.name} (備份)`,
          createdAt: Date.now()
      };
      setTemplates(prev => [backup, ...prev]);
      
      // 2. Remove override
      const newOverrides = { ...systemOverrides };
      delete newOverrides[restoreTarget.id];
      setSystemOverrides(newOverrides);
      
      setRestoreTarget(null);
  };

  // --- Session Updates ---

  const handleSessionUpdate = useCallback((updatedSession: GameSession) => {
    if (activeTemplate) {
        const playersWithTotal = updatedSession.players.map(p => ({
            ...p,
            totalScore: calculatePlayerTotal(p, activeTemplate)
        }));
        setCurrentSession({ ...updatedSession, players: playersWithTotal });
    } else {
        setCurrentSession(updatedSession);
    }
  }, [activeTemplate]);

  const handleTemplateUpdate = (updatedTemplate: GameTemplate) => {
      setActiveTemplate(updatedTemplate);

      // Persist the update
      if (isSystemTemplate(updatedTemplate.id)) {
          // It's a system template -> Save to Overrides
          const newOverrides = { ...systemOverrides, [updatedTemplate.id]: updatedTemplate };
          setSystemOverrides(newOverrides);
      } else {
          // It's a user template -> Save to Templates list
          setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
      }
      
      // Recalculate scores if columns changed
      if (currentSession) {
          const updatedPlayers = currentSession.players.map(player => ({
             ...player,
             totalScore: calculatePlayerTotal(player, updatedTemplate)
          }));
          setCurrentSession({ ...currentSession, players: updatedPlayers });
      }
  };

  const handleResetScores = () => {
    if (!currentSession) return;
    
    const resetPlayers = currentSession.players.map(p => ({
        ...p,
        scores: {},
        totalScore: 0
    }));
    
    const newSession: GameSession = {
        ...currentSession,
        id: crypto.randomUUID(),
        players: resetPlayers,
        startTime: Date.now()
    };
    
    setCurrentSession(newSession);
    localStorage.setItem('sm_current_session', JSON.stringify(newSession));
  };

  const adjustSetupCount = (delta: number) => {
    const newCount = Math.max(1, Math.min(12, setupPlayerCount + delta));
    setSetupPlayerCount(newCount);
  };


  // --- Render Components ---

  if (view === AppView.TEMPLATE_CREATOR) {
    return <TemplateEditor onSave={handleSaveTemplate} onCancel={() => setView(AppView.DASHBOARD)} />;
  }

  if (view === AppView.ACTIVE_SESSION && currentSession && activeTemplate) {
    return (
      <SessionView 
        key={currentSession.id}
        session={currentSession} 
        template={activeTemplate} 
        playerHistory={playerHistory}
        onUpdateSession={handleSessionUpdate}
        onUpdatePlayerHistory={handleUpdatePlayerHistory}
        onResetScores={handleResetScores}
        onUpdateTemplate={handleTemplateUpdate}
        onExit={() => {
            localStorage.removeItem('sm_current_session');
            localStorage.removeItem('sm_active_template_id');
            setCurrentSession(null);
            setView(AppView.DASHBOARD);
        }}
      />
    );
  }

  const effectiveSystemTemplates = getSystemTemplates();

  const canInstall = !!installPromptEvent;

  // Dashboard Render
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2 text-emerald-500">
          <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
            <Dice5 size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">萬用桌遊計分板 BoardGameScorePad</h1>
        </div>
        <div className="flex items-center gap-2">
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                disabled={!canInstall}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  canInstall
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50 active:scale-95'
                    : 'bg-slate-700 text-slate-500 cursor-wait'
                }`}
                title={
                  canInstall
                    ? '安裝應用程式以便離線使用'
                    : '等待安裝條件滿足 (請與頁面互動)'
                }
              >
                <Download size={14} />
                {'安裝 App'}
              </button>
            )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* User Library Section */}
        <div className="space-y-2">
            <div 
                className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => setIsUserLibOpen(!isUserLibOpen)}
            >
                <div className="flex items-center gap-2">
                    {isUserLibOpen ? <ChevronDown size={20} className="text-emerald-500"/> : <ChevronRight size={20} className="text-slate-500"/>}
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <LayoutGrid size={18} className="text-emerald-500" />
                        我的遊戲庫
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{templates.length}</span>
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowImportModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="匯入 JSON"
                    >
                        <FolderInput size={18} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setView(AppView.TEMPLATE_CREATOR);
                        }}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-900/50 transition-all active:scale-95"
                    >
                        <Plus size={14} /> 新增
                    </button>
                </div>
            </div>

            {isUserLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {templates.length === 0 && (
                         <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">
                            還沒有建立遊戲模板
                         </div>
                    )}
                    {templates.map(t => (
                        <div 
                            key={t.id}
                            onClick={() => initSetup(t)}
                            className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-emerald-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col justify-between h-20 group"
                        >
                            <div className="pr-6">
                                <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{t.name}</h3>
                            </div>
                            
                            <div className="flex justify-end items-end mt-1">
                                <button 
                                    onClick={(e) => handleCopyJSON(t, e)}
                                    className="p-1.5 text-slate-600 hover:text-emerald-400 rounded transition-colors"
                                    title="複製 JSON"
                                >
                                    {copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}
                                </button>
                            </div>

                            <button 
                                onClick={(e) => handleDeleteTemplate(t.id, e)}
                                className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors pointer-events-auto"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* System Library Section */}
        <div className="space-y-2">
            <div 
                className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => setIsSystemLibOpen(!isSystemLibOpen)}
            >
                <div className="flex items-center gap-2">
                    {isSystemLibOpen ? <ChevronDown size={20} className="text-indigo-400"/> : <ChevronRight size={20} className="text-slate-500"/>}
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Library size={18} className="text-indigo-400" />
                        內建遊戲庫
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{effectiveSystemTemplates.length}</span>
                    </h3>
                </div>
                {newSystemTemplatesCount > 0 && (
                    <button 
                        onClick={handleSyncNewTemplates}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-900/50 transition-all animate-pulse"
                    >
                        <Sparkles size={14} /> 發現 {newSystemTemplatesCount} 個新遊戲
                    </button>
                )}
            </div>

            {isSystemLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {effectiveSystemTemplates.map(t => (
                        <div 
                            key={t.id}
                            onClick={() => initSetup(t)}
                            className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-indigo-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col justify-between h-20"
                        >
                            <div className="pr-6">
                                <h3 className="text-sm font-bold text-indigo-100 leading-tight line-clamp-2">{t.name}</h3>
                                {systemOverrides[t.id] && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRestoreTarget(t);
                                        }}
                                        className="flex items-center gap-1 mt-1 text-[9px] text-yellow-500 font-normal border border-yellow-500/30 px-1.5 py-0.5 rounded hover:bg-yellow-900/20 transition-colors"
                                    >
                                        <RefreshCw size={8} /> 已修改 (還原)
                                    </button>
                                )}
                            </div>
                            <div className="flex justify-end items-end mt-1">
                                <button 
                                    onClick={(e) => handleCopyJSON(t, e)}
                                    className="p-1.5 text-slate-600 hover:text-indigo-400 rounded transition-colors"
                                    title="複製 JSON"
                                >
                                    {copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </main>

      <ConfirmationModal 
            isOpen={!!templateToDelete}
            title="確定刪除此模板？"
            message="此動作將無法復原。"
            confirmText="刪除"
            isDangerous={true}
            onCancel={() => setTemplateToDelete(null)}
            onConfirm={confirmDeleteTemplate}
      />
      
      <ConfirmationModal 
            isOpen={!!restoreTarget}
            title="備份修改並還原？"
            message="此動作將把您目前的修改備份到「我的遊戲庫」，並將此內建遊戲還原為官方最新版本。"
            confirmText="備份並還原"
            cancelText="取消"
            isDangerous={false}
            onCancel={() => setRestoreTarget(null)}
            onConfirm={handleRestoreSystem}
      />
      
      {/* Import Modal */}
      {showImportModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white">匯入 JSON 模板</h3>
                      <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                  </div>
                  <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
                      <p className="text-sm text-slate-400">請貼上其他裝置分享的模板 JSON 代碼。</p>
                      <textarea 
                          className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none"
                          placeholder='{"name": "...", "columns": [...] }'
                          value={importJson}
                          onChange={(e) => setImportJson(e.target.value)}
                      />
                      {importError && (
                          <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-500/20">
                              {importError}
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t border-slate-800">
                      <button 
                          onClick={handleImportJSON}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                      >
                          <FolderInput size={20} /> 確認匯入
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Setup Game Modal */}
      {pendingTemplate && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-base font-bold text-white truncate pr-2">{pendingTemplate.name}</h3>
                      <button onClick={() => setPendingTemplate(null)} className="text-slate-500 hover:text-white shrink-0">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6 flex flex-col items-center">
                      <label className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                          設定玩家人數
                      </label>
                      <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-700 w-full max-w-[200px] justify-between">
                          <button 
                            onClick={() => adjustSetupCount(-1)}
                            className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white transition-colors active:scale-95"
                          >
                              <Minus size={20} />
                          </button>
                          <span className="text-2xl font-bold font-mono text-emerald-400">{setupPlayerCount}</span>
                          <button 
                            onClick={() => adjustSetupCount(1)}
                            className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white transition-colors active:scale-95"
                          >
                              <Plus size={20} />
                          </button>
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
                      <button 
                          onClick={handleConfirmSetup}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                      >
                          <Play size={18} fill="currentColor" /> 開始計分
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;