
import { useState } from 'react';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { GameTemplate } from '../../../types';

export const useDashboardModals = () => {
  // Modal Control States
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<GameTemplate | null>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudModalCategory, setCloudModalCategory] = useState<'templates' | 'sessions' | 'history'>('templates');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showBgStatsModal, setShowBgStatsModal] = useState(false);
  const [showBggImportModal, setShowBggImportModal] = useState(false); // New
  const [showInspector, setShowInspector] = useState(false);

  // Back Button Handlers
  useModalBackHandler(!!templateToDelete, () => setTemplateToDelete(null), 'delete-template');
  useModalBackHandler(!!sessionToDelete, () => setSessionToDelete(null), 'delete-session');
  useModalBackHandler(!!historyToDelete, () => setHistoryToDelete(null), 'delete-history');
  useModalBackHandler(showClearAllConfirm, () => setShowClearAllConfirm(false), 'clear-all');
  useModalBackHandler(!!restoreTarget, () => setRestoreTarget(null), 'restore-template');
  useModalBackHandler(showInstallGuide, () => setShowInstallGuide(false), 'install-guide');
  useModalBackHandler(showInspector, () => setShowInspector(false), 'inspector');
  useModalBackHandler(showDataModal, () => setShowDataModal(false), 'data-manager');
  useModalBackHandler(showBgStatsModal, () => setShowBgStatsModal(false), 'bg-stats');
  useModalBackHandler(showBggImportModal, () => setShowBggImportModal(false), 'bgg-import'); // New
  useModalBackHandler(showCloudModal, () => setShowCloudModal(false), 'cloud-manager');

  return {
    state: {
      templateToDelete,
      sessionToDelete,
      historyToDelete,
      showClearAllConfirm,
      restoreTarget,
      showDataModal,
      showCloudModal,
      cloudModalCategory,
      showInstallGuide,
      showBgStatsModal,
      showBggImportModal, // New
      showInspector
    },
    actions: {
      setTemplateToDelete,
      setSessionToDelete,
      setHistoryToDelete,
      setShowClearAllConfirm,
      setRestoreTarget,
      setShowDataModal,
      setShowCloudModal,
      setCloudModalCategory,
      setShowInstallGuide,
      setShowBgStatsModal,
      setShowBggImportModal, // New
      setShowInspector
    }
  };
};
