import React, { useEffect, useState } from 'react';
import CatalogSyncCard from './CatalogSyncCard';
import OfficialAdminCard from './OfficialAdminCard';
import OfficialCatalogList from './OfficialCatalogList';
import { isOfficialAdminVerified, setOfficialAdminVerified } from '../officialBoards';
import { fetchAdminIdentity } from '../officialApi';
import { googleAuth } from '../../../services/cloud/googleAuth';

/** "Cloud built-in" tab of the cloud library: sync status, admin tools and the official catalog. */
const OfficialBoardsPanel: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(isOfficialAdminVerified);

  // The cloud library is owner-only, so verify silently when a Google token is
  // already available. Without one, the admin card offers an explicit sign-in.
  useEffect(() => {
    if (isAdmin || !googleAuth.isAuthorized) return;
    let active = true;
    fetchAdminIdentity(false)
      .then((identity) => {
        if (!active || !identity.isAdmin) return;
        setOfficialAdminVerified(identity.sub);
        setIsAdmin(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isAdmin]);

  return (
    <div className="space-y-3">
      <CatalogSyncCard />
      <OfficialAdminCard isAdmin={isAdmin} onAdminChange={setIsAdmin} />
      <OfficialCatalogList isAdmin={isAdmin} />
    </div>
  );
};

export default OfficialBoardsPanel;
