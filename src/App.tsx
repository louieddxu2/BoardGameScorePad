import React, { useState, useEffect, useRef } from 'react';
import { AppView, GameTemplate } from './types';
import { getTouchDistance } from './utils/ui';
import { useAppData } from './hooks/useAppData';
import { ToastProvider } from './hooks/useToast';

// Components
import TemplateEditor from './components/editor/TemplateEditor';
import SessionView from './components/session/SessionView';
import Dashboard from './components/dashboard/Dashboard';

import { Play, Minus, Plus, X } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  
  // Custom Hook for all data logic
  const appData = useAppData();

  // Local UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);
  const [setupPlayerCount, setSetupPlayerCount] = useState(4);
  
  // PWA Install
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Mobile Zoom
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const zoomLevelRef = useRef(1.0); // Keep track of zoom level for event listeners
  const touchStartDist = useRef(0);
  const initialZoomRef = useRef(1.0);
  const isZooming = useRef(false);
  const isExitingSession = useRef(false);

  // --- Zoom Logic ---
  useEffect(() => {
    const savedZoom = localStorage.getItem('app_zoom_level');
    if (savedZoom) {
      const z = parseFloat(savedZoom);
      setZoomLevel(z);
      zoomLevelRef.current = z;
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * zoomLevel}px`;
    localStorage.setItem('app_zoom_level', String(zoomLevel));
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  // Fix: Empty dependency array ensures listeners are bound only once.
  // This prevents missing 'touchend' events during React re-renders which caused the "stuck" zoom state.
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // 邏輯修正：嚴格的「會話式判斷」
      // 只有當動作開始的那一瞬間是 2 指，才將 isZooming 設為 true，並進入縮放模式。
      // 如果是一指按下去，isZooming 為 false，後續就算誤觸出現第 2 點也會被忽略。
      if (e.touches.length === 2) {
        isZooming.current = true;
        e.preventDefault(); // 立即阻止瀏覽器預設行為 (捲動/縮放)，搶奪控制權
        
        touchStartDist.current = getTouchDistance(e.touches);
        initialZoomRef.current = zoomLevelRef.current;
      } else {
        isZooming.current = false;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      // 只在合法的縮放會話 (isZooming === true) 中執行縮放
      if (isZooming.current && e.touches.length === 2) {
        e.preventDefault(); // 縮放過程中持續阻止瀏覽器干擾
        
        if (touchStartDist.current > 0) {
            const currentDist = getTouchDistance(e.touches);
            const scale = currentDist / touchStartDist.current;
            setZoomLevel(Math.max(0.75, Math.min(1.3, initialZoomRef.current * scale)));
        }
      }
    };
    
    const handleTouchEnd = () => { 
        // 無條件結束縮放會話
        isZooming.current = false;
        touchStartDist.current = 0; 
    };
    
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []); // Dependencies must remain empty

  // --- PWA Logic ---
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
    const handleAppInstalled = () => {
        localStorage.setItem('pwa_installed', 'true');
        setIsInstalled(true);
        setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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

  // --- Restore View State ---
  useEffect(() => {
      if (appData.currentSession && appData.activeTemplate) {
          setView(AppView.ACTIVE_SESSION);
      }
  }, [appData.currentSession, appData.activeTemplate]);

  // --- Back Button Handling ---
  useEffect(() => {
    const handlePopState = () => {
      isExitingSession.current = false;
      let handled = false;

      if (pendingTemplate) { setPendingTemplate(null); handled = true; }
      else if (view === AppView.TEMPLATE_CREATOR) { setView(AppView.DASHBOARD); handled = true; }
      else if (view === AppView.ACTIVE_SESSION) {
         window.dispatchEvent(new CustomEvent('app-back-press'));
         handled = true;
      }

      if (handled && !isExitingSession.current) {
        history.pushState(null, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    history.pushState(null, '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, pendingTemplate]);

  // --- Confirm on Refresh ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (view === AppView.ACTIVE_SESSION) {
        e.preventDefault();
        // Modern browsers show a generic message for security reasons,
        // but setting returnValue is required to trigger the prompt.
        e.returnValue = '您確定要離開嗎？目前的計分進度將會遺失。';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [view]);

  // --- Navigation Handlers ---

  const initSetup = (template: GameTemplate) => {
    setPendingTemplate(template);
    setSetupPlayerCount(4);
  };

  const handleConfirmSetup = () => {
      if (pendingTemplate) {
          appData.startSession(pendingTemplate, setupPlayerCount);
          setPendingTemplate(null);
          setView(AppView.ACTIVE_SESSION);
      }
  };

  const handleExitSession = () => {
      isExitingSession.current = true;
      appData.exitSession();
      setView(AppView.DASHBOARD);
  };
  
  const handleTemplateSave = (template: GameTemplate) => {
      appData.saveTemplate(template);
      setView(AppView.DASHBOARD);
  };
  
  const handleBatchImport = (templates: GameTemplate[]) => {
      templates.forEach(t => appData.saveTemplate(t));
      setView(AppView.DASHBOARD);
  };

  // --- Render ---

  const renderContent = () => {
    if (view === AppView.TEMPLATE_CREATOR) {
      return <TemplateEditor onSave={handleTemplateSave} onCancel={() => setView(AppView.DASHBOARD)} />;
    }

    if (view === AppView.ACTIVE_SESSION && appData.currentSession && appData.activeTemplate) {
      return (
        <SessionView 
          key={appData.currentSession.id}
          session={appData.currentSession} 
          template={appData.activeTemplate} 
          playerHistory={appData.playerHistory}
          zoomLevel={zoomLevel}
          onUpdateSession={appData.updateSession}
          onUpdatePlayerHistory={appData.updatePlayerHistory}
          onResetScores={appData.resetSessionScores}
          onUpdateTemplate={appData.updateActiveTemplate}
          onExit={handleExitSession}
        />
      );
    }

    return (
      // 使用 h-full 配合 index.html 的 100dvh，而不是 min-h-screen
      // 這確保了應用程式在網址列隱藏時也能正確佔滿視窗，且捲動發生在內部 Dashboard 而不是 body
      <div className="h-full bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
        
        <Dashboard 
          userTemplates={appData.templates}
          systemOverrides={appData.systemOverrides}
          pinnedIds={appData.pinnedIds}
          knownSysIds={appData.knownSysIds}
          onTemplateSelect={initSetup}
          onTemplateCreate={() => setView(AppView.TEMPLATE_CREATOR)}
          onTemplateDelete={appData.deleteTemplate}
          onTemplateSave={appData.saveTemplate}
          onBatchImport={handleBatchImport}
          onTogglePin={appData.togglePin}
          onMarkSystemSeen={appData.markSystemTemplatesSeen}
          onRestoreSystem={appData.restoreSystemTemplate}
          isInstalled={isInstalled}
          canInstall={!!installPromptEvent}
          onInstallClick={handleInstallClick}
        />

        {/* Setup Game Modal */}
        {pendingTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setPendingTemplate(null)}>
                <div className="bg-slate-900 w-2/3 max-w-xs rounded-2xl shadow-2xl border border-slate-800" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="text-base font-bold text-white truncate pr-2">{pendingTemplate.name}</h3>
                        <button onClick={() => setPendingTemplate(null)} className="text-slate-500 hover:text-white shrink-0"><X size={20} /></button>
                    </div>
                    <div className="p-6 flex flex-col items-center">
                        <label className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">設定玩家人數</label>
                        <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-700 w-full max-w-[200px] justify-between">
                            <button onClick={() => setSetupPlayerCount(c => Math.max(1, c - 1))} className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white transition-colors active:scale-95"><Minus size={20} /></button>
                            <span className="text-2xl font-bold font-mono text-emerald-400">{setupPlayerCount}</span>
                            <button onClick={() => setSetupPlayerCount(c => Math.min(12, c + 1))} className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white transition-colors active:scale-95"><Plus size={20} /></button>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
                        <button onClick={handleConfirmSetup} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"><Play size={18} fill="currentColor" /> 開始計分</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <ToastProvider>
      {renderContent()}
    </ToastProvider>
  );
};

export default App;
