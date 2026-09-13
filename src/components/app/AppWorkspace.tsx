import React from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { AppView, GameTemplate } from '../../types';
import { useAppData } from '../../hooks/useAppData';
import { useMultiplayerRoomLifecycle } from '../../hooks/useMultiplayerRoomLifecycle';
import { multiplayerSessionManager } from '../../features/multiplayer/multiplayerSessionManager';
import { createPlayerSessionCapabilities, hostSessionCapabilities } from '../../features/multiplayer/sessionCapabilities';
import TemplateEditor from '../editor/TemplateEditor';
import SessionView from '../session/SessionView';
import Dashboard from '../dashboard/Dashboard';
import GameSetupModal from '../dashboard/modals/GameSetupModal';
import HistoryReviewView from '../history/HistoryReviewView';
import { InAppBrowserGuide } from '../modals/InAppBrowserGuide';
import { IOSPwaGuide } from '../modals/IOSPwaGuide';
import MultiplayerRoomModal from '../session/modals/MultiplayerRoomModal';
import MultiplayerPlayerClaimModal from '../session/modals/MultiplayerPlayerClaimModal';
import MultiplayerParticipantRoomModal from '../session/modals/MultiplayerParticipantRoomModal';
import type { AppDataActions } from '../../hooks/useAppSessionActions';
import type { AppTranslationKey } from '../../i18n/app';

type AppData = ReturnType<typeof useAppData>;
type MultiplayerRoomLifecycle = ReturnType<typeof useMultiplayerRoomLifecycle>;

type AppWorkspaceProps = {
  view: AppView;
  appData: AppData;
  pendingTemplate: GameTemplate | null;
  pendingSessionPreview: ReturnType<AppData['getSessionPreview']>;
  editorInitialName?: string;
  isCloudImporting: boolean;
  showLandscapeOverlay: boolean;
  zoomLevel: number;
  isInstalled: boolean;
  canInstall: boolean;
  isIOSPwaGuideVisible: boolean;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  setPendingTemplate: React.Dispatch<React.SetStateAction<GameTemplate | null>>;
  setEditorInitialName: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsIOSPwaGuideVisible: React.Dispatch<React.SetStateAction<boolean>>;
  handleInstallClick: () => void;
  tApp: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
  actions: AppDataActions;
  multiplayer: MultiplayerRoomLifecycle;
};

