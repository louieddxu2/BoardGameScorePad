const DEFAULT_SESSION_PANEL_HEIGHT = 'min(100dvh, max(40dvh, 240px))';
const IOS_SAFARI_SESSION_PANEL_HEIGHT = 'min(100svh, max(40svh, 240px))';

export const getSessionPanelHeight = (isIOSSafariBrowser: boolean): string =>
  isIOSSafariBrowser ? IOS_SAFARI_SESSION_PANEL_HEIGHT : DEFAULT_SESSION_PANEL_HEIGHT;

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
