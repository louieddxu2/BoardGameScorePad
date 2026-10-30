
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
  const [showGameCatalogImportModal, setShowGameCatalogImportModal] = useState(false); // New
  const [showInspector, setShowInspector] = useState(false);
  const [showCloudLibraryModal, setShowCloudLibraryModal] = useState(false); // Cloud Library Modal State

  // Back Button Handlers
  useModalBackHandler(showInstallGuide, () => setShowInstallGuide(false), 'install-guide');
  useModalBackHandler(showInspector, () => setShowInspector(false), 'inspector');
  useModalBackHandler(showDataModal, () => setShowDataModal(false), 'data-manager');
  useModalBackHandler(showBgStatsModal, () => setShowBgStatsModal(false), 'bg-stats');
  // Keep the existing history identifier when renaming the CSV catalog importer.
  useModalBackHandler(showGameCatalogImportModal, () => setShowGameCatalogImportModal(false), 'bgg-import');
  useModalBackHandler(showCloudModal, () => setShowCloudModal(false), 'cloud-manager');
  useModalBackHandler(showCloudLibraryModal, () => setShowCloudLibraryModal(false), 'cloud-library'); // Cloud Library Back Handler

  return {
    state: {
      showDataModal,
      showCloudModal,
      cloudModalCategory,
      showInstallGuide,
      showBgStatsModal,
      showGameCatalogImportModal, // New
      showInspector,
      showCloudLibraryModal // Expose state
    },
    actions: {
      setShowDataModal,
      setShowCloudModal,
      setCloudModalCategory,
      setShowInstallGuide,
      setShowBgStatsModal,
      setShowGameCatalogImportModal, // New
      setShowInspector,
      setShowCloudLibraryModal // Expose action
    }
  };
};

