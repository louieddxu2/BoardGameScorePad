import { useContext, useSyncExternalStore } from 'react';
import { LanguageContext } from '../../i18n';

const STORAGE_KEY = 'app_cloud_data_enabled';
const CHANGE_EVENT = 'app-cloud-data-changed';

export const supportsCloudData = (language: string): boolean => language === 'zh-TW';

const readOptIn = (): boolean => {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
};

// The document language belongs to this tab, even if another tab changes the saved language.
export const isCloudDataEnabled = (): boolean => supportsCloudData(document.documentElement.lang) && readOptIn();

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

export const useCloudDataEnabled = () => {
  const language = useContext(LanguageContext)?.language ?? document.documentElement.lang;
  const optedIn = useSyncExternalStore(subscribe, readOptIn);
  return supportsCloudData(language) && optedIn;
};
