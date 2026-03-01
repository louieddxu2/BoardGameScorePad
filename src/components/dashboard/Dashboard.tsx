
import React, { useState, useEffect, useRef } from 'react';
import { GameTemplate, GameSession, HistoryRecord, SavedListItem } from '../../types';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { usePullAction } from '../../hooks/usePullAction';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { HistorySummary } from '../../utils/extractDataSummaries';
import { BgStatsExport, ImportManualLinks } from '../../features/bgstats/types';
import { GameOption } from '../../features/game-selector/types';

// Sub Components
import DashboardHeader from './parts/DashboardHeader';
import PullActionIsland from './parts/PullActionIsland';
import StartGamePanel from '../../features/game-selector/components/StartGamePanel';
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { DashboardModals } from './parts/DashboardModals';
import DashboardFAB from './parts/DashboardFAB';
import ShareTemplateModal from './modals/ShareTemplateModal';

// Hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useGameLauncher } from '../../features/game-selector/hooks/useGameLauncher';
import { useDashboardModals } from './hooks/useDashboardModals';
import { useDebugGestures } from './hooks/useDebugGestures';
import { useDashboardActions } from './hooks/useDashboardActions';

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
  historyRecords?: HistorySummary[] | HistoryRecord[];
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
  onHistorySelect: (record: HistoryRecord | HistorySummary) => void;
  isInstalled: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  onInstallClickLocal?: () => void; // redundant?
  onImportSession: (session: GameSession) => void;
  onImportHistory: (record: HistoryRecord) => void;
  onImportSettings?: (settings: any) => void;
  onBgStatsImport: (data: BgStatsExport, links: ImportManualLinks) => Promise<boolean>;
  onGetLocalData: () => Promise<any>;
  savedLocations?: SavedListItem[];
  savedGames: SavedListItem[];
  isSetupModalOpen?: boolean;
  gameOptions: GameOption[];
  onQuickStart: (template: GameTemplate, playerCount: number, location: string, locationId?: string) => void;
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
  gameOptions,
  onQuickStart
}) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [viewMode, setViewMode] = useState<'library' | 'history'>('library');

  useEffect(() => {
    if (!isVisible) {
      setIsSearchActive(false);
      setSearchQuery('');
    }
  }, [isVisible, setSearchQuery]);

  // --- Core Hooks ---
  const modals = useDashboardModals();

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

  const { handlePanelStart } = useGameLauncher({
    allVisibleTemplates,
    onGetFullTemplate,
    onTemplateSave,
    onGameStart: onQuickStart
  });

  const {
    fetchFileList, restoreBackup, restoreSessionBackup, restoreHistoryBackup, restoreFromTrash, deleteCloudFile, emptyTrash,
    connectToCloud, disconnectFromCloud, isSyncing, isConnected, isAutoConnectEnabled, isMockMode
  } = useGoogleDrive();

  // --- Handlers & Actions (Refactored) ---
  const dashboardActions = useDashboardActions({
    isAutoConnectEnabled,
    onGetFullTemplate,
    onTemplateSave,
    onImportHistory,
    onImportSession,
    onImportSettings,
    onGetLocalData,
    onTogglePin
  });

  const debugGestures = useDebugGestures({
    viewMode,
    setViewMode,
    onTriggerInspector: () => modals.actions.setShowInspector(true)
  });

  // --- UI Logic ---

  // Back Button for Search
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

  // Refs for UI
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const setupPanelRef = useRef<HTMLDivElement>(null);

  const handleHeaderCloudClick = async () => {
    if (viewMode === 'history') modals.actions.setCloudModalCategory('history');
    else modals.actions.setCloudModalCategory('templates');

    modals.actions.setShowCloudModal(true);
    if (!isConnected && !isSyncing) await connectToCloud();
  };

  const { pullY, pullX, activeState, isPulling } = usePullAction(scrollContainerRef, {
    onTriggerSearch: () => { setIsSearchActive(true); setIsSetupMode(false); },
    onTriggerCloud: handleHeaderCloudClick,
    disabled: false
  });

  // Damped swipe effect
  let validOffset = 0;
  if (!isPulling) {
    if (viewMode === 'library') validOffset = Math.min(0, debugGestures.swipeOffset);
    else if (viewMode === 'history') validOffset = Math.max(0, debugGestures.swipeOffset);
  }
  const dampedOffset = validOffset * 0.5;

  const handlePanelSearchFocus = () => {
    setIsSearchActive(true);
    setTimeout(() => {
      const input = document.querySelector('header input') as HTMLInputElement;
      if (input) input.focus();
    }, 0);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 transition-colors duration-300 overflow-hidden relative">
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
        onTouchStart={debugGestures.handleDebugTouchStart}
        onTouchMove={debugGestures.handleDebugTouchMove}
        onTouchEnd={debugGestures.handleDebugTouchEnd}
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
              onOpenBggImport={() => modals.actions.setShowBggImportModal(true)}
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
              copiedId={dashboardActions.copiedId}
              isConnected={isConnected}
              isAutoConnectEnabled={isAutoConnectEnabled}
              onTemplateSelect={onTemplateSelect}
              onDirectResume={onDirectResume}
              onDeleteSession={(id) => modals.actions.setSessionToDelete(id)}
              onClearAllSessions={() => modals.actions.setShowClearAllConfirm(true)}
              onPin={onTogglePin}
              onDeleteTemplate={(id) => modals.actions.setTemplateToDelete(id)}
              onCopyJSON={dashboardActions.handleCopyJSON}
              onCopyTemplateShareLink={dashboardActions.handleCopyTemplateShareLink}
              onCopyShareLink={dashboardActions.handleCopyBuiltinShareLink}
              onCloudBackup={dashboardActions.handleCloudBackup}
              onOpenDataManager={() => modals.actions.setShowDataModal(true)}
              onTemplateCreate={onTemplateCreate}
              onClearNewBadges={onClearNewBadges}
              onSystemCopy={dashboardActions.handleCopySystemTemplate}
              onSystemRestore={(t) => modals.actions.setRestoreTarget(t)}
            />
          )}
        </main>
      </div>

      <DashboardFAB
        isVisible={!isSetupMode}
        onClick={() => {
          setIsSearchActive(true);
          setIsSetupMode(true);
        }}
      />

      {isSetupMode && (
        <StartGamePanel
          ref={setupPanelRef}
          options={gameOptions}
          locations={savedLocations}
          onStart={handlePanelStart}
          onSearchClick={handlePanelSearchFocus}
          onPin={dashboardActions.handlePinGameOption}
          isSearching={searchQuery.trim().length > 0}
          searchQuery={searchQuery}
        />
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
        onSystemBackup={dashboardActions.handleSystemBackupAction}
        onSystemRestore={dashboardActions.handleSystemRestoreAction}
        onGetLocalData={onGetLocalData}
      />

      {dashboardActions.sharingTemplate && (
        <ShareTemplateModal
          isOpen={!!dashboardActions.sharingTemplate}
          onClose={() => dashboardActions.setSharingTemplate(null)}
          template={dashboardActions.sharingTemplate}
          onGetFullTemplate={onGetFullTemplate}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  if (!prevProps.isVisible && !nextProps.isVisible) {
    return true;
  }
  return false;
});

export default Dashboard;
