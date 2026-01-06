
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppView, GameTemplate, ScoringRule } from './types';
import { getTouchDistance } from './utils/ui';
import { useAppData } from './hooks/useAppData';
import { useGoogleDrive } from './hooks/useGoogleDrive';

// Components
import TemplateEditor from './components/editor/TemplateEditor';
import SessionView from './components/session/SessionView';
import Dashboard from './components/dashboard/Dashboard';
import GameSetupModal from './components/dashboard/modals/GameSetupModal';
import HistoryReviewView from './components/history/HistoryReviewView'; // New Import

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  
  // Custom Hook for all data logic
  const appData = useAppData();
  const { silentSystemBackup } = useGoogleDrive();

  // Local UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);
  
  // PWA Install
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Mobile Zoom
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const zoomLevelRef = useRef(1.0); 
  const touchStartDist = useRef(0);
  const initialZoomRef = useRef(1.0);
  const isZooming = useRef(false);
  const isExitingSession = useRef(false);

  // System Backup Logic
  const lastBackedUpTime = useRef<number>(0);

  // Check for system backup whenever returning to Dashboard
  // [Logic Update] Only backup when VIEW switches to Dashboard, no debounce.
  useEffect(() => {
      // Only trigger if we are on Dashboard
      if (view === AppView.DASHBOARD) {
          // If local data is newer than last backup time
          if (appData.systemDirtyTime > lastBackedUpTime.current) {
              const backupRoutine = async () => {
                  const data = await appData.getSystemExportData();
                  await silentSystemBackup(data);
                  lastBackedUpTime.current = Date.now();
              };
              backupRoutine();
          }
      }
      // Intentionally omit appData.systemDirtyTime from dependency array
      // to avoid triggering backup on every interaction while already on dashboard.
      // We ONLY want to backup when returning to dashboard (view change).
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, silentSystemBackup, appData.getSystemExportData]);

  // --- Session Preview Logic (for Modal) ---
  const pendingSessionPreview = useMemo(() => {
      if (!pendingTemplate || !appData.activeSessionIds.includes(pendingTemplate.id)) return null;
      return appData.getSessionPreview(pendingTemplate.id);
  }, [pendingTemplate, appData.activeSessionIds]);

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

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isZooming.current = true;
        e.preventDefault(); 
        touchStartDist.current = getTouchDistance(e.touches);
        initialZoomRef.current = zoomLevelRef.current;
      } else {
        isZooming.current = false;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (isZooming.current && e.touches.length === 2) {
        e.preventDefault(); 
        if (touchStartDist.current > 0) {
            const currentDist = getTouchDistance(e.touches);
            const scale = currentDist / touchStartDist.current;
            setZoomLevel(Math.max(0.75, Math.min(1.3, initialZoomRef.current * scale)));
        }
      }
    };
    
    const handleTouchEnd = () => { 
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
  }, []); 

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
      else if (view === AppView.HISTORY_REVIEW) { 
          appData.viewHistory(null); 
          setView(AppView.DASHBOARD); 
          handled = true; 
      }
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
  };

  const handleResumeGame = async () => {
      if (pendingTemplate) {
          const success = await appData.resumeSession(pendingTemplate.id);
          if (success) {
              setView(AppView.ACTIVE_SESSION);
              setPendingTemplate(null);
          }
      }
  };

  const handleDirectResume = async (templateId: string) => {
      const success = await appData.resumeSession(templateId);
      if (success) {
          setPendingTemplate(null);
          setView(AppView.ACTIVE_SESSION);
      }
  };

  const handleStartNewGame = async (count: number, options: { startTimeStr: string, scoringRule: ScoringRule }) => {
      if (pendingTemplate) {
          // [Logic Added] If there is an existing active session for this template, discard it first
          // This ensures the "Reset Record" promise in the UI is fulfilled.
          if (appData.activeSessionIds.includes(pendingTemplate.id)) {
              await appData.discardSession(pendingTemplate.id);
          }

          // 1. Prepare data (this might involve fetching full template if shallow)
          await appData.startSession(pendingTemplate, count, options);
          
          // 2. Switch View FIRST (This mounts SessionView on top of Dashboard)
          setView(AppView.ACTIVE_SESSION);
          
          // 3. Close Modal (This unmounts the modal)
          // The delay ensures the SessionView is rendered before the modal disappears to avoid flashing the dashboard
          setPendingTemplate(null);
      }
  };

  const handleExitSession = () => {
      isExitingSession.current = true;
      appData.exitSession();
      setView(AppView.DASHBOARD);
  };

  const handleSaveToHistory = () => {
      isExitingSession.current = true;
      appData.saveToHistory();
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

  const handleHistorySelect = (record: any) => {
      appData.viewHistory(record);
      setView(AppView.HISTORY_REVIEW);
  };

  return (
    <div className="h-full bg-slate-900 text-slate-100 font-sans overflow-hidden transition-colors duration-300 relative">
      
      {/* 
        STACK ARCHITECTURE:
        Dashboard is always present in DOM to preserve state/scroll.
        It is hidden via CSS when not active.
      */}
      <div className={`absolute inset-0 z-0 flex flex-col ${view !== AppView.DASHBOARD ? 'invisible pointer-events-none' : ''}`}>
        <Dashboard 
          isVisible={view === AppView.DASHBOARD} // Pass visibility for optimization
          userTemplates={appData.templates}
          userTemplatesCount={appData.userTemplatesCount} // Pass Count
          systemOverrides={appData.systemOverrides}
          systemTemplates={appData.systemTemplates}
          systemTemplatesCount={appData.systemTemplatesCount} // Pass Count
          pinnedIds={appData.pinnedIds}
          newBadgeIds={appData.newBadgeIds}
          activeSessionIds={appData.activeSessionIds}
          historyRecords={appData.historyRecords}
          historyCount={appData.historyCount} // Pass Count
          searchQuery={appData.searchQuery} // Pass search query
          setSearchQuery={appData.setSearchQuery} // Pass search query setter
          themeMode={appData.themeMode} 
          onToggleTheme={appData.toggleTheme} 
          onTemplateSelect={initSetup}
          onDirectResume={handleDirectResume}
          onDiscardSession={appData.discardSession}
          onClearAllActiveSessions={appData.clearAllActiveSessions}
          getSessionPreview={appData.getSessionPreview}
          onTemplateCreate={() => setView(AppView.TEMPLATE_CREATOR)}
          onTemplateDelete={appData.deleteTemplate}
          onTemplateSave={appData.saveTemplate}
          onBatchImport={handleBatchImport}
          onTogglePin={appData.togglePin}
          onClearNewBadges={appData.clearNewBadges}
          onRestoreSystem={appData.restoreSystemTemplate}
          onGetFullTemplate={appData.getTemplate}
          onDeleteHistory={appData.deleteHistoryRecord}
          onHistorySelect={handleHistorySelect} 
          isInstalled={isInstalled}
          canInstall={!!installPromptEvent}
          onInstallClick={handleInstallClick}
          onImportSession={appData.importSession}
          onImportHistory={appData.importHistoryRecord} // [New] Prop
          onImportSettings={appData.importSystemSettings} // [New] Prop
        />
      </div>

      {view === AppView.TEMPLATE_CREATOR && (
        <div className="absolute inset-0 z-50 bg-slate-900">
            <TemplateEditor 
              onSave={handleTemplateSave} 
              onCancel={() => setView(AppView.DASHBOARD)}
              allTemplates={[...appData.systemTemplates, ...appData.templates]}
            />
        </div>
      )}

      {/* SessionView z-index increased to z-40 to be higher than DashboardHeader (z-30) */}
      {view === AppView.ACTIVE_SESSION && appData.currentSession && appData.activeTemplate && (
        <div className="absolute inset-0 z-40 bg-slate-900 animate-in fade-in duration-300">
            <SessionView 
              key={appData.currentSession.id}
              session={appData.currentSession} 
              template={appData.activeTemplate} 
              playerHistory={appData.playerHistory}
              zoomLevel={zoomLevel}
              baseImage={appData.sessionImage} 
              onUpdateSession={appData.updateSession}
              onUpdatePlayerHistory={appData.updatePlayerHistory}
              onUpdateImage={appData.setSessionImage} 
              onResetScores={appData.resetSessionScores}
              onUpdateTemplate={appData.updateActiveTemplate}
              onExit={handleExitSession}
              onSaveToHistory={handleSaveToHistory}
            />
        </div>
      )}

      {view === AppView.HISTORY_REVIEW && appData.viewingHistoryRecord && (
        <div className="absolute inset-0 z-40 bg-slate-900 animate-in fade-in duration-300">
            <HistoryReviewView 
                record={appData.viewingHistoryRecord}
                onExit={() => { appData.viewHistory(null); setView(AppView.DASHBOARD); }}
                zoomLevel={zoomLevel}
            />
        </div>
      )}

      {pendingTemplate && (
          <GameSetupModal 
              template={pendingTemplate}
              previewSession={pendingSessionPreview}
              sessionPlayerCount={appData.sessionPlayerCount}
              onClose={() => setPendingTemplate(null)}
              onStart={handleStartNewGame}
              onResume={handleResumeGame}
          />
      )}
    </div>
  );
};

export default App;
