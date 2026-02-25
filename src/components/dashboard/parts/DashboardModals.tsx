
import React from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { useCommonTranslation } from '../../../i18n/common';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import ConfirmationModal from '../../shared/ConfirmationModal';
import InstallGuideModal from '../../modals/InstallGuideModal';
import DataManagerModal from '../modals/DataManagerModal';
import CloudManagerModal from '../modals/CloudManagerModal';
import BgStatsModal from '../../../features/bgstats/components/BgStatsModal';
import BggImportModal from '../../../features/bgg/components/BggImportModal'; // New Import
import SystemDataInspector from '../../analysis/SystemDataInspector';
import { CloudFile, CloudResourceType } from '../../../services/googleDrive';
import { BgStatsExport, ImportManualLinks } from '../../../features/bgstats/types';

interface DashboardModalsProps {
  state: {
    templateToDelete: string | null;
    sessionToDelete: string | null;
    historyToDelete: string | null;
    showClearAllConfirm: boolean;
    restoreTarget: GameTemplate | null;
    showDataModal: boolean;
    showCloudModal: boolean;
    cloudModalCategory: 'templates' | 'sessions' | 'history';
    showInstallGuide: boolean;
    showBgStatsModal: boolean;
    showBggImportModal: boolean; // New Prop
    showInspector: boolean;
  };
  actions: {
    setTemplateToDelete: (id: string | null) => void;
    setSessionToDelete: (id: string | null) => void;
    setHistoryToDelete: (id: string | null) => void;
    setShowClearAllConfirm: (show: boolean) => void;
    setRestoreTarget: (target: GameTemplate | null) => void;
    setShowDataModal: (show: boolean) => void;
    setShowCloudModal: (show: boolean) => void;
    setShowInstallGuide: (show: boolean) => void;
    setShowBgStatsModal: (show: boolean) => void;
    setShowBggImportModal: (show: boolean) => void; // New Action
    setShowInspector: (show: boolean) => void;
  };

  userTemplates: GameTemplate[];
  isConnected: boolean;
  isMockMode: boolean;

  onTemplateDelete: (id: string) => void;
  onDiscardSession: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  onClearAllActiveSessions: () => void;
  onRestoreSystem: (id: string) => void;
  onBatchImport: (templates: GameTemplate[]) => void;
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
  onBgStatsImport: (data: BgStatsExport, links: ImportManualLinks) => Promise<boolean>;

  // Cloud Actions
  fetchFileList: (mode: 'active' | 'trash', source: 'templates' | 'sessions' | 'history') => Promise<CloudFile[]>;
  restoreBackup: (id: string) => Promise<GameTemplate>;
  restoreSessionBackup: (id: string) => Promise<GameSession>;
  restoreHistoryBackup: (id: string) => Promise<HistoryRecord>;
  restoreFromTrash: (id: string, type: CloudResourceType) => Promise<boolean>;
  deleteCloudFile: (id: string) => Promise<boolean>;
  emptyTrash: (type?: CloudResourceType) => Promise<boolean>;
  connectToCloud: () => Promise<boolean>;
  disconnectFromCloud: () => Promise<void>;

  onCloudRestoreSuccess: (t: GameTemplate) => void;
  onSessionRestoreSuccess: (s: GameSession) => void;
  onHistoryRestoreSuccess: (r: HistoryRecord) => void;
  onSystemBackup: (onProgress: (c: number, t: number) => void, onError: (f: string[]) => void) => Promise<{ success: number, skipped: number, failed: number }>;
  onSystemRestore: (meta: any, onProgress: (c: number, t: number) => void, onError: (f: string[]) => void) => Promise<{ success: number, skipped: number, failed: number }>;
  onGetLocalData: () => Promise<any>;
}

