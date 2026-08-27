export const getSessionPanelDockOffset = (
  viewportBottomOffset: number,
): string => viewportBottomOffset > 0
  ? `max(${viewportBottomOffset}px, var(--bottom-ui-safe-gap))`
  : 'var(--bottom-ui-safe-gap)';

export const getSessionOccupiedBottom = (
  panelHeight: string,
  viewportBottomOffset: number,
): string => `calc(${panelHeight} + ${getSessionPanelDockOffset(viewportBottomOffset)})`;
