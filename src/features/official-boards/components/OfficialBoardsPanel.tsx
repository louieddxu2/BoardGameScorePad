import React from 'react';
import { useCloudDataEnabled } from '../../cloud-data/cloudDataPreference';
import { useOfficialBoardsTranslation } from '../../../i18n/officialBoards';
import CatalogSyncCard from './CatalogSyncCard';
import OfficialAdminCard from './OfficialAdminCard';
import OfficialCatalogList from './OfficialCatalogList';

interface OfficialBoardsPanelProps {
  /** Signed in with the owner's account; the Worker still verifies every admin call. */
  isAdmin: boolean;
}

/** "Cloud built-in" tab of the cloud library: sync status, admin tools and the official catalog. */
const OfficialBoardsPanel: React.FC<OfficialBoardsPanelProps> = ({ isAdmin }) => {
  const enabled = useCloudDataEnabled();
  const { t } = useOfficialBoardsTranslation();
  if (!enabled) return <p className="p-3 text-sm text-txt-secondary">{t('official_cloud_data_disabled')}</p>;

  return <div className="space-y-3">
    <CatalogSyncCard />
    {isAdmin && <OfficialAdminCard />}
    <OfficialCatalogList isAdmin={isAdmin} />
  </div>;
};

export default OfficialBoardsPanel;