export const DashboardModals: React.FC<DashboardModalsProps> = ({
  state,
  actions,
  userTemplates,
  isConnected,
  isMockMode,
  onTemplateDelete,
  onDiscardSession,
  onDeleteHistory,
  onClearAllActiveSessions,
  onRestoreSystem,
  onBatchImport,
  onGetFullTemplate,
  onBgStatsImport,
  fetchFileList,
  restoreBackup,
  restoreSessionBackup,
  restoreHistoryBackup,
  restoreFromTrash,
  deleteCloudFile,
  emptyTrash,
  connectToCloud,
  disconnectFromCloud,
  onCloudRestoreSuccess,
  onSessionRestoreSuccess,
  onHistoryRestoreSuccess,
  onSystemBackup,
  onSystemRestore,
  onGetLocalData
}) => {
  const { t: tCommon } = useCommonTranslation();
  const { t: tDash } = useDashboardTranslation();

  return (
    <>
      {state.showInspector && <SystemDataInspector onClose={() => actions.setShowInspector(false)} />}

      <ConfirmationModal
        isOpen={!!state.templateToDelete}
        title={tDash('confirm_delete_template_title')}
        message={tDash('confirm_delete_template_msg')}
        confirmText={tCommon('delete')}
        isDangerous={true}
        onCancel={() => actions.setTemplateToDelete(null)}
        onConfirm={() => { if (state.templateToDelete) onTemplateDelete(state.templateToDelete); actions.setTemplateToDelete(null); }}
      />

      <ConfirmationModal
        isOpen={!!state.sessionToDelete}
        title={tDash('confirm_delete_session_title')}
        message={tDash('confirm_delete_session_msg')}
        confirmText={tCommon('delete')}
        isDangerous={true}
        onCancel={() => actions.setSessionToDelete(null)}
        onConfirm={() => { if (state.sessionToDelete) onDiscardSession(state.sessionToDelete); actions.setSessionToDelete(null); }}
      />

      <ConfirmationModal
        isOpen={!!state.historyToDelete}
        title={tDash('confirm_delete_history_title')}
        message={tDash('confirm_delete_template_msg')}
        confirmText={tCommon('delete')}
        isDangerous={true}
        onCancel={() => actions.setHistoryToDelete(null)}
        onConfirm={() => { if (state.historyToDelete) onDeleteHistory(state.historyToDelete); actions.setHistoryToDelete(null); }}
      />

      <ConfirmationModal
        isOpen={state.showClearAllConfirm}
        title={tDash('confirm_clear_all_sessions_title')}
        message={tDash('confirm_clear_all_sessions_msg')}
        confirmText={tDash('confirm_clear_all')}
        isDangerous={true}
        onCancel={() => actions.setShowClearAllConfirm(false)}
        onConfirm={() => { onClearAllActiveSessions(); actions.setShowClearAllConfirm(false); }}
      />

      <ConfirmationModal
        isOpen={!!state.restoreTarget}
        title={tDash('confirm_restore_title')}
        message={tDash('confirm_restore_msg')}
        confirmText={tCommon('restore')}
        onCancel={() => actions.setRestoreTarget(null)}
        onConfirm={async () => {
          if (state.restoreTarget) {
            onRestoreSystem(state.restoreTarget.id);
            actions.setRestoreTarget(null);
          }
        }}
      />

      <InstallGuideModal
        isOpen={state.showInstallGuide}
        onClose={() => actions.setShowInstallGuide(false)}
      />

      <DataManagerModal
        isOpen={state.showDataModal}
        onClose={() => actions.setShowDataModal(false)}
        userTemplates={userTemplates}
        onImport={onBatchImport}
        onGetFullTemplate={onGetFullTemplate}
      />

      <BgStatsModal
        isOpen={state.showBgStatsModal}
        onClose={() => actions.setShowBgStatsModal(false)}
        onImport={onBgStatsImport}
      />

      {/* New Modal */}
      <BggImportModal
        isOpen={state.showBggImportModal}
        onClose={() => actions.setShowBggImportModal(false)}
      />

      <CloudManagerModal
        isOpen={state.showCloudModal}
        initialCategory={state.cloudModalCategory}
        isConnected={isConnected}
        onClose={() => actions.setShowCloudModal(false)}
        isMockMode={isMockMode}
        fetchFileList={fetchFileList}
        restoreBackup={restoreBackup}
        restoreSessionBackup={restoreSessionBackup}
        restoreHistoryBackup={restoreHistoryBackup}
        restoreFromTrash={restoreFromTrash}
        deleteCloudFile={deleteCloudFile}
        emptyTrash={emptyTrash}
        connectToCloud={connectToCloud}
        disconnectFromCloud={disconnectFromCloud}
        onRestoreSuccess={onCloudRestoreSuccess}
        onSessionRestoreSuccess={onSessionRestoreSuccess}
        onHistoryRestoreSuccess={onHistoryRestoreSuccess}
        onSystemBackup={onSystemBackup}
        onSystemRestore={onSystemRestore}
        onGetLocalData={onGetLocalData}
      />
    </>
  );
};
