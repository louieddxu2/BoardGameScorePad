
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppView, GameTemplate, ScoringRule } from './types';
import { getTouchDistance } from './utils/ui';
import { useAppData } from './hooks/useAppData';
import { Smartphone } from 'lucide-react';

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

  // Local UI State
  const [pendingTemplate, setPendingTemplate] = useState<GameTemplate | null>(null);
  
  // For "Create from Search" flow
  const [editorInitialName, setEditorInitialName] = useState<string | undefined>(undefined);

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

  // Landscape Detection State (JS Control)
  const [showLandscapeOverlay, setShowLandscapeOverlay] = useState(false);

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

  // --- Landscape Detection Logic (JS) ---
  useEffect(() => {
    const checkOrientation = () => {
      // 1. Only enforce on Touch Devices (Mobile/Tablet)
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
      
      // 2. Allow large screens (Tablets/Desktops) to rotate freely
      // We check the smallest dimension. If min(w,h) >= 600px, it's likely a tablet.
      // Most large phones have a width < 500px in portrait.
      const smallestDimension = Math.min(window.innerWidth, window.innerHeight);
      const isTabletOrDesktop = smallestDimension >= 600;

      if (!isTouchDevice || isTabletOrDesktop) {
        setShowLandscapeOverlay(false);
        return;
      }

      // 3. Use Modern API if available (Screen Orientation)
      // This is the key fix: screen.orientation reports DEVICE PHYSICAL orientation, not viewport aspect ratio.
      // So keyboard popping up (shrinking viewport) does NOT change screen.orientation.
      if (window.screen && window.screen.orientation && window.screen.orientation.type) {
        const type = window.screen.orientation.type;
        const isLandscape = type.includes('landscape');
        setShowLandscapeOverlay(isLandscape);
        return;
      }

      // 4. Fallback for iOS (older versions) which relies on window.orientation
      // 0 = Portrait, 90/-90 = Landscape
      if (typeof (window as any).orientation === 'number') {
        const orientation = (window as any).orientation;
        setShowLandscapeOverlay(Math.abs(orientation) === 90);
        return;
      }

      // 5. Last Resort: Aspect Ratio Check
      // Only check this if NO input is focused, to avoid keyboard trigger.
      const activeTag = document.activeElement?.tagName;
      const isKeyboardLikelyOpen = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
      
      if (isKeyboardLikelyOpen) {
          // If typing, assume we are fine (don't show overlay)
          setShowLandscapeOverlay(false);
      } else {
          // Normal logic for phones without modern API
          setShowLandscapeOverlay(window.innerWidth > window.innerHeight);
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation); // For iOS
    if (window.screen?.orientation) {
        window.screen.orientation.addEventListener('change', checkOrientation);
    }
    
    // Initial Check
    checkOrientation();

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (window.screen?.orientation) {
          window.screen.orientation.removeEventListener('change', checkOrientation);
      }
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

  // --- Back Button Handling (Double Buffer Strategy) ---
  useEffect(() => {
    const handlePopState = () => {
      isExitingSession.current = false;
      let handled = false;

      if (pendingTemplate) { 
          setPendingTemplate(null); 
          handled = true; 
      }
      else if (view === AppView.TEMPLATE_CREATOR) { 
          setView(AppView.DASHBOARD); 
          setEditorInitialName(undefined); // Clear prefilled name
          handled = true; 
      }
      // [Modified] Both ACTIVE_SESSION and HISTORY_REVIEW now use event dispatch
      else if (view === AppView.ACTIVE_SESSION || view === AppView.HISTORY_REVIEW) {
         window.dispatchEvent(new CustomEvent('app-back-press'));
         handled = true;
      }

      if (handled && !isExitingSession.current) {
        // [Fix: Double Buffer Strategy]
        // Instead of pushing 1 dummy state, we maintain a deeper buffer.
        // This ensures that even if the user double-taps back quickly, 
        // they only consume the buffer and don't exit the app.
        // We use Microtask to execute this immediately after the current event loop.
        Promise.resolve().then(() => {
            history.pushState(null, '');
            history.pushState(null, ''); // Double wall
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial Setup: Create the Double Buffer immediately on mount/view change
    history.pushState(null, '');
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

  const handleExitSession = (location?: string) => {
      isExitingSession.current = true;
      appData.exitSession(location !== undefined ? { location } : undefined);
      setView(AppView.DASHBOARD);
  };

  const handleSaveToHistory = (location?: string) => {
      isExitingSession.current = true;
      appData.saveToHistory(location);
      setView(AppView.DASHBOARD);
  };
  
  // [Modified] Create & Auto-Start
  const handleTemplateSave = async (template: GameTemplate) => {
      await appData.saveTemplate(template);
      
      // Auto-start session with intelligent defaults
      // Priority: 1. Previous session count (if valid) 2. Template preference 3. Default 4
      const defaultCount = appData.sessionPlayerCount || template.lastPlayerCount || 4;
      
      await appData.startSession(template, defaultCount, {
          startTimeStr: undefined, // Will default to now
          scoringRule: template.defaultScoringRule || 'HIGHEST_WINS'
      });
      
      setView(AppView.ACTIVE_SESSION);
      setEditorInitialName(undefined); // Clear prefilled name after save
  };
  
  const handleBatchImport = (templates: GameTemplate[]) => {
      templates.forEach(t => appData.saveTemplate(t));
      setView(AppView.DASHBOARD);
  };

  const handleHistorySelect = (record: any) => {
      appData.viewHistory(record);
      setView(AppView.HISTORY_REVIEW);
  };

  // Helper for history view exit (triggered by internal back button, not browser back)
  const handleHistoryExit = () => {
      isExitingSession.current = true;
      appData.viewHistory(null); 
      setView(AppView.DASHBOARD);
  };

  return (
    <div className="h-full bg-slate-900 text-slate-100 font-sans overflow-hidden transition-colors duration-300 relative">
      
      {/* Landscape Lock Overlay (Controlled by JS State) */}
      <div 
        id="landscape-overlay" 
        className={`fixed inset-0 z-[9999] bg-slate-950 flex-col items-center justify-center text-center p-10 ${showLandscapeOverlay ? 'flex' : 'hidden'}`}
      >
          <div className="animate-rotate-phone mb-4 text-emerald-500">
              <Smartphone size={64} strokeWidth={1.5} className="rotate-90" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">請旋轉您的裝置</h2>
          <p className="text-slate-400 text-sm">此應用程式在手機上僅支援直式操作，以獲得最佳體驗。</p>
      </div>

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
          onTemplateCreate={(name) => {
              setEditorInitialName(name); // Set prefilled name if provided
              setView(AppView.TEMPLATE_CREATOR);
          }}
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
          onImportHistory={appData.importHistoryRecord} 
          onImportSettings={appData.importSystemSettings} 
        />
      </div>

      {view === AppView.TEMPLATE_CREATOR && (
        <div className="absolute inset-0 z-50 bg-slate-900">
            <TemplateEditor 
              onSave={handleTemplateSave} 
              onCancel={() => {
                  setView(AppView.DASHBOARD);
                  setEditorInitialName(undefined);
              }}
              allTemplates={[...appData.systemTemplates, ...appData.templates]}
              initialName={editorInitialName} // Pass prefilled name
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
              locationHistory={appData.locationHistory} // [New] Pass location history
              zoomLevel={zoomLevel}
              baseImage={appData.sessionImage} 
              onUpdateSession={appData.updateSession}
              onUpdatePlayerHistory={appData.updatePlayerHistory}
              onUpdateImage={appData.setSessionImage} 
              onResetScores={appData.resetSessionScores}
              onUpdateTemplate={appData.updateActiveTemplate}
              onExit={handleExitSession}
              onSaveToHistory={handleSaveToHistory} // [Updated] Use unified handler
              onDiscard={() => {
                  appData.discardSession(appData.activeTemplate!.id);
                  setView(AppView.DASHBOARD);
              }}
            />
        </div>
      )}

      {view === AppView.HISTORY_REVIEW && appData.viewingHistoryRecord && (
        <div className="absolute inset-0 z-40 bg-slate-900 animate-in fade-in duration-300">
            <HistoryReviewView 
                record={appData.viewingHistoryRecord}
                onExit={handleHistoryExit}
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
