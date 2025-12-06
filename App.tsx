import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, GameTemplate, GameSession, Player } from './types';
import { DEFAULT_TEMPLATES, COLORS } from './src/constants';
import { calculatePlayerTotal } from './utils/scoring';
import TemplateEditor from './components/TemplateEditor';
import SessionView from './components/SessionView';
import ConfirmationModal from './components/shared/ConfirmationModal';
import { Plus, Play, Trash2, Dice5, Users, X, Minus, ChevronDown, ChevronRight, LayoutGrid, Library, FolderInput, Code, Check, Sparkles, RefreshCw, ArchiveRestore, Download, Copy, CheckSquare, Square, ArrowRightLeft, Mail, Send, Pin, Search } from 'lucide-react';

// --- Helper Functions ---
const getTouchDistance = (touches: TouchList): number => {
  const [touch1, touch2] = [touches[0], touches[1]];
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  
  // Data State
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [systemOverrides, setSystemOverrides] = useState<Record<string, GameTemplate>>({});
  const [knownSysIds, setKnownSysIds] = useState<string[]>([]); // Track which system IDs user has seen
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<GameTemplate | null>(null);
  
  // UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);
  const [setupPlayerCount, setSetupPlayerCount] = useState(4);
  const [playerHistory, setPlayerHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Modal States
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  
  // Data Management Modal State
  const [showDataModal, setShowDataModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'import' | 'export'>('import');
  
  // Import State
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  
  // Export State
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([]);

  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null); // For system restore confirmation
  
  // Dashboard Sections
  const [isPinnedLibOpen, setIsPinnedLibOpen] = useState(true);
  const [isUserLibOpen, setIsUserLibOpen] = useState(true);
  const [isSystemLibOpen, setIsSystemLibOpen] = useState(true);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportCopying, setIsExportCopying] = useState(false);

  // PWA Install Prompt State
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // --- Mobile Pinch-to-Zoom Logic ---
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const touchStartDist = useRef(0);
  const initialZoomRef = useRef(1.0);
  const zoomIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply zoom on startup from localStorage
  useEffect(() => {
    const savedZoom = localStorage.getItem('app_zoom_level');
    if (savedZoom) {
      const newZoom = parseFloat(savedZoom);
      setZoomLevel(newZoom);
      document.documentElement.style.fontSize = `${16 * newZoom}px`;
    }
  }, []);

  // Handle touch events for pinch-to-zoom
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDist.current = getTouchDistance(e.touches);
        initialZoomRef.current = zoomLevel;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches);
        const scale = currentDist / touchStartDist.current;
        let newZoom = initialZoomRef.current * scale;
        
        // Clamp zoom level between 75% and 130%
        newZoom = Math.max(0.75, Math.min(1.3, newZoom));
        
        setZoomLevel(newZoom);
      }
    };

    const handleTouchEnd = () => {
      touchStartDist.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoomLevel]);
  
  // Effect to apply zoom and show indicator
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * zoomLevel}px`;
    localStorage.setItem('app_zoom_level', String(zoomLevel));
    
    if (touchStartDist.current > 0) { // Only show indicator during an active gesture
      setShowZoomIndicator(true);
      if (zoomIndicatorTimer.current) clearTimeout(zoomIndicatorTimer.current);
      
      zoomIndicatorTimer.current = setTimeout(() => {
        setShowZoomIndicator(false);
      }, 1500);
    }
    
    return () => {
      if (zoomIndicatorTimer.current) clearTimeout(zoomIndicatorTimer.current);
    };
  }, [zoomLevel]);


  // --- PWA Install Logic ---
  useEffect(() => {
    const pwaInstalled = localStorage.getItem('pwa_installed') === 'true';
    if (pwaInstalled || window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
        localStorage.setItem('pwa_installed', 'true');
        setIsInstalled(true);
        setInstallPromptEvent(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

  // --- Initial Load ---
  useEffect(() => {
    try {
        const savedTemplates = localStorage.getItem('sm_templates');
        const parsedUserTemplates = savedTemplates ? JSON.parse(savedTemplates) : [];

        const savedOverrides = localStorage.getItem('sm_system_overrides');
        const parsedOverrides = savedOverrides ? JSON.parse(savedOverrides) : {};
        setSystemOverrides(parsedOverrides);
        
        const savedKnownIds = localStorage.getItem('sm_known_sys_ids');
        const parsedKnownIds = savedKnownIds ? JSON.parse(savedKnownIds) : [];
        setKnownSysIds(parsedKnownIds);

        const savedPinnedIds = localStorage.getItem('sm_pinned_ids');
        const parsedPinnedIds = savedPinnedIds ? JSON.parse(savedPinnedIds) : [];
        setPinnedIds(parsedPinnedIds);

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
            
            let template = templates.find(t => t.id === savedActiveTemplateId);
            if (!template && systemOverrides[savedActiveTemplateId]) {
                template = systemOverrides[savedActiveTemplateId];
            }
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
    localStorage.setItem('sm_pinned_ids', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
    if (currentSession && activeTemplate) {
        localStorage.setItem('sm_current_session', JSON.stringify(currentSession));
        localStorage.setItem('sm_active_template_id', activeTemplate.id);
    } else {
        localStorage.removeItem('sm_current_session');
        localStorage.removeItem('sm_active_template_id');
    }
  }, [currentSession, activeTemplate]);

  // --- New, Robust Back Button / History Management ---
  useEffect(() => {
    const executeBackLogic = () => {
      // The hierarchy of what to close, from top-most layer to bottom.
      if (pendingTemplate) {
        setPendingTemplate(null);
        return true;
      }
      if (showDataModal) {
        setShowDataModal(false);
        return true;
      }
      if (templateToDelete) {
        setTemplateToDelete(null);
        return true;
      }
      if (restoreTarget) {
        setRestoreTarget(null);
        return true;
      }
      if (isSearchActive) {
        setIsSearchActive(false);
        setSearchQuery('');
        return true;
      }
      if (view === AppView.TEMPLATE_CREATOR) {
        setView(AppView.DASHBOARD);
        return true;
      }
      if (view === AppView.ACTIVE_SESSION) {
        // Delegate to SessionView. It will decide if it can handle the back press
        // (e.g., by closing a panel) or if it should call onExit.
        window.dispatchEvent(new CustomEvent('app-back-press'));
        // We assume session view will handle it, so we return true.
        // The final `onExit` call from SessionView will change the `view` state,
        // bringing us back to the dashboard.
        return true;
      }
      
      // If we've reached here, we are on the dashboard with nothing open.
      // There's nothing for the app to handle internally.
      return false;
    };

    const handlePopState = () => {
      const wasHandled = executeBackLogic();
      
      if (wasHandled) {
        // If we handled the back press internally (e.g., closed a modal),
        // we push a new state to "trap" the history, preventing an accidental app exit.
        history.pushState(null, '');
      }
      // If `wasHandled` is false, we do nothing, allowing the browser
      // to perform its default back action (e.g., exit the PWA).
    };

    window.addEventListener('popstate', handlePopState);
    
    // On component mount, we push an initial state. This ensures that the very
    // first back press from the root dashboard screen is caught by our listener.
    history.pushState(null, '');

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [view, isSearchActive, pendingTemplate, showDataModal, templateToDelete, restoreTarget]);

  // --- Logic Helpers ---
  const isSystemTemplate = (id: string) => DEFAULT_TEMPLATES.some(dt => dt.id === id);
  const getSystemTemplates = () => DEFAULT_TEMPLATES.map(dt => systemOverrides[dt.id] || dt);
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

  const handleBatchSaveTemplates = (newTemplates: GameTemplate[]) => {
      setTemplates(prev => [...newTemplates, ...prev]);
      setView(AppView.DASHBOARD);
      setIsUserLibOpen(true);
  };

  const initSetup = (template: GameTemplate) => {
    setPendingTemplate(template);
    setSetupPlayerCount(4);
  };

  const handleConfirmSetup = () => {
    if (!pendingTemplate) return;

    const players: Player[] = Array.from({ length: setupPlayerCount }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `玩家 ${i + 1}`,
      scores: {},
      totalScore: 0,
      color: COLORS[i % COLORS.length]
    }));

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

  const handleCopySystemTemplate = (template: GameTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTemplate: GameTemplate = {
        ...JSON.parse(JSON.stringify(template)), // Deep copy
        id: crypto.randomUUID(),
        createdAt: Date.now(),
    };
    setTemplates(prev => [newTemplate, ...prev]);
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setPinnedIds(prev => {
          if (prev.includes(id)) {
              return prev.filter(pinnedId => pinnedId !== id);
          } else {
              return [id, ...prev]; // Add to the front
          }
      });
  };

  // --- Batch Import / Export Logic ---
  
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
              
              // Regenerate IDs to avoid conflicts
              validTemplates.push({
                  ...item,
                  id: crypto.randomUUID(),
                  createdAt: Date.now(),
                  columns: item.columns.map((col: any) => ({ ...col, id: col.id || crypto.randomUUID() }))
              });
          });

          if (validTemplates.length > 0) {
            handleBatchSaveTemplates(validTemplates);
            setShowDataModal(false);
            setImportJson('');
            alert(`成功匯入 ${validTemplates.length} 筆模板！`);
          } else {
              setImportError("沒有可匯入的有效資料");
          }

      } catch (e: any) {
          setImportError(e.message || "無效的 JSON 格式");
      }
  };

  const toggleExportSelection = (id: string) => {
      setExportSelectedIds(prev => 
          prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
  };

  const handleSelectAllExport = () => {
      if (exportSelectedIds.length === templates.length) {
          setExportSelectedIds([]);
      } else {
          setExportSelectedIds(templates.map(t => t.id));
      }
  };

  const handleExportCopy = () => {
      const selectedTemplates = templates.filter(t => exportSelectedIds.includes(t.id));
      if (selectedTemplates.length === 0) return;

      const templateStrings = selectedTemplates.map(t => `  ${JSON.stringify(t)}`);
      const json = `[\n${templateStrings.join(',\n')}\n]`;
      
      navigator.clipboard.writeText(json).then(() => {
          setIsExportCopying(true);
          setTimeout(() => setIsExportCopying(false), 2000);
      });
  };

  const handleShareToDev = () => {
      const selectedTemplates = templates.filter(t => exportSelectedIds.includes(t.id));
      if (selectedTemplates.length === 0) return;

      const templateStrings = selectedTemplates.map(t => `  ${JSON.stringify(t)}`);
      const json = `[\n${templateStrings.join(',\n')}\n]`;
      
      navigator.clipboard.writeText(json).then(() => {
          setIsExportCopying(true);
          setTimeout(() => setIsExportCopying(false), 2000);

          const email = "louieddxu2@gmail.com";
          const dateStr = new Date().toLocaleDateString();
          const subject = `【萬用桌遊計分板】分享遊戲模板 (${dateStr})`;
          
          const body = `開發者你好！這是我製作的計分板
