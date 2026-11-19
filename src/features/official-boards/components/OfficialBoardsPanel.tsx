import React, { useState } from 'react';
import CatalogSyncCard from './CatalogSyncCard';
import OfficialAdminCard from './OfficialAdminCard';
import OfficialCatalogList from './OfficialCatalogList';
import { isOfficialAdminVerified } from '../officialBoards';

/** "Cloud built-in" tab of the cloud library: sync status, admin tools and the official catalog. */
const OfficialBoardsPanel: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(isOfficialAdminVerified);
  return (
    <div className="space-y-3">
      <CatalogSyncCard />
      <OfficialAdminCard isAdmin={isAdmin} onAdminChange={setIsAdmin} />
      <OfficialCatalogList isAdmin={isAdmin} />
    </div>
  );
};

export default OfficialBoardsPanel;
