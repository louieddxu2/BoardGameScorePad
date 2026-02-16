
import React, { useState } from 'react';
import { GameTemplate, GameSession, HistoryRecord } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import { useTranslation } from '../../../i18n';
import { generateId } from '../../../utils/idGenerator';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive';
import { GameOption } from '../../../features/game-selector/types';

interface UseDashboardActionsProps {
  isAutoConnectEnabled: boolean;
  onGetFullTemplate: (id: string) => Promise<GameTemplate | null>;
  onTemplateSave: (template: GameTemplate, options?: { skipCloud?: boolean, preserveTimestamps?: boolean }) => void;
  onImportHistory: (record: HistoryRecord) => void;
  onImportSession: (session: GameSession) => void;
  onImportSettings?: (settings: any) => void;
  onGetLocalData: () => Promise<any>;
  onTogglePin: (id: string) => void; // New prop required
}

export const useDashboardActions = ({
  isAutoConnectEnabled,
  onGetFullTemplate,
  onTemplateSave,
  onImportHistory,
  onImportSession,
  onImportSettings,
  onGetLocalData,
  onTogglePin
}: UseDashboardActionsProps) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { handleBackup, performFullBackup, performFullRestore } = useGoogleDrive();
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Action: Copy JSON to Clipboard
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

  // Action: Single Template Cloud Backup
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

  // Action: Create Copy of System Template
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

  // Action: Wrapper for Full System Backup
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

  // Action: Wrapper for Full System Restore
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

  // [New] Pin Game Option Logic (Create simple template on the fly if needed)
  const handlePinGameOption = async (option: GameOption) => {
      if (option.templateId) {
           // Already a template, just toggle pin
           onTogglePin(option.templateId);
      } else {
           // Create new simple template
           // Note: We use a simplified process similar to useGameLauncher case B
           const newTemplate: GameTemplate = {
               id: generateId(),
               name: option.cleanName || option.displayName, // [Fix] Use clean name if available
               bggId: option.bggId || '',
               columns: [], // Simple Mode
               createdAt: Date.now(),
               updatedAt: Date.now(),
               hasImage: false,
               description: "簡易計分板",
               // We DO NOT set isPinned on the template object. 
               // Pinning is an external state managed by onTogglePin.
           };
           
           // Save immediately (skip cloud sync for speed)
           await onTemplateSave(newTemplate, { skipCloud: true });
           
           // Now toggle pin on the NEW id
           // This updates the local pinnedIds list, which allows the new template to be seen by isDisposableTemplate check
           onTogglePin(newTemplate.id);
           
           showToast({ message: "已建立並釘選簡易計分板", type: 'success' });
      }
  };

  return {
      copiedId,
      handleCopyJSON,
      handleCloudBackup,
      handleCopySystemTemplate,
      handleSystemBackupAction,
      handleSystemRestoreAction,
      handlePinGameOption
  };
};