↓↓↓ 資料已複製，請在下方貼上(Ctrl+V)↓↓↓
貼上後按下「傳送」，有其他想法亦可分享。
--------------------------------------------------

--------------------------------------------------`;
          
          window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }).catch(err => {
          console.error("Failed to copy:", err);
          alert("自動複製失敗，請手動複製後再寄信。");
      });
  };
  
  const handleSyncNewTemplates = (e: React.MouseEvent) => {
      e.stopPropagation();
      const allIds = DEFAULT_TEMPLATES.map(t => t.id);
      setKnownSysIds(allIds);
      setIsSystemLibOpen(true);
  };
  
  const handleRestoreSystem = () => {
      if (!restoreTarget) return;
      
      const backup: GameTemplate = {
          ...restoreTarget,
          id: crypto.randomUUID(),
          name: `${restoreTarget.name} (備份)`,
          createdAt: Date.now()
      };
      setTemplates(prev => [backup, ...prev]);
      
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

      if (isSystemTemplate(updatedTemplate.id)) {
          setSystemOverrides(prev => ({ ...prev, [updatedTemplate.id]: updatedTemplate }));
      } else {
          setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
      }
      
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
    
    const resetPlayers = currentSession.players.map(p => ({ ...p, scores: {}, totalScore: 0 }));
    
    const newSession: GameSession = {
        ...currentSession,
        id: crypto.randomUUID(),
        players: resetPlayers,
        startTime: Date.now()
    };
    
    setCurrentSession(newSession);
  };

  const handleExitSession = () => {
      localStorage.removeItem('sm_current_session');
      localStorage.removeItem('sm_active_template_id');
      setCurrentSession(null);
      setView(AppView.DASHBOARD);
  };

  const adjustSetupCount = (delta: number) => {
    setSetupPlayerCount(prev => Math.max(1, Math.min(12, prev + delta)));
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
        onExit={handleExitSession}
      />
    );
  }

  const effectiveSystemTemplates = getSystemTemplates();
  const canInstall = !!installPromptEvent;

  // --- Dashboard Data Prep & Filtering ---
  const allSystemTemplates = getSystemTemplates();
  const allTemplates = [...templates, ...allSystemTemplates];

  const filterTemplates = (t: GameTemplate) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase());

  const pinnedTemplates = pinnedIds
    .map(id => allTemplates.find(t => t.id === id))
    .filter((t): t is GameTemplate => t !== undefined);

  const filteredPinnedTemplates = pinnedTemplates.filter(filterTemplates);
  const userTemplatesToShow = templates.filter(t => !pinnedIds.includes(t.id));
  const filteredUserTemplates = userTemplatesToShow.filter(filterTemplates);
  const systemTemplatesToShow = allSystemTemplates.filter(t => !pinnedIds.includes(t.id));
  const filteredSystemTemplates = systemTemplatesToShow.filter(filterTemplates);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="p-2.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center gap-2 shadow-md h-[58px]">
        
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
                onClick={() => {
                  setIsSearchActive(false);
                  setSearchQuery('');
                }}
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
                <button
                  onClick={() => setIsSearchActive(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Search size={20} />
                </button>
                <button
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    isInstalled
                      ? 'bg-transparent text-transparent pointer-events-none' // Visually hidden but present in DOM
                      : canInstall
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50 active:scale-95'
                        : 'bg-slate-700 text-slate-500 cursor-wait'
                  }`}
                  onClick={handleInstallClick}
                  disabled={!canInstall || isInstalled}
                >
                  {!isInstalled && (
                    <>
                      <Download size={14} />
                      <span className="hidden sm:inline">安裝 App</span>
                    </>
                  )}
                </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Pinned Section */}
        {pinnedTemplates.length > 0 && (
            <div className="space-y-2">
                <div 
                    className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => setIsPinnedLibOpen(!isPinnedLibOpen)}
                >
                    <div className="flex items-center gap-2">
                        {isPinnedLibOpen ? <ChevronDown size={20} className="text-yellow-400"/> : <ChevronRight size={20} className="text-slate-500"/>}
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <Pin size={18} className="text-yellow-400" />
                            已釘選
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredPinnedTemplates.length}</span>
                        </h3>
                    </div>
                </div>

                {isPinnedLibOpen && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {filteredPinnedTemplates.map(t => {
                            const isSystem = isSystemTemplate(t.id);
                            const cardBg = isSystem ? 'bg-slate-800' : 'bg-slate-800';
                            const cardHoverBg = isSystem ? 'hover:bg-slate-750' : 'hover:bg-slate-750';
                            const cardBorder = isSystem ? 'border-indigo-500/50' : 'border-emerald-500/50';
                            const cardTextColor = isSystem ? 'text-indigo-100' : 'text-white';
                            
                            return (
                                <div 
                                    key={`pinned-${t.id}`}
                                    onClick={() => initSetup(t)}
                                    className={`${cardBg} rounded-xl p-3 border border-slate-700 shadow-md ${cardHoverBg} hover:${cardBorder} transition-all cursor-pointer relative flex flex-col justify-between h-20 group`}
                                >
                                    <div className="pr-14">
                                        <h3 className={`text-sm font-bold leading-tight line-clamp-2 ${cardTextColor}`}>{t.name}</h3>
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
                                        onClick={(e) => handleTogglePin(t.id, e)}
                                        className="absolute top-2 right-2 p-1.5 text-yellow-400 bg-slate-700/50 hover:bg-slate-700 rounded-md transition-colors"
                                        title="取消釘選"
                                    >
                                        <Pin size={16} fill="currentColor" />
                                    </button>
                                </div>
                            );
                        })}
                        {pinnedTemplates.length > 0 && filteredPinnedTemplates.length === 0 && (
                            <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic">
                                在已釘選中找不到符合的遊戲
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}


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
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredUserTemplates.length}</span>
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setActiveModalTab('import');
                            setShowDataModal(true); 
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="資料管理 (匯入/匯出)"
                    >
                        <ArrowRightLeft size={18} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setView(AppView.TEMPLATE_CREATOR); }}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-900/50 transition-all active:scale-95"
                    >
                        <Plus size={14} /> 新增
                    </button>
                </div>
            </div>

            {isUserLibOpen && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {userTemplatesToShow.length === 0 && (
                         <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-slate-800 rounded-xl">
                            還沒有建立遊戲模板
                         </div>
                    )}
                    {userTemplatesToShow.length > 0 && filteredUserTemplates.length === 0 && (
                         <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic">
                            在我的遊戲庫中找不到符合的遊戲
                         </div>
                    )}
                    {filteredUserTemplates.map(t => (
                        <div 
                            key={t.id}
                            onClick={() => initSetup(t)}
                            className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-emerald-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col justify-between h-20 group"
                        >
                            <div className="pr-14">
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
                                onClick={(e) => handleTogglePin(t.id, e)}
                                className="absolute top-2 right-10 p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-slate-700 rounded-md transition-colors"
                                title="釘選"
                            >
                                <Pin size={16} />
                            </button>
                            <button 
                                onClick={(e) => handleDeleteTemplate(t.id, e)}
                                className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"
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
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{filteredSystemTemplates.length}</span>
                    </h3>
                </div>
                {newSystemTemplatesCount > 0 && !searchQuery && (
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
                    {systemTemplatesToShow.length > 0 && filteredSystemTemplates.length === 0 && (
                        <div className="col-span-2 text-center py-8 text-slate-500 text-sm italic">
                            在內建遊戲庫中找不到符合的遊戲
                        </div>
                    )}
                    {filteredSystemTemplates.map(t => (
                        <div 
                            key={t.id}
                            onClick={() => initSetup(t)}
                            className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-md hover:border-indigo-500/50 hover:bg-slate-750 transition-all cursor-pointer relative flex flex-col h-20 group"
                        >
                            <div className="pr-8">
                                <h3 className="text-sm font-bold text-indigo-100 leading-tight line-clamp-2">{t.name}</h3>
                            </div>
                            
                            {/* Pin Button - Top Right */}
                            <button
                                onClick={(e) => handleTogglePin(t.id, e)}
                                className="absolute top-1 right-1 p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-slate-700 rounded-md transition-colors"
                                title="釘選"
                            >
                                <Pin size={16} />
                            </button>
                            
                            {/* Create Copy/Restore Button - Bottom Left */}
                            <div className="absolute bottom-1 left-1">
                                {systemOverrides[t.id] ? (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setRestoreTarget(t); }}
                                        className="flex items-center gap-1 text-[9px] text-yellow-500 font-normal border border-yellow-500/30 px-1.5 py-0.5 rounded hover:bg-yellow-900/20 transition-colors"
                                    >
                                        <RefreshCw size={8} /> 備份並還原
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => handleCopySystemTemplate(t, e)}
                                        className="flex items-center gap-1 text-[10px] text-slate-300 font-bold bg-slate-700/50 hover:bg-slate-700 px-1.5 py-1 rounded-md transition-colors"
                                    >
                                        <Copy size={11} /> 建立副本
                                    </button>
                                )}
                            </div>

                            {/* Copy JSON Button - Bottom Right */}
                            <button 
                                onClick={(e) => handleCopyJSON(t, e)}
                                className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-indigo-400 rounded transition-colors"
                                title="複製 JSON"
                            >
                                {copiedId === t.id ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}
                            </button>
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
      
      {/* Data Management Modal (Import/Export) */}
      {showDataModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 flex flex-col h-[600px] max-h-[85vh]">
                  
                  {/* Header with Tabs */}
                  <div className="flex-none bg-slate-800 rounded-t-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                           <FolderInput size={20} className="text-emerald-500" /> 資料管理
                        </h3>
                        <button onClick={() => setShowDataModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                    </div>
                    <div className="flex">
                        <button 
                            onClick={() => setActiveModalTab('import')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeModalTab === 'import' ? 'border-emerald-500 text-emerald-400 bg-slate-700/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            匯入模板 (JSON)
                        </button>
                        <button 
                            onClick={() => setActiveModalTab('export')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeModalTab === 'export' ? 'border-indigo-500 text-indigo-400 bg-slate-700/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            批量匯出
                        </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-hidden p-4 bg-slate-900">
                      {activeModalTab === 'import' ? (
                          <div className="h-full flex flex-col gap-3 animate-in fade-in duration-200">
                              <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg border border-slate-700">
                                  支援貼上 <b>單一模板物件</b> 或 <b>多個模板的陣列</b>。系統會自動建立新的副本。
                              </p>
                              <textarea 
                                  className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none resize-none"
                                  placeholder='[ {"name": "Game A", ...}, {"name": "Game B", ...} ]'
                                  value={importJson}
                                  onChange={(e) => setImportJson(e.target.value)}
                                  onFocus={(e) => e.target.select()}
                              />
                              {importError && (
                                  <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-500/20">
                                      {importError}
                                  </div>
                              )}
                              <button 
                                  onClick={handleImportJSON}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 mt-2"
                              >
                                  <Download size={20} /> 確認匯入
                              </button>
                          </div>
                      ) : (
                          <div className="h-full flex flex-col gap-2 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                  <p className="text-sm text-slate-400">
                                      已選取 <span className="text-indigo-400 font-bold">{exportSelectedIds.length}</span> / {templates.length} 個模板
                                  </p>
                                  <button 
                                    onClick={handleSelectAllExport}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                                  >
                                      {exportSelectedIds.length === templates.length ? '取消全選' : '全選'}
                                  </button>
                              </div>
                              
                              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                  {templates.length === 0 && (
                                      <div className="text-center py-10 text-slate-500 italic">我的遊戲庫是空的</div>
                                  )}
                                  {templates.map(t => {
                                      const isSelected = exportSelectedIds.includes(t.id);
                                      return (
                                          <div 
                                            key={t.id}
                                            onClick={() => toggleExportSelection(t.id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}
                                          >
                                              {isSelected 
                                                ? <CheckSquare size={20} className="text-indigo-500 shrink-0" />
                                                : <Square size={20} className="text-slate-600 shrink-0" />
                                              }
                                              <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                                  {t.name}
                                              </span>
                                          </div>
                                      );
                                  })}
                              </div>

                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <button 
                                    onClick={handleExportCopy}
                                    disabled={exportSelectedIds.length === 0}
                                    className={`py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                                        exportSelectedIds.length > 0 
                                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/50' 
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    {isExportCopying ? <Check size={18} /> : <Copy size={18} />}
                                    {isExportCopying ? '已複製' : '複製 JSON'}
                                </button>
                                <button 
                                    onClick={handleShareToDev}
                                    disabled={exportSelectedIds.length === 0}
                                    className={`py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                                        exportSelectedIds.length > 0 
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/50' 
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    <Mail size={18} />
                                    分享給開發者
                                </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Setup Game Modal */}
      {pendingTemplate && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setPendingTemplate(null)}
          >
              <div 
                className="bg-slate-900 w-2/3 max-w-xs rounded-2xl shadow-2xl border border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
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

      {/* Zoom Indicator */}
      <div className={`zoom-indicator ${showZoomIndicator ? 'opacity-100' : 'opacity-0'}`}>
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
};

export default App;