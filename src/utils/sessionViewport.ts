const DEFAULT_SESSION_PANEL_HEIGHT = 'min(100dvh, max(40dvh, 240px))';
export const IOS_BROWSER_BOTTOM_RESERVE = 'clamp(80px, 8svh, 96px)';
const IOS_BROWSER_SESSION_PANEL_HEIGHT = `min(calc(100svh - ${IOS_BROWSER_BOTTOM_RESERVE}), max(calc(40svh - ${IOS_BROWSER_BOTTOM_RESERVE}), 240px))`;

export const getSessionPanelHeight = (isIOSBrowser: boolean): string =>
  isIOSBrowser ? IOS_BROWSER_SESSION_PANEL_HEIGHT : DEFAULT_SESSION_PANEL_HEIGHT;

export const getSessionPanelDockOffset = (
  viewportBottomOffset: number,
  isKeyboardOpen = false,
  idleDockOffset = 'var(--bottom-ui-safe-gap)',
): string => isKeyboardOpen && viewportBottomOffset > 0
    ? `${viewportBottomOffset}px`
    : idleDockOffset;

export const getSessionOccupiedBottom = (
  panelHeight: string,
  viewportBottomOffset: number,
  isKeyboardOpen = false,
  idleDockOffset = 'var(--bottom-ui-safe-gap)',
): string => `calc(${panelHeight} + ${getSessionPanelDockOffset(viewportBottomOffset, isKeyboardOpen, idleDockOffset)})`;
