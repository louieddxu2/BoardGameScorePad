import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'app_cloud_data_enabled';
const CHANGE_EVENT = 'app-cloud-data-changed';

export const isCloudDataEnabled = (): boolean => {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
};

export const setCloudDataEnabled = (enabled: boolean): void => {
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); }
  catch { return; }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
};

export const useCloudDataEnabled = () => useSyncExternalStore(subscribe, isCloudDataEnabled);
