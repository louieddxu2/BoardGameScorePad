import React from 'react';
import CatalogSyncCard from './CatalogSyncCard';
import OfficialAdminCard from './OfficialAdminCard';
import OfficialCatalogList from './OfficialCatalogList';

interface OfficialBoardsPanelProps {
  /** Signed in with the owner's account; the Worker still verifies every admin call. */
  isAdmin: boolean;
}

/** "Cloud built-in" tab of the cloud library: sync status, admin tools and the official catalog. */
const OfficialBoardsPanel: React.FC<OfficialBoardsPanelProps> = ({ isAdmin }) => (
  <div className="space-y-3">
    <CatalogSyncCard />
    {isAdmin && <OfficialAdminCard />}
    <OfficialCatalogList isAdmin={isAdmin} />
  </div>
);

export default OfficialBoardsPanel;
