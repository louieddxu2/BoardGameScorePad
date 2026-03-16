
import { useState } from 'react';
import { useModalBackHandler } from '../../../hooks/useModalBackHandler';
import { GameTemplate } from '../../../types';

export const useDashboardModals = () => {
  // Modal Control States
  const [showDataModal, setShowDataModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudModalCategory, setCloudModalCategory] = useState<'templates' | 'sessions' | 'history'>('templates');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showBgStatsModal, setShowBgStatsModal] = useState(false);
  const [showBggImportModal, setShowBggImportModal] = useState(false); // New
  const [showInspector, setShowInspector] = useState(false);

  // Back Button Handlers
  useModalBackHandler(showInstallGuide, () => setShowInstallGuide(false), 'install-guide');
  useModalBackHandler(showInspector, () => setShowInspector(false), 'inspector');
  useModalBackHandler(showDataModal, () => setShowDataModal(false), 'data-manager');
  useModalBackHandler(showBgStatsModal, () => setShowBgStatsModal(false), 'bg-stats');
  useModalBackHandler(showBggImportModal, () => setShowBggImportModal(false), 'bgg-import'); // New
  useModalBackHandler(showCloudModal, () => setShowCloudModal(false), 'cloud-manager');

  return {
    state: {
      showDataModal,
      showCloudModal,
      cloudModalCategory,
      showInstallGuide,
      showBgStatsModal,
      showBggImportModal, // New
      showInspector
    },
    actions: {
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
