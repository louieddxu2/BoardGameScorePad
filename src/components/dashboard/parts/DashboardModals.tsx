
import React from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
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
    showDataModal: boolean;
    showCloudModal: boolean;
    cloudModalCategory: 'templates' | 'sessions' | 'history';
    showInstallGuide: boolean;
    showBgStatsModal: boolean;
    showBggImportModal: boolean; // New Prop
    showInspector: boolean;
  };
  actions: {
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
  onSystemRestore: (
    localMeta: { templates: Map<string, number>, history: Map<string, number>, sessions: Map<string, number> },
    onProgress: (c: number, t: number) => void,
    onError: (f: string[]) => void,
    onItemRestored: (type: 'template' | 'history' | 'session', item: any) => Promise<void>,
    onSettingsRestored?: (settings: any) => void
  ) => Promise<{ success: number, skipped: number, failed: number }>;
  onGetLocalData: () => Promise<any>;
}

export const DashboardModals: React.FC<DashboardModalsProps> = ({
  state,
  actions,
  userTemplates,
  isConnected,
  isMockMode,
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
  return (
    <>
      {state.showInspector && <SystemDataInspector onClose={() => actions.setShowInspector(false)} />}

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