const AppWorkspace: React.FC<AppWorkspaceProps> = ({
  view,
  appData,
  pendingTemplate,
  pendingSessionPreview,
  editorInitialName,
  isCloudImporting,
  showLandscapeOverlay,
  zoomLevel,
  isInstalled,
  canInstall,
  isIOSPwaGuideVisible,
  setView,
  setPendingTemplate,
  setEditorInitialName,
  setIsIOSPwaGuideVisible,
  handleInstallClick,
  tApp,
  actions,
  multiplayer,
}) => {
  const {
    activeMultiplayerRoom,
    activeMultiplayerRoomState: multiplayerRoomState,
    isMultiplayerTransitioning,
    multiplayerJoinUrl,
    pendingMultiplayerJoin,
    pendingMultiplayerClaimIds,
    isJoiningMultiplayer,
    isMultiplayerRoomModalOpen,
    setIsMultiplayerRoomModalOpen,
    isMultiplayerParticipantRoomModalOpen,
    setIsMultiplayerParticipantRoomModalOpen,
    handleOpenMultiplayerRoom,
    handleConfirmMultiplayerPlayers,
    handleRequestMultiplayerPlayerClaim,
    handleConfirmMultiplayerPlayerClaims,
    handleCancelMultiplayerPlayerClaims,
    handleCancelMultiplayerJoin,
    handlePublishMultiplayerBoardUpdate,
  } = multiplayer;

  return (
    <div className="h-full bg-app-bg text-txt-primary font-sans overflow-hidden transition-colors duration-300 relative">
      {isCloudImporting && (
        <div className="modal-backdrop z-[10000] animate-in fade-in duration-300">
          <div className="modal-container items-center justify-center p-8 text-center border-none shadow-none bg-transparent">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mb-6 animate-bounce">
              <Smartphone size={32} />
            </div>
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
              <p className="text-lg font-bold text-txt-primary tracking-wide">{tApp('msg_loading_cloud_data')}</p>
            </div>
          </div>
        </div>
      )}

      <div
        id="landscape-overlay"
        className={`fixed inset-0 z-[9999] bg-app-bg flex-col items-center justify-center text-center p-10 ${showLandscapeOverlay ? 'flex' : 'hidden'}`}
      >
        <div className="animate-rotate-phone mb-4 text-brand-primary">
          <Smartphone size={64} strokeWidth={1.5} className="rotate-90" />
        </div>
        <h2 className="text-xl font-bold text-txt-primary mb-2">{tApp('rotate_device')}</h2>
        <p className="text-txt-muted text-sm">{tApp('rotate_device_desc')}</p>
      </div>

      <div className={`absolute inset-0 z-0 flex flex-col ${view !== AppView.DASHBOARD ? 'invisible pointer-events-none' : ''}`}>
        <Dashboard
          isVisible={view === AppView.DASHBOARD}
          currentView={view}
          userTemplates={appData.templates}
          userTemplatesCount={appData.userTemplatesCount}
          systemOverrides={appData.systemOverrides}
          systemTemplates={appData.systemTemplates}
          systemTemplatesCount={appData.systemTemplatesCount}
          pinnedIds={appData.pinnedIds}
          newBadgeIds={appData.newBadgeIds}
          activeSessionIds={appData.activeSessionIds}
          activeSessions={appData.activeSessions}
          historyRecords={appData.historyRecords}
          historyStatsRecords={appData.historyStatsRecords}
          historyGameEntries={appData.historyGameEntries}
          historyCount={appData.historyCount}
          savedPlayers={appData.savedPlayers}
          searchQuery={appData.searchQuery}
          setSearchQuery={appData.setSearchQuery}
          themeMode={appData.themeMode}
          onToggleTheme={appData.toggleTheme}
          onTemplateSelect={actions.initSetup}
          onDirectResume={actions.handleDirectResume}
          onDiscardSession={actions.handleDiscardActiveSession}
          onClearAllActiveSessions={actions.handleClearAllActiveSessions}
          getSessionPreview={appData.getSessionPreview}
          onTemplateCreate={(name) => {
            setEditorInitialName(name);
            setView(AppView.TEMPLATE_CREATOR);
          }}
          onTemplateDelete={appData.deleteTemplate}
          onTemplateSave={appData.saveTemplate}
          onBatchImport={actions.handleBatchImport}
          onTogglePin={appData.togglePin}
          onTogglePinOption={appData.togglePinOption}
          onClearNewBadges={appData.clearNewBadges}
          onRestoreSystem={appData.restoreSystemTemplate}
          onGetFullTemplate={appData.getTemplate}
          onDeleteHistory={appData.deleteHistoryRecord}
          onHistorySelect={actions.handleHistorySelect}
          isInstalled={isInstalled}
          canInstall={canInstall}
          onInstallClick={handleInstallClick}
          onImportSession={appData.importSession}
          onImportHistory={appData.importHistoryRecord}
          onImportSettings={appData.importSystemSettings}
          onBgStatsImport={appData.importBgStatsData}
          onGetLocalData={appData.getSystemExportData}
          savedLocations={appData.savedLocations}
          savedGames={appData.savedGames}
          isSetupModalOpen={!!pendingTemplate}
          gameOptions={appData.gameOptions}
          onQuickStart={actions.handleQuickStart}
        />
      </div>

      {view === AppView.TEMPLATE_CREATOR && (
        <div className="absolute inset-0 z-50 bg-app-bg">
          <TemplateEditor
            onSave={actions.handleTemplateSave}
            onCancel={() => {
              setView(AppView.DASHBOARD);
              setEditorInitialName(undefined);
            }}
            allTemplates={[...appData.systemTemplates, ...appData.templates]}
            initialName={editorInitialName}
          />
        </div>
      )}

      {view === AppView.ACTIVE_SESSION && appData.currentSession && appData.activeTemplate && (
        <div className="absolute inset-0 z-40 bg-app-bg animate-in fade-in duration-300">
          <SessionView
            key={appData.currentSession.id}
            session={appData.currentSession}
            template={appData.activeTemplate}
            savedPlayers={appData.savedPlayers}
            allSavedPlayers={appData.savedPlayersAll}
            savedLocations={appData.savedLocations}
            zoomLevel={zoomLevel}
            baseImage={appData.sessionImage}
            onUpdateSession={appData.updateSession}
            onUpdateSavedPlayer={appData.updateSavedPlayer}
            onUpdateImage={appData.setSessionImage}
            onResetScores={appData.resetSessionScores}
            onUpdateTemplate={appData.updateActiveTemplate}
            onExit={actions.handleExitSession}
            onSaveToHistory={actions.handleSaveToHistory}
            onDiscard={actions.handleDiscard}
            isVoiceEnabled={appData.isVoiceEnabled}
            onToggleVoice={appData.toggleVoice}
            multiplayerRoomId={activeMultiplayerRoom?.roomId}
            multiplayerManager={multiplayerSessionManager}
            multiplayerCapabilities={activeMultiplayerRoom?.role === 'player' ? createPlayerSessionCapabilities(activeMultiplayerRoom.playerIds ?? []) : hostSessionCapabilities}
            onOpenMultiplayerRoom={activeMultiplayerRoom?.role !== 'player' && !isMultiplayerTransitioning ? handleOpenMultiplayerRoom : undefined}
            onOpenMultiplayerParticipantRoom={activeMultiplayerRoom?.role === 'player' && !isMultiplayerTransitioning ? () => setIsMultiplayerParticipantRoomModalOpen(true) : undefined}
            onRequestMultiplayerPlayerClaim={activeMultiplayerRoom?.role === 'player' && !isMultiplayerTransitioning ? handleRequestMultiplayerPlayerClaim : undefined}
          />
        </div>
      )}

      {view === AppView.HISTORY_REVIEW && appData.viewingHistoryRecord && (
        <div className="absolute inset-0 z-40 bg-app-bg animate-in fade-in duration-300">
          <HistoryReviewView record={appData.viewingHistoryRecord} onExit={actions.handleHistoryExit} zoomLevel={zoomLevel} />
        </div>
      )}

      {pendingTemplate && (
        <GameSetupModal
          template={pendingTemplate}
          previewSession={pendingSessionPreview}
          sessionPlayerCount={appData.sessionPlayerCount}
          onClose={() => setPendingTemplate(null)}
          onStart={(count, options) => actions.handleStartNewGame(pendingTemplate, count, options)}
          onResume={() => actions.handleResumeGame(pendingTemplate.id)}
        />
      )}

      {isJoiningMultiplayer && (
        <div className="modal-backdrop z-[10000]"><Loader2 className="w-8 h-8 text-brand-primary animate-spin" /></div>
      )}

      {isMultiplayerRoomModalOpen && activeMultiplayerRoom?.role === 'host' && (
        <MultiplayerRoomModal
          isOpen
          joinUrl={multiplayerJoinUrl}
          connectionCount={multiplayerRoomState?.connectionCount ?? 0}
          hasUnpublishedBoardUpdate={multiplayerRoomState?.hasUnpublishedBoardUpdate ?? false}
          onPublishBoardUpdate={handlePublishMultiplayerBoardUpdate}
          onCloseRoom={actions.handleCloseMultiplayerRoom}
          onClose={() => setIsMultiplayerRoomModalOpen(false)}
        />
      )}

      {isMultiplayerParticipantRoomModalOpen && activeMultiplayerRoom?.role === 'player' && (
        <MultiplayerParticipantRoomModal
          isOpen
          connectionStatus={multiplayerRoomState?.status}
          onLeave={actions.handleLeaveMultiplayerRoom}
          onClose={() => setIsMultiplayerParticipantRoomModalOpen(false)}
        />
      )}

      {pendingMultiplayerClaimIds && activeMultiplayerRoom?.role === 'player' && multiplayerRoomState?.session && (
        <MultiplayerPlayerClaimModal
          isOpen
          variant="manage"
          initialSelectedIds={pendingMultiplayerClaimIds}
          players={multiplayerRoomState.session.players}
          onConfirm={handleConfirmMultiplayerPlayerClaims}
          onClose={handleCancelMultiplayerPlayerClaims}
        />
      )}

      {pendingMultiplayerJoin && (
        <MultiplayerPlayerClaimModal
          isOpen
          players={pendingMultiplayerJoin.bootstrapMessage.package.session.players}
          onConfirm={handleConfirmMultiplayerPlayers}
          onClose={handleCancelMultiplayerJoin}
        />
      )}

      <InAppBrowserGuide />
      {isIOSPwaGuideVisible && <IOSPwaGuide onClose={() => setIsIOSPwaGuideVisible(false)} />}
    </div>
  );
};

export default AppWorkspace;
