import { useEffect, useState } from 'react';
import { readCloudSession, SESSION_EVENT, SESSION_STORAGE_KEY } from '../services/cloud/cloudSession';

/**
 * Whether this device holds a signed-in admin session with the scoreboard
 * Worker. Owner tools use it so they stay available after the Google Drive
 * token expires; the Worker still checks every admin request.
 */
export const useCloudSession = (): { isAdmin: boolean } => {
  const [isAdmin, setIsAdmin] = useState(() => !!readCloudSession()?.isAdmin);
  useEffect(() => {
    const update = () => setIsAdmin(!!readCloudSession()?.isAdmin);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY) update();
    };
    window.addEventListener(SESSION_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return { isAdmin };
};
