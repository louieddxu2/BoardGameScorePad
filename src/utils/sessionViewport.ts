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
