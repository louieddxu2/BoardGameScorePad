import { useState, useEffect, useCallback } from 'react';

/**
 * Custom Hook: 監聽 beforeinstallprompt 並管理 PWA 安裝提示狀態
 */
export const usePwaInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const pwaInstalled = localStorage.getItem('pwa_installed') === 'true';
    if (pwaInstalled || window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }, [installPromptEvent]);

  return {
    isInstalled,
    canInstall: !!installPromptEvent,
    handleInstallClick
  };
};
