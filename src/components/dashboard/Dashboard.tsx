
import React, { useState, useEffect, useRef } from 'react';
import { GameTemplate, GameSession, HistoryRecord, SavedListItem } from '../../types';
import { Play } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { generateId } from '../../utils/idGenerator';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { useSwipe } from '../../hooks/useSwipe'; 
import { usePullAction } from '../../hooks/usePullAction'; 
import { useTranslation } from '../../i18n';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { BgStatsExport, ImportManualLinks } from '../../features/bgstats/types';
import { GameOption } from '../../features/game-selector/types';

// Sub Components
import DashboardHeader from './parts/DashboardHeader';
import PullActionIsland from './parts/PullActionIsland'; 
import StartGamePanel from '../../features/game-selector/components/StartGamePanel'; 
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { DashboardModals } from './parts/DashboardModals';

// Hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useGameLauncher } from '../../features/game-selector/hooks/useGameLauncher';
import { useDashboardModals } from './hooks/useDashboardModals';

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
  activeSessions: GameSession[] | undefined;
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
  onTemplateCreate: (initialName?: string) => void;
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
  onBgStatsImport: (data: BgStatsExport, links: ImportManualLinks) => Promise<boolean>; 
  onGetLocalData: () => Promise<any>;
  savedLocations?: SavedListItem[]; 
  savedGames: SavedListItem[]; 
  isSetupModalOpen?: boolean;
  gameOptions: GameOption[]; 
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
  activeSessions, 
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
  onImportSettings,
  onBgStatsImport,
  onGetLocalData,
  savedLocations,
  savedGames,
  isSetupModalOpen,
  gameOptions
}) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false); 
  const [viewMode, setViewMode] = useState<'library' | 'history'>('library');
  const { t } = useTranslation();
  
  useEffect(() => {
    if (!isVisible) {
      setIsSearchActive(false);
      setSearchQuery('');
    }
  }, [isVisible, setSearchQuery]);

  // Use Data Hook
  const { 
    sortedActiveSessions, 
    pinnedTemplates, 
    userTemplatesToShow, 
    systemTemplatesToShow, 
    allVisibleTemplates 
  } = useDashboardData({
    userTemplates,
    systemTemplates,
    pinnedIds,
    activeSessionIds,
    activeSessions, 
    getSessionPreview
  });

  // Use Game Launcher Hook
  const { handlePanelStart } = useGameLauncher({
    allVisibleTemplates,
    onGetFullTemplate,
    onTemplateSave,
    onTemplateSelect
  });

  // Use Modal Hook
  const modals = useDashboardModals();

  // Back Button Handling for Search
  const isSearchPoppedRef = useRef(false);

  useEffect(() => {
    if (isSearchActive) {
      window.history.pushState({ modal: 'search' }, '');
      isSearchPoppedRef.current = false;
    } 
  }, [isSearchActive]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isSearchActive) {
        isSearchPoppedRef.current = true;
        setIsSearchActive(false);
        setIsSetupMode(false); 
        setSearchQuery(''); 
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSearchActive, setSearchQuery]);

  useModalBackHandler(isSetupMode, () => setIsSetupMode(false), 'setup-mode');

  // Refs for gesture logic
  const debugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugTouchStartRef = useRef<number>(0);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const setupPanelRef = useRef<HTMLDivElement>(null);

  const { showToast } = useToast();
  const { 
      handleBackup, fetchFileList, restoreBackup, restoreSessionBackup, restoreHistoryBackup, restoreFromTrash, deleteCloudFile, emptyTrash, 
      connectToCloud, disconnectFromCloud, isSyncing, isConnected, isAutoConnectEnabled, isMockMode,
      performFullBackup, performFullRestore 
  } = useGoogleDrive();
  
  // --- Handlers ---

  const handleHeaderCloudClick = async () => {
      if (viewMode === 'history') {
          modals.actions.setCloudModalCategory('history');
      } else {
          modals.actions.setCloudModalCategory('templates');
      }
      
      modals.actions.setShowCloudModal(true);
      if (!isConnected && !isSyncing) {
          await connectToCloud();
      }
  };

  const { pullY, pullX, activeState, isPulling } = usePullAction(scrollContainerRef, {
      onTriggerSearch: () => {
          setIsSearchActive(true);
          setIsSetupMode(false); 
      },
      onTriggerCloud: handleHeaderCloudClick,
      disabled: false
  });

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

  const handleDebugTouchStart = (e: React.TouchEvent) => {
      if (viewMode !== 'history') {
          onTouchStart(e); 
          return;
      }
      debugTouchStartRef.current = e.touches[0].clientX;
      onTouchStart(e); 
  };

  const handleDebugTouchMove = (e: React.TouchEvent) => {
      if (viewMode !== 'history') {
          onTouchMove(e);
          return;
      }
      const currentX = e.touches[0].clientX;
      const deltaX = currentX - debugTouchStartRef.current;
      if (deltaX < -100) {
          if (!debugTimerRef.current) {
              debugTimerRef.current = setTimeout(() => {
                  modals.actions.setShowInspector(true);
                  if (navigator.vibrate) navigator.vibrate([50, 50]);
                  debugTimerRef.current = null;
              }, 3000);
          }
      } else {
          if (debugTimerRef.current) {
              clearTimeout(debugTimerRef.current);
              debugTimerRef.current = null;
          }
      }
      onTouchMove(e);
  };

  const handleDebugTouchEnd = () => {
      if (debugTimerRef.current) {
          clearTimeout(debugTimerRef.current);
          debugTimerRef.current = null;
      }
      onTouchEnd();
  };

  let validOffset = 0;
  if (!isPulling) {
      if (viewMode === 'library') {
          validOffset = Math.min(0, swipeOffset); 
      } else if (viewMode === 'history') {
          validOffset = Math.max(0, swipeOffset); 
      }
  }
  const dampedOffset = validOffset * 0.5;

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
          showToast({ message: t('msg_json_copied'), type: 'success' });
      });
  };

  const handleCloudBackup = async (partialTemplate: GameTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAutoConnectEnabled) {
          showToast({ message: t('msg_cloud_connect_first'), type: 'warning' });
          return;
      }
      let templateToBackup = partialTemplate;
      if (!partialTemplate.columns || partialTemplate.columns.length === 0) {
          const full = await onGetFullTemplate(partialTemplate.id);
          if (full) templateToBackup = full;
          else {
              showToast({ message: t('msg_read_template_failed'), type: 'error' });
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
    showToast({ message: t('msg_copy_created'), type: 'success' });
  };

  const handlePanelSearchFocus = () => {
      setIsSearchActive(true);
      setTimeout(() => {
          const input = document.querySelector('header input') as HTMLInputElement;
          if (input) input.focus();
      }, 0);
  };

  const handleSystemBackupAction = async (onProgress: (count: number, total: number) => void, onError: (failedItems: string[]) => void) => {
      const data = await onGetLocalData();
      const templates = data.data.templates || [];
      const overrides = data.data.overrides || []; 
      const history = data.data.history || [];
      const sessions = data.data.sessions || []; 
      
      return await performFullBackup(
          data, 
          templates, 
          history, 
          sessions, 
          overrides, 
          onProgress, 
          onError, 
          (type, item) => {
              if (type === 'template' && item) {
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
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div 
        className="flex-1 flex flex-col min-h-0 bg-slate-900 transition-colors duration-300 overflow-hidden relative"
    >
      <DashboardHeader 
        isSearchActive={isSearchActive}
        setIsSearchActive={(active) => {
            setIsSearchActive(active);
            setIsSetupMode(false); 
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isInstalled={isInstalled}
        canInstall={canInstall}
        onInstallClick={onInstallClick}
        onShowInstallGuide={() => modals.actions.setShowInstallGuide(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isConnected={isConnected}
        isSyncing={isSyncing}
        onCloudClick={handleHeaderCloudClick}
        onTriggerInspector={() => modals.actions.setShowInspector(true)} 
        interactionRefs={[setupPanelRef]}
        isOverlayOpen={isSetupModalOpen} 
      />

      <div 
        className="flex-1 overflow-y-auto no-scrollbar relative"
        ref={scrollContainerRef}
        onTouchStart={handleDebugTouchStart}
        onTouchMove={handleDebugTouchMove}
        onTouchEnd={handleDebugTouchEnd}
      >
        <PullActionIsland 
            pullY={pullY} 
            pullX={pullX} 
            activeState={activeState} 
        />

        <main 
            className="p-4 space-y-4 min-h-full transition-transform duration-75 ease-out pb-32"
            style={{ transform: `translateX(${dampedOffset}px)` }}
        >
            {viewMode === 'history' ? (
                <HistoryView 
                    records={historyRecords}
                    totalCount={historyCount || 0}
                    searchQuery={searchQuery}
                    onDelete={(id) => modals.actions.setHistoryToDelete(id)}
                    onSelect={onHistorySelect}
                    onOpenBgStats={() => modals.actions.setShowBgStatsModal(true)}
                    onOpenBggImport={() => modals.actions.setShowBggImportModal(true)} // Pass Handler
                />
            ) : (
                <LibraryView 
                    activeSessions={sortedActiveSessions}
                    pinnedTemplates={pinnedTemplates}
                    userTemplates={userTemplatesToShow}
                    userTemplatesTotal={userTemplatesCount}
                    systemTemplates={systemTemplatesToShow}
                    systemTemplatesTotal={systemTemplatesCount}
                    newBadgeIds={newBadgeIds}
                    searchQuery={searchQuery}
                    copiedId={copiedId}
                    isConnected={isConnected}
                    isAutoConnectEnabled={isAutoConnectEnabled}
                    onTemplateSelect={onTemplateSelect}
                    onDirectResume={onDirectResume}
                    onDeleteSession={(id) => modals.actions.setSessionToDelete(id)}
                    onClearAllSessions={() => modals.actions.setShowClearAllConfirm(true)}
                    onPin={onTogglePin}
                    onDeleteTemplate={(id) => modals.actions.setTemplateToDelete(id)}
                    onCopyJSON={handleCopyJSON}
                    onCloudBackup={handleCloudBackup}
                    onOpenDataManager={() => modals.actions.setShowDataModal(true)}
                    onTemplateCreate={onTemplateCreate}
                    onClearNewBadges={onClearNewBadges}
                    onSystemCopy={handleCopySystemTemplate}
                    onSystemRestore={(t) => modals.actions.setRestoreTarget(t)}
                />
            )}
        </main>
      </div>

      {!isSetupMode && (
        <button
          onClick={() => {
              setIsSearchActive(true);
              setIsSetupMode(true);
          }}
          className="absolute bottom-4 right-4 w-12 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/50 flex items-center justify-center z-40 transition-transform active:scale-95 animate-in zoom-in duration-200"
          title="開始新遊戲"
        >
          <Play size={24} fill="currentColor" className="ml-1" />
        </button>
      )}

      {isSetupMode && (
          <>
            <StartGamePanel 
                ref={setupPanelRef}
                options={gameOptions} 
                locations={savedLocations} 
                onStart={handlePanelStart}
                onSearchClick={handlePanelSearchFocus}
                isSearching={searchQuery.trim().length > 0}
                searchQuery={searchQuery}
            />
          </>
      )}

      <DashboardModals 
          state={modals.state}
          actions={modals.actions}
          
          userTemplates={userTemplates}
          isConnected={isConnected}
          isMockMode={isMockMode}
          
          onTemplateDelete={onTemplateDelete}
          onDiscardSession={onDiscardSession}
          onDeleteHistory={onDeleteHistory}
          onClearAllActiveSessions={onClearAllActiveSessions}
          onRestoreSystem={onRestoreSystem}
          onBatchImport={onBatchImport}
          onGetFullTemplate={onGetFullTemplate}
          onBgStatsImport={onBgStatsImport}
          
          fetchFileList={fetchFileList}
          restoreBackup={restoreBackup}
          restoreSessionBackup={restoreSessionBackup}
          restoreHistoryBackup={restoreHistoryBackup}
          restoreFromTrash={restoreFromTrash}
          deleteCloudFile={deleteCloudFile}
          emptyTrash={emptyTrash}
          connectToCloud={connectToCloud}
          disconnectFromCloud={disconnectFromCloud}
          
          onCloudRestoreSuccess={(t) => onTemplateSave({ ...t, lastSyncedAt: t.updatedAt || Date.now() }, { skipCloud: true, preserveTimestamps: true })}
          onSessionRestoreSuccess={onImportSession}
          onHistoryRestoreSuccess={onImportHistory}
          onSystemBackup={handleSystemBackupAction}
          onSystemRestore={handleSystemRestoreAction}
          onGetLocalData={onGetLocalData}
      />
    </div>
  );
}, (prevProps, nextProps) => {
    // Only re-render if visible, or if visibility changed.
    if (!prevProps.isVisible && !nextProps.isVisible) {
        return true; 
    }
    return false;
});

export default Dashboard;
