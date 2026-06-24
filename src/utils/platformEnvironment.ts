export interface PlatformEnvironment {
  isIOS: boolean;
  isStandalone: boolean;
  isIOSSafariBrowser: boolean;
}

export const getPlatformEnvironment = (
  userAgent = navigator.userAgent,
  standaloneMediaMatches = window.matchMedia('(display-mode: standalone)').matches,
  navigatorStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone),
  hasTouchEnd = 'ontouchend' in document,
): PlatformEnvironment => {
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && hasTouchEnd);
  const isStandalone = standaloneMediaMatches || navigatorStandalone;
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);

  return {
    isIOS,
    isStandalone,
    isIOSSafariBrowser: isIOS && isSafari && !isStandalone,
  };
};

export const applyPlatformEnvironmentAttributes = (
  root: HTMLElement = document.documentElement,
): PlatformEnvironment => {
  const environment = getPlatformEnvironment();

  root.dataset.ios = String(environment.isIOS);
  root.dataset.standalone = String(environment.isStandalone);
  root.dataset.iosSafariBrowser = String(environment.isIOSSafariBrowser);

  return environment;
};
